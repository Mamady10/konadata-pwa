import { createClient, createServiceClient } from '@/lib/supabase/server';
import { allocatePhoneAuthEmail } from '@/lib/auth/phone-email';
import { onboardingPathForAccountIntent } from '@/lib/auth/onboarding-path';
import {
  findProfileByPhone,
  findProfilesByPhone,
} from '@/lib/auth/contact-accounts';
import type { SupabaseClient } from '@supabase/supabase-js';

export { findProfileByPhone, findProfilesByPhone } from '@/lib/auth/contact-accounts';

export async function createPhoneAuthUser(params: {
  phoneE164: string;
  password: string;
  fullName: string;
  accountIntent?: string;
  signupIntent?: string;
}): Promise<{ userId: string; email: string } | { error: string }> {
  const service = await createServiceClient();
  // Email technique UNIQUE — le même WhatsApp peut servir plusieurs comptes.
  // Ne pas poser auth.users.phone (contrainte unique côté Supabase Auth).
  const email = allocatePhoneAuthEmail(params.phoneE164);

  const { data, error } = await service.auth.admin.createUser({
    email,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      full_name: params.fullName,
      phone_e164: params.phoneE164,
      auth_method: 'phone',
      account_intent: params.accountIntent ?? 'director',
      ...(params.signupIntent ? { signup_intent: params.signupIntent } : {}),
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      // Collision extrêmement rare sur le suffixe — réessayer une fois
      const retryEmail = allocatePhoneAuthEmail(params.phoneE164);
      const retry = await service.auth.admin.createUser({
        email: retryEmail,
        password: params.password,
        email_confirm: true,
        user_metadata: {
          full_name: params.fullName,
          phone_e164: params.phoneE164,
          auth_method: 'phone',
          account_intent: params.accountIntent ?? 'director',
          ...(params.signupIntent ? { signup_intent: params.signupIntent } : {}),
        },
      });
      if (retry.error || !retry.data.user?.id) {
        return { error: retry.error?.message ?? 'Création du compte impossible.' };
      }
      const userId = retry.data.user.id;
      await finalizePhoneProfile(service, userId, params);
      return { userId, email: retryEmail };
    }
    return { error: error.message };
  }

  const userId = data.user?.id;
  if (!userId) return { error: 'Création du compte impossible.' };

  await finalizePhoneProfile(service, userId, params);
  return { userId, email };
}

async function finalizePhoneProfile(
  service: SupabaseClient,
  userId: string,
  params: {
    phoneE164: string;
    fullName: string;
    accountIntent?: string;
  }
) {
  const onboardingPath = onboardingPathForAccountIntent(params.accountIntent ?? 'director');
  await service
    .from('profiles')
    .update({
      full_name: params.fullName,
      phone: params.phoneE164,
      ...(onboardingPath ? { onboarding_path: onboardingPath } : {}),
    })
    .eq('id', userId);
}

/** Ouvre une session Supabase (cookies) pour un compte identifié par email technique. */
export async function establishSessionForEmail(
  email: string
): Promise<{ ok: true } | { error: string }> {
  const service = await createServiceClient();
  const supabase = await createClient();

  const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    return { error: linkErr?.message ?? 'Impossible d\'ouvrir la session.' };
  }

  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: 'email',
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyErr) return { error: verifyErr.message };
  return { ok: true };
}

export async function syncProfilePhone(
  userId: string,
  phoneE164: string,
  fullName?: string
): Promise<void> {
  const service = await createServiceClient();
  const patch: Record<string, string> = { phone: phoneE164 };
  if (fullName?.trim()) patch.full_name = fullName.trim();
  await service.from('profiles').update(patch).eq('id', userId);
}

export async function updateAuthUserPassword(
  userId: string,
  password: string
): Promise<{ ok: true } | { error: string }> {
  const service = await createServiceClient();
  const { error } = await service.auth.admin.updateUserById(userId, { password });
  if (error) return { error: error.message };
  return { ok: true };
}

/** Directeur / admin org — nouveau WhatsApp + mot de passe (compte téléphone). */
export async function adminUpdatePhoneAccountCredentials(params: {
  userId: string;
  newPhoneE164: string;
  newPassword: string;
}): Promise<{ ok: true; email: string } | { error: string }> {
  const service = await createServiceClient();

  const { data: profile } = await service
    .from('profiles')
    .select('email')
    .eq('id', params.userId)
    .maybeSingle();

  const authEmail = (profile?.email as string | undefined)?.trim();
  if (!authEmail) {
    return { error: 'Profil introuvable.' };
  }

  // Le numéro peut être partagé : on ne change pas l'email auth, seulement le contact WhatsApp.
  const { error: authErr } = await service.auth.admin.updateUserById(params.userId, {
    password: params.newPassword,
    phone_confirm: true,
    email_confirm: true,
    user_metadata: {
      phone_e164: params.newPhoneE164,
      auth_method: 'phone',
    },
  });
  if (authErr) return { error: authErr.message };

  const { error: profileErr } = await service
    .from('profiles')
    .update({ phone: params.newPhoneE164 })
    .eq('id', params.userId);
  if (profileErr) return { error: profileErr.message };

  return { ok: true, email: authEmail };
}
