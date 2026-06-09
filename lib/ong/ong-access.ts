import type { AppRole } from '@/types/database';

export type OngPage =
  | 'dashboard'
  | 'projets'
  | 'sondages'
  | 'beneficiaires'
  | 'cartographie'
  | 'rapports'
  | 'documents';

const PATH_BY_PAGE: Record<OngPage, string> = {
  dashboard: '/ong',
  projets: '/ong/projets',
  sondages: '/ong/sondages',
  beneficiaires: '/ong/beneficiaires',
  cartographie: '/ong/cartographie',
  rapports: '/ong/rapports',
  documents: '/ong/documents',
};

const DIRECTOR_ROLES = new Set<AppRole>([
  'platform_admin',
  'org_admin',
  'deputy_director',
]);

const NGO_STAFF_HREFS = new Set([
  PATH_BY_PAGE.dashboard,
  PATH_BY_PAGE.projets,
  PATH_BY_PAGE.sondages,
  PATH_BY_PAGE.documents,
  PATH_BY_PAGE.rapports,
]);

export function isOngDirector(role: AppRole | string | undefined): boolean {
  if (!role) return false;
  return DIRECTOR_ROLES.has(role as AppRole);
}

/** null = accès à tout le module ONG */
export function getAllowedOngHrefs(role: AppRole | string | undefined): Set<string> | null {
  if (!role || isOngDirector(role)) return null;
  if (role === 'ngo_staff') return NGO_STAFF_HREFS;
  return null;
}

export function resolveOngPage(pathname: string): OngPage | null {
  if (pathname === '/ong' || pathname === '/ong/') return 'dashboard';
  const entries = Object.entries(PATH_BY_PAGE) as [OngPage, string][];
  for (const [page, path] of entries) {
    if (page !== 'dashboard' && pathname.startsWith(path)) return page;
  }
  return null;
}

export function canAccessOngPage(role: AppRole | string | undefined, page: OngPage): boolean {
  const allowed = getAllowedOngHrefs(role);
  if (allowed === null) return true;
  return allowed.has(PATH_BY_PAGE[page]);
}

export function canAccessOngPath(role: AppRole | string | undefined, pathname: string): boolean {
  if (pathname.startsWith('/utilisateurs/assignations')) {
    return isOngDirector(role);
  }
  const page = resolveOngPage(pathname);
  if (!page) return true;
  return canAccessOngPage(role, page);
}

export function getOngFallbackPath(role: AppRole | string | undefined): string {
  const allowed = getAllowedOngHrefs(role);
  if (allowed === null) return PATH_BY_PAGE.dashboard;
  const order: OngPage[] = ['dashboard', 'projets', 'sondages', 'documents', 'rapports'];
  for (const page of order) {
    if (allowed.has(PATH_BY_PAGE[page])) return PATH_BY_PAGE[page];
  }
  return '/dashboard';
}

export function filterOngNav<T extends { href: string; label: string }>(
  role: AppRole | string | undefined,
  items: T[]
): T[] {
  const allowed = getAllowedOngHrefs(role);
  if (allowed === null) return items;
  return items.filter((item) => allowed.has(item.href));
}
