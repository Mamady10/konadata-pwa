/** Constantes / types partagés (pas de "use server" — importables côté client). */

export const ORG_REGISTRATION_SUCCESS_PATH = '/parametres/facturation?blocked=1';

export type OrgRegistrationResult =
  | { error: string }
  | { success: true; redirectTo: string };
