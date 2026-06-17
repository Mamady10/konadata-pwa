import type { AppRole } from '@/types/database';

const STAFF_RESETTABLE_BY_DEPUTY: AppRole[] = [
  'registrar',
  'teacher',
  'student',
  'candidate',
  'accountant',
  'ngo_staff',
  'btp_staff',
  'pme_staff',
];

export function canDirectorResetMemberCredentials(
  actorRole: AppRole | string | undefined,
  targetRole: AppRole | string | undefined,
  actorId: string,
  targetId: string
): boolean {
  if (!actorRole || !targetRole || actorId === targetId) return false;
  if (targetRole === 'platform_admin') return false;

  if (actorRole === 'platform_admin') return true;

  if (actorRole === 'org_admin') {
    return targetRole !== 'org_admin';
  }

  if (actorRole === 'deputy_director') {
    return STAFF_RESETTABLE_BY_DEPUTY.includes(targetRole as AppRole);
  }

  return false;
}
