import type { AccountIntent } from '@/lib/auth/account-intent';
import { normalizeAccountIntent } from '@/lib/auth/account-intent';

/** Valeur profiles.onboarding_path alignée sur account_intent à l'inscription. */
export function onboardingPathForAccountIntent(
  accountIntent: AccountIntent | string | null | undefined
): 'director' | 'staff' | 'learner' | null {
  const intent = normalizeAccountIntent(accountIntent);
  if (intent === 'director') return 'director';
  if (intent === 'staff') return 'staff';
  if (intent === 'learner') return 'learner';
  return null;
}
