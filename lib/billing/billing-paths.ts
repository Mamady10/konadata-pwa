/** Routes accessibles même si la facturation plateforme bloque le tenant. */
export const BILLING_EXEMPT_PREFIXES = [
  '/login',
  '/register',
  '/register/sondage',
  '/rejoindre',
  '/inscription-etablissement',
  '/corriger-parcours',
  '/auth/',
  '/parametres',
  '/paiement-organisation',
  '/paiement-scolarite',
  '/payer-scolarite',
  '/suivi-scolarite',
  '/participation-ong',
  '/paiement-sondage',
  '/api/',
];

export const BILLING_HOME_PATH = '/parametres/facturation';

/** Tenant impayé : seul Paramètres (+ page paiement dédiée) reste accessible. */
export function isBillingExemptPath(pathname: string): boolean {
  return BILLING_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
}
