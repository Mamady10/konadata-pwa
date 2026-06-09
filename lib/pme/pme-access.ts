import type { AppRole } from '@/types/database';

export type PmePage =
  | 'dashboard'
  | 'ventes'
  | 'achats'
  | 'depenses'
  | 'stocks'
  | 'clients'
  | 'fournisseurs'
  | 'documents'
  | 'rapports';

const PATH_BY_PAGE: Record<PmePage, string> = {
  dashboard: '/pme',
  ventes: '/pme/ventes',
  achats: '/pme/achats',
  depenses: '/pme/depenses',
  stocks: '/pme/stocks',
  clients: '/pme/clients',
  fournisseurs: '/pme/fournisseurs',
  documents: '/pme/documents',
  rapports: '/pme/rapports',
};

const DIRECTOR_ROLES = new Set<AppRole>([
  'platform_admin',
  'org_admin',
  'deputy_director',
  'accountant',
]);

const PME_STAFF_HREFS = new Set([
  PATH_BY_PAGE.dashboard,
  PATH_BY_PAGE.ventes,
  PATH_BY_PAGE.clients,
  PATH_BY_PAGE.stocks,
  PATH_BY_PAGE.documents,
  PATH_BY_PAGE.rapports,
]);

export function isPmeDirector(role: AppRole | string | undefined): boolean {
  if (!role) return false;
  return DIRECTOR_ROLES.has(role as AppRole);
}

/** null = accès à tout le module PME */
export function getAllowedPmeHrefs(role: AppRole | string | undefined): Set<string> | null {
  if (!role || isPmeDirector(role)) return null;
  if (role === 'pme_staff') return PME_STAFF_HREFS;
  return null;
}

export function resolvePmePage(pathname: string): PmePage | null {
  if (pathname === '/pme' || pathname === '/pme/') return 'dashboard';
  const entries = Object.entries(PATH_BY_PAGE) as [PmePage, string][];
  for (const [page, path] of entries) {
    if (page !== 'dashboard' && pathname.startsWith(path)) return page;
  }
  return null;
}

export function canAccessPmePage(role: AppRole | string | undefined, page: PmePage): boolean {
  const allowed = getAllowedPmeHrefs(role);
  if (allowed === null) return true;
  return allowed.has(PATH_BY_PAGE[page]);
}

export function canAccessPmePath(role: AppRole | string | undefined, pathname: string): boolean {
  const page = resolvePmePage(pathname);
  if (!page) return true;
  return canAccessPmePage(role, page);
}

export function getPmeFallbackPath(role: AppRole | string | undefined): string {
  const allowed = getAllowedPmeHrefs(role);
  if (allowed === null) return PATH_BY_PAGE.dashboard;
  const order: PmePage[] = ['dashboard', 'ventes', 'clients', 'stocks', 'rapports'];
  for (const page of order) {
    if (allowed.has(PATH_BY_PAGE[page])) return PATH_BY_PAGE[page];
  }
  return '/dashboard';
}

export function filterPmeNav<T extends { href: string; label: string }>(
  role: AppRole | string | undefined,
  items: T[]
): T[] {
  const allowed = getAllowedPmeHrefs(role);
  if (allowed === null) return items;
  return items.filter((item) => allowed.has(item.href));
}
