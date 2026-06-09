import { sectorFromOrgType } from '@/types/database';
import type { OrganizationType } from '@/types/database';

const SECTOR_HOME: Record<string, string> = {
  etablissement: '/etablissement',
  ong: '/ong',
  btp: '/btp',
};

export function homeForOrgType(orgType: OrganizationType | string | undefined): string {
  const sector = sectorFromOrgType(orgType as OrganizationType);
  return SECTOR_HOME[sector] ?? '/dashboard';
}

export const PENDING_CODE_KEY = 'konadata_pending_code';

export function getPendingAccessCode(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(PENDING_CODE_KEY)?.trim().toUpperCase() ?? null;
}

export function setPendingAccessCode(code: string) {
  sessionStorage.setItem(PENDING_CODE_KEY, code.trim().toUpperCase());
}

export function clearPendingAccessCode() {
  sessionStorage.removeItem(PENDING_CODE_KEY);
}
