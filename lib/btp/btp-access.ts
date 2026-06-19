import type { AppRole } from '@/types/database';

export type BtpPage =
  | 'dashboard'
  | 'chantiers'
  | 'personnel'
  | 'materiels'
  | 'carburant'
  | 'bons'
  | 'finances'
  | 'avancement'
  | 'documents'
  | 'rapports'
  | 'assignations';

const PATH_BY_PAGE: Record<BtpPage, string> = {
  dashboard: '/btp',
  chantiers: '/btp/chantiers',
  personnel: '/btp/personnel',
  materiels: '/btp/materiels',
  carburant: '/btp/carburant',
  bons: '/btp/bons',
  finances: '/btp/finances',
  avancement: '/btp/avancement',
  documents: '/btp/documents',
  rapports: '/btp/rapports',
  assignations: '/btp/assignations',
};

const DIRECTOR_ROLES = new Set<AppRole>([
  'platform_admin',
  'org_admin',
  'deputy_director',
]);

/**
 * Rôles BTP :
 * - Directeurs (org_admin, deputy_director…) : accès complet dont Finances et Personnel
 * - btp_staff (chef de chantier, etc.) : terrain uniquement — PAS Finances ni Personnel
 */
const BTP_STAFF_HREFS = new Set([
  PATH_BY_PAGE.dashboard,
  PATH_BY_PAGE.chantiers,
  PATH_BY_PAGE.documents,
  PATH_BY_PAGE.avancement,
  PATH_BY_PAGE.carburant,
  PATH_BY_PAGE.bons,
  PATH_BY_PAGE.materiels,
  PATH_BY_PAGE.rapports,
]);

export function isBtpDirector(role: AppRole | string | undefined): boolean {
  if (!role) return false;
  return DIRECTOR_ROLES.has(role as AppRole);
}

/** null = accès à tout le module BTP */
export function getAllowedBtpHrefs(role: AppRole | string | undefined): Set<string> | null {
  if (!role || isBtpDirector(role)) return null;
  if (role === 'btp_staff') return BTP_STAFF_HREFS;
  return null;
}

export function resolveBtpPage(pathname: string): BtpPage | null {
  if (pathname === '/btp' || pathname === '/btp/') return 'dashboard';
  const entries = Object.entries(PATH_BY_PAGE) as [BtpPage, string][];
  for (const [page, path] of entries) {
    if (page !== 'dashboard' && pathname.startsWith(path)) return page;
  }
  return null;
}

export function canAccessBtpPage(role: AppRole | string | undefined, page: BtpPage): boolean {
  const allowed = getAllowedBtpHrefs(role);
  if (allowed === null) return true;
  return allowed.has(PATH_BY_PAGE[page]);
}

export function canAccessBtpPath(role: AppRole | string | undefined, pathname: string): boolean {
  const page = resolveBtpPage(pathname);
  if (!page) return true;
  return canAccessBtpPage(role, page);
}

export function getBtpFallbackPath(role: AppRole | string | undefined): string {
  const allowed = getAllowedBtpHrefs(role);
  if (allowed === null) return PATH_BY_PAGE.dashboard;
  const order: BtpPage[] = [
    'dashboard',
    'chantiers',
    'documents',
    'avancement',
    'carburant',
    'bons',
    'materiels',
    'rapports',
  ];
  for (const page of order) {
    if (allowed.has(PATH_BY_PAGE[page])) return PATH_BY_PAGE[page];
  }
  return '/dashboard';
}

export function filterBtpNav<T extends { href: string; label: string }>(
  role: AppRole | string | undefined,
  items: T[]
): T[] {
  const allowed = getAllowedBtpHrefs(role);
  if (allowed === null) return items;
  return items.filter((item) => allowed.has(item.href));
}
