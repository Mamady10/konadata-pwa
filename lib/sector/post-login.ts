import type { OrganizationType } from '@/types/database';
import { sectorFromOrgType, type Sector } from '@/types/database';

export function sectorHomeFromOrgType(orgType: OrganizationType | string | undefined): string {
  const sector = sectorFromOrgType(orgType);
  if (sector === 'etablissement') return '/etablissement';
  if (sector === 'ong') return '/ong';
  if (sector === 'btp') return '/btp';
  if (sector === 'pme') return '/pme';
  return '/dashboard';
}

const SECTOR_PREFIX: Record<Sector, string> = {
  global: '/dashboard',
  etablissement: '/etablissement',
  ong: '/ong',
  btp: '/btp',
  pme: '/pme',
};

/** Routes communes à tous les directeurs (hors module métier) */
const SHARED_PREFIXES = [
  '/utilisateurs',
  '/data-factory',
  '/parametres',
  '/rapports',
  '/connecteurs',
  '/analyste-ia',
  '/securite',
  '/organisations',
  '/dashboard',
];

export function pathnameMatchesSector(pathname: string, sector: Sector): boolean {
  if (sector === 'global') return true;
  const prefix = SECTOR_PREFIX[sector];
  return pathname.startsWith(prefix);
}

export function isCrossSectorPath(pathname: string, orgType: OrganizationType | string | undefined): boolean {
  const sector = sectorFromOrgType(orgType);
  if (sector === 'global') return false;
  if (SHARED_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  if (pathname.startsWith('/etablissement') && sector !== 'etablissement') return true;
  if (pathname.startsWith('/ong') && sector !== 'ong') return true;
  if (pathname.startsWith('/btp') && sector !== 'btp') return true;
  if (pathname.startsWith('/pme') && sector !== 'pme') return true;
  return false;
}

/** Évite qu'un directeur BTP atterrisse sur /etablissement via ?redirect= */
export function resolvePostLoginRedirect(
  requestedRedirect: string | null | undefined,
  orgType: OrganizationType | string | undefined
): string {
  const home = sectorHomeFromOrgType(orgType);
  const redirect = (requestedRedirect ?? '').trim();
  if (!redirect || redirect === '/dashboard') return home;
  if (!redirect.startsWith('/') || redirect.startsWith('//')) return home;
  if (isCrossSectorPath(redirect, orgType)) return home;
  return redirect;
}
