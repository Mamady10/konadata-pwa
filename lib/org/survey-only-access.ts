/** Organisation inscrite uniquement pour lancer un sondage (sans abonnement plateforme). */

export const SURVEY_ONLY_INTENT = 'survey_only';

export const SURVEY_ONLY_ALLOWED_PREFIXES = [
  '/ong/sondages',
  '/parametres/sondages-ong',
  '/paiement-sondage',
  '/participation-ong',
];

export function isSurveyOnlyOrg(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false;
  const s = settings as Record<string, unknown>;
  const onboarding = s.onboarding as Record<string, unknown> | undefined;
  return onboarding?.intent === SURVEY_ONLY_INTENT;
}

export function isSurveyOnlyAllowedPath(pathname: string): boolean {
  if (SURVEY_ONLY_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (pathname.startsWith('/parametres')) return true;
  return false;
}
