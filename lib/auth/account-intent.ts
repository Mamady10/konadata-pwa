/** Métadonnées Supabase Auth (signUp / user_metadata). */
export type AccountIntent = 'learner' | 'staff' | 'director' | string;

export function normalizeAccountIntent(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

export function isDirectorOrStaffIntent(accountIntent: string | null | undefined): boolean {
  const i = normalizeAccountIntent(accountIntent);
  return i === 'director' || i === 'staff';
}

export function isLearnerIntent(accountIntent: string | null | undefined): boolean {
  return normalizeAccountIntent(accountIntent) === 'learner';
}

/** Profil SQL (onboarding_path) — utile si user_metadata a été écrasé. */
export function isDirectorOnboardingPath(onboardingPath: string | null | undefined): boolean {
  const p = normalizeAccountIntent(onboardingPath);
  return p === 'director' || p === 'staff';
}
