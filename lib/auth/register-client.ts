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
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error ?? 'Inscription impossible' };
  return { success: true };
}
