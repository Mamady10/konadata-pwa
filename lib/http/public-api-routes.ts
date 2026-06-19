/**
 * Routes API accessibles sans session utilisateur.
 * Source unique — toute nouvelle route publique doit être ajoutée ici
 * et vérifiée via `npm run check:public-api`.
 */
export const PUBLIC_API_PREFIXES = [
  '/api/auth/register',
  '/api/auth/request-password-reset',
  '/api/auth/phone',
  '/api/auth/email',
  '/api/contact',
  '/api/survey-participation',
  '/api/school-payment',
  '/api/guardian-portal',
  '/api/cron',
  '/api/billing/webhook',
] as const;

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
