import type { SupabaseClient } from '@supabase/supabase-js';

/** Profil candidat sans organisation (RPC serveur, ne peut pas échouer en RLS). */
export async function ensureLearnerProfile(supabase: SupabaseClient): Promise<{ error?: string }> {
  const { data, error } = await supabase.rpc('ensure_learner_profile');
  if (error) return { error: error.message };
  const result = data as { error?: string; success?: boolean } | null;
  if (result?.error) return { error: result.error };
  return {};
}

export function isLearnerOnboardingProfile(profile: {
  role?: string | null;
  organization_id?: string | null;
  onboarding_path?: string | null;
} | null): boolean {
  if (!profile) return false;
  if (profile.onboarding_path === 'learner') return true;
  if (!profile.organization_id && profile.role === 'candidate') return true;
  return false;
}

/**
 * Corrige un compte org_admin sans organisation créé par erreur en onglet directeur.
 * Ne pas appeler automatiquement à la connexion (risque d'effacer un vrai directeur).
 */
export async function repairLearnerProfileIfNeeded(
  supabase: SupabaseClient,
  profile: {
    role?: string | null;
    organization_id?: string | null;
    onboarding_path?: string | null;
  } | null,
  accountIntent?: string | null
): Promise<boolean> {
  if (!profile) return false;

  const isLearner =
    accountIntent === 'learner' || profile.onboarding_path === 'learner';

  if (!isLearner) return false;
  // Ne jamais effacer l'organisation d'un vrai directeur / staff
  if (profile.organization_id) return false;
  // Uniquement compte créé par erreur en org_admin sans structure
  if (profile.role !== 'org_admin') return false;

  const { error } = await ensureLearnerProfile(supabase);
  return !error;
}
