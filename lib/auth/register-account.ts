import { createServiceClient } from '@/lib/supabase/server';
import {
  allocateEmailAuthEmail,
  isSyntheticPhoneEmail,
  phoneToSyntheticEmail,
} from '@/lib/auth/phone-email';
import { createPhoneAuthUser } from '@/lib/auth/phone-account';
import { validatePassword } from '@/lib/auth/password-policy';
import { onboardingPathForAccountIntent } from '@/lib/auth/onboarding-path';
import { authEmailAlreadyTaken } from '@/lib/auth/contact-accounts';

export interface RegisterAccountParams {
  method: 'email' | 'phone';
  email?: string;
  phoneE164?: string;
  password: string;
  fullName: string;
  accountIntent?: string;
  signupIntent?: string;
}

export async function registerAuthAccount(
  params: RegisterAccountParams
): Promise<{ userId: string; email: string } | { error: string }> {
  const fullName = params.fullName.trim();
  if (!fullName) return { error: 'Nom complet requis.' };

  const passwordError = validatePassword(params.password);
  if (passwordError) return { error: passwordError };

  const service = await createServiceClient();

  if (params.method === 'phone') {
    const phoneE164 = params.phoneE164?.trim();
    if (!phoneE164) return { error: 'Numéro de téléphone requis.' };

    // Plusieurs comptes peuvent partager le même WhatsApp.
    return createPhoneAuthUser({
      phoneE164,
      password: params.password,
      fullName,
      accountIntent: params.accountIntent,
      signupIntent: params.signupIntent,
    });
  }

  const contactEmail = params.email?.trim().toLowerCase();
  if (!contactEmail) return { error: 'Email requis.' };
  if (isSyntheticPhoneEmail(contactEmail)) {
    return { error: 'Adresse email invalide.' };
  }

  const alreadyUsedAsAuth = await authEmailAlreadyTaken(service, contactEmail);
  const authEmail = allocateEmailAuthEmail(contactEmail, alreadyUsedAsAuth);

  const { data, error } = await service.auth.admin.createUser({
    email: authEmail,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      auth_method: 'email',
      contact_email: contactEmail,
      account_intent: params.accountIntent ?? 'director',
      ...(params.signupIntent ? { signup_intent: params.signupIntent } : {}),
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      const retryEmail = allocateEmailAuthEmail(contactEmail, true);
      const retry = await service.auth.admin.createUser({
        email: retryEmail,
        password: params.password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          auth_method: 'email',
          contact_email: contactEmail,
          account_intent: params.accountIntent ?? 'director',
          ...(params.signupIntent ? { signup_intent: params.signupIntent } : {}),
        },
      });
      if (retry.error || !retry.data.user?.id) {
        return { error: retry.error?.message ?? 'Création du compte impossible.' };
      }
      await finalizeEmailProfile(service, retry.data.user.id, fullName, contactEmail, params.accountIntent);
      return { userId: retry.data.user.id, email: retryEmail };
    }
    return { error: error.message };
  }

  const userId = data.user?.id;
  if (!userId) return { error: 'Création du compte impossible.' };

  await finalizeEmailProfile(service, userId, fullName, contactEmail, params.accountIntent);
  return { userId, email: authEmail };
}

async function finalizeEmailProfile(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string,
  fullName: string,
  contactEmail: string,
  accountIntent?: string
) {
  const onboardingPath = onboardingPathForAccountIntent(accountIntent ?? 'director');
  await service
    .from('profiles')
    .update({
      full_name: fullName,
      contact_email: contactEmail,
      ...(onboardingPath ? { onboarding_path: onboardingPath } : {}),
    })
    .eq('id', userId);
}

export function loginEmailForPhone(phoneE164: string): string {
  return phoneToSyntheticEmail(phoneE164);
}
