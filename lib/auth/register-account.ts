import { createServiceClient } from '@/lib/supabase/server';
import { isSyntheticPhoneEmail, phoneToSyntheticEmail } from '@/lib/auth/phone-email';
import { findProfileByPhone, createPhoneAuthUser } from '@/lib/auth/phone-account';
import { validatePassword } from '@/lib/auth/password-policy';

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

    const existing = await findProfileByPhone(service, phoneE164);
    if (existing) {
      return { error: 'Ce numéro a déjà un compte. Connectez-vous ou réinitialisez votre mot de passe.' };
    }

    return createPhoneAuthUser({
      phoneE164,
      password: params.password,
      fullName,
      accountIntent: params.accountIntent,
      signupIntent: params.signupIntent,
    });
  }

  const email = params.email?.trim().toLowerCase();
  if (!email) return { error: 'Email requis.' };
  if (isSyntheticPhoneEmail(email)) {
    return { error: 'Adresse email invalide.' };
  }

  const { data: existingProfile } = await service
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  if (existingProfile?.id) {
    return { error: 'Cet email a déjà un compte. Connectez-vous ou réinitialisez votre mot de passe.' };
  }

  const { data, error } = await service.auth.admin.createUser({
    email,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      auth_method: 'email',
      account_intent: params.accountIntent ?? 'director',
      ...(params.signupIntent ? { signup_intent: params.signupIntent } : {}),
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return { error: 'Cet email a déjà un compte.' };
    }
    return { error: error.message };
  }

  const userId = data.user?.id;
  if (!userId) return { error: 'Création du compte impossible.' };

  await service.from('profiles').update({ full_name: fullName }).eq('id', userId);

  return { userId, email };
}

export function loginEmailForPhone(phoneE164: string): string {
  return phoneToSyntheticEmail(phoneE164);
}
