import { cookies } from 'next/headers';
import { AUTHZ_COOKIE } from './authz-cache';

/**
 * Supprime le cache d'autorisation du middleware.
 * À appeler après toute mutation qui change l'accès (CGU, fin d'onboarding,
 * déblocage/expiration de facturation, changement de rôle ou d'organisation,
 * activation/désactivation de compte) pour éviter une redirection obsolète.
 */
export async function clearAuthzCache(): Promise<void> {
  try {
    (await cookies()).delete(AUTHZ_COOKIE);
  } catch {
    // Appelé hors contexte de requête mutable — ignoré.
  }
}
