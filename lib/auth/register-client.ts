import { postPublicJson } from '@/lib/http/public-json-fetch';

export interface RegisterAccountInput {
  method: 'email' | 'phone';
  email?: string;
  phone?: string;
  password: string;
  fullName: string;
  accountIntent?: string;
  signupIntent?: string;
}

export async function registerAccount(
  input: RegisterAccountInput
): Promise<{ success: true } | { error: string }> {
  const result = await postPublicJson<{ success?: boolean; error?: string }>(
    '/api/auth/register',
    input
  );
  if (!result.ok) return { error: result.error };
  return { success: true };
}
