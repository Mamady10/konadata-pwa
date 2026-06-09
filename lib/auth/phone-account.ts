import { randomBytes } from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { phoneToSyntheticEmail } from '@/lib/auth/phone-email';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function findProfileByPhone(
  service: SupabaseClient,
  phoneE164: string
): Promise<{ id: string; email: string } | null> {
  const synthetic = phoneToSyntheticEmail(phoneE164);

  const { data: byPhone } = await service
    .from('profiles')
    .select('id, email')
    .eq('phone', phoneE164)
    .maybeSingle();

  if (byPhone?.id) {
    return { id: byPhone.id as string, email: byPhone.email as string };
  }

  const { data: byEmail } = await service
    .from('profiles')
    .select('id, email')
    .ilike('email', synthetic)
    .maybeSingle();

  if (byEmail?.id) {
    return { id: byEmail.id as string, email: byEmail.email as string };
  }

  return null;
}

export async function createPhoneAuthUser(params: {
  phoneE164: string;
  fullName: string;
  accountIntent?: string;
  signupIntent?: string;
}): Promise<{ userId: string; email: string } | { error: string }> {
  const service = await createServiceClient();
  const email = phoneToSyntheticEmail(params.phoneE164);
  const password = randomBytes(32).toString('hex');

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    phone: params.phoneE164,
    phone_confirm: true,
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
      return { error: 'Ce numéro est déjà associé à un compte.' };
    }
    return { error: error.message };
  }

  const userId = data.user?.id;
  if (!userId) return { error: 'Création du compte impossible.' };

  await service
    .from('profiles')
    .update({
      full_name: params.fullName,
      phone: params.phoneE164,
    })
    .eq('id', userId);

  return { userId, email };
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
