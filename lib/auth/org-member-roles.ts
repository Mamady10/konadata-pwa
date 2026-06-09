import type { AppRole } from '@/types/database';

/** Rôles professionnels (pas candidat / élève). */
const ORG_MEMBER_ROLES = new Set<AppRole>([
  'platform_admin',
  'org_admin',
  'deputy_director',
  'registrar',
  'accountant',
  'teacher',
  'ngo_staff',
  'btp_staff',
  'pme_staff',
]);

const LEARNER_ONLY_PATH_PREFIXES = [
  '/inscription-etablissement',
  '/etablissement/candidatures',
  '/register/candidat',
  '/corriger-parcours',
];

export function isOrganizationMemberRole(role: AppRole | string | undefined): boolean {
  if (!role) return false;
  return ORG_MEMBER_ROLES.has(role as AppRole);
}

export function isLearnerOnlyRedirect(path: string | null | undefined): boolean {
  const p = (path ?? '').trim();
  if (!p.startsWith('/')) return false;
  return LEARNER_ONLY_PATH_PREFIXES.some((prefix) => p.startsWith(prefix));
}
