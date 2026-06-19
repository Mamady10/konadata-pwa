import { createClient } from '@/lib/supabase/server';
import { registerAuthAccount } from '@/lib/auth/register-account';

export async function registerAndSignIn(params: {
  method: 'phone' | 'email';
  phoneE164?: string;
  email?: string;
  password: string;
  fullName: string;
  accountIntent?: string;
  signupIntent?: string;
}): Promise<{ success: true; userId: string } | { error: string }> {
  const created = await registerAuthAccount({
    method: params.method,
    phoneE164: params.phoneE164,
    email: params.email,
    password: params.password,
    fullName: params.fullName,
    accountIntent: params.accountIntent,
    signupIntent: params.signupIntent,
  });

  if ('error' in created) return { error: created.error };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: created.email,
    password: params.password,
  });

  if (signInError) {
    return { error: 'Compte créé mais connexion impossible. Essayez de vous connecter.' };
  }

  return { success: true, userId: created.userId };
}
