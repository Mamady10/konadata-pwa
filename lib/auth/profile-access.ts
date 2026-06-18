/** Compte désactivé par la direction (profiles.is_active = false). */

export const PROFILE_ACCESS_BLOCKED_MESSAGE =
  'Votre accès a été désactivé par la direction. Contactez l\'établissement.';

export function isProfileAccessBlocked(isActive: boolean | null | undefined): boolean {
  return isActive === false;
}
