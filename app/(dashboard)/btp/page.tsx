import { getBtpDashboard, getPersonalBtpDashboard } from '@/lib/actions/btp';
import { buildBtpRecommendations } from '@/lib/ai/recommendations';
import type { AIRecommendation, AppRole, Organization } from '@/types/database';
import { getOrgType } from '@/types/database';
import { sectorHomeFromOrgType } from '@/lib/sector/post-login';
import { BtpDashboardClient } from './dashboard-client';
import { redirect } from 'next/navigation';
import { requireBtpPage } from '@/lib/btp/require-btp-page';
import {
  canViewOrgWideDashboard,
  getSectorDashboardTitle,
} from '@/lib/sector/dashboard-access';

export default async function BTPDashboardPage() {
  const session = await requireBtpPage('dashboard');

  const org = session.profile?.organizations as Organization | null;
  const orgType = getOrgType(org);
  if (orgType && orgType !== 'btp') {
    redirect(sectorHomeFromOrgType(orgType));
  }

  const orgId = session.profile?.organization_id;
  const role = session.profile?.role as AppRole | undefined;
  const title = getSectorDashboardTitle(role, 'btp');

  if (!orgId) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <h2 className="text-lg font-semibold">Organisation non configurée</h2>
        <p className="text-muted-foreground mt-2">Compte BTP requis pour accéder à ce module.</p>
      </div>
    );
  }

  if (!canViewOrgWideDashboard(role, 'btp')) {
    const personal = await getPersonalBtpDashboard(orgId);
    return (
      <BtpDashboardClient
        orgName={org?.name ?? 'BTP'}
        title={title}
        viewMode="personal"
        personal={personal}
        dashboard={null}
        recommendations={[]}
        showAiRecommendations={false}
      />
    );
  }

  let dashboard = null;
  let recommendations: AIRecommendation[] = [];
  try {
    dashboard = await getBtpDashboard(orgId);
    recommendations = buildBtpRecommendations({
      sites: dashboard.kpis.chantiers,
      activeSites: dashboard.kpis.chantiersActifs,
      avgProgress: dashboard.kpis.tauxAvancement,
      fuelAnomalies: dashboard.alertesCarburant.length,
      stockAlerts: dashboard.kpis.alertesStock,
      delayedSites: dashboard.chantiersActifs.filter((c) => c.retard > 0).length,
    });
  } catch {
    dashboard = null;
  }

  return (
    <BtpDashboardClient
      orgName={org?.name ?? 'BTP'}
      title={title}
      viewMode="organization"
      personal={null}
      dashboard={dashboard}
      recommendations={recommendations}
      showAiRecommendations
    />
  );
}
