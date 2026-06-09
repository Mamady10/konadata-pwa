import { getSession } from '@/lib/actions/auth';
import { getPlatformStats } from '@/lib/actions/platform';
import { buildPlatformRecommendations } from '@/lib/ai/recommendations';
import { getOrgType, sectorFromOrgType } from '@/types/database';
import type { Organization } from '@/types/database';
import { redirect } from 'next/navigation';
import { PlatformDashboardClient } from './platform-dashboard-client';
import { GlobalDashboardClient } from './dashboard-client';

const SECTOR_HOME: Record<string, string> = {
  etablissement: '/etablissement',
  ong: '/ong',
  btp: '/btp',
  pme: '/pme',
};

export default async function GlobalDashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  if (session.profile?.role === 'platform_admin') {
    let stats = null;
    try {
      stats = await getPlatformStats();
    } catch {
      stats = null;
    }
    if (stats) {
      const recommendations = buildPlatformRecommendations({
        organisations: stats.kpis.organisations,
        utilisateurs: stats.kpis.utilisateurs,
        orgsByType: stats.orgsByType,
      });
      return <PlatformDashboardClient stats={stats} recommendations={recommendations} />;
    }
    return <GlobalDashboardClient variant="platform-unavailable" />;
  }

  if (session.profile?.organization_id) {
    const org = session.profile.organizations as Organization | null;
    const sector = sectorFromOrgType(getOrgType(org));
    const home = SECTOR_HOME[sector];
    if (home) redirect(home);
  }

  if (!session.profile?.organization_id) {
    redirect('/rejoindre');
  }

  return <GlobalDashboardClient variant="unconfigured" />;
}
