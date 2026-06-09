import { getPmeDashboard } from '@/lib/actions/pme';
import { buildPmeRecommendations } from '@/lib/ai/recommendations';
import type { AppRole, Organization } from '@/types/database';
import { getOrgType } from '@/types/database';
import { sectorHomeFromOrgType } from '@/lib/sector/post-login';
import { PmeDashboardClient } from './dashboard-client';
import { redirect } from 'next/navigation';
import { requirePmePage } from '@/lib/pme/require-pme-page';
import {
  canViewOrgWideDashboard,
  getSectorDashboardTitle,
} from '@/lib/sector/dashboard-access';

export default async function PMEDashboardPage() {
  const session = await requirePmePage('dashboard');

  const org = session.profile?.organizations as Organization | null;
  const orgType = getOrgType(org);
  if (orgType && orgType !== 'business') {
    redirect(sectorHomeFromOrgType(orgType));
  }

  const orgId = session.profile?.organization_id;
  const role = session.profile?.role as AppRole | undefined;
  const title = getSectorDashboardTitle(role, 'pme');

  if (!orgId) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <h2 className="text-lg font-semibold">Organisation non configurée</h2>
        <p className="text-muted-foreground mt-2">Compte PME requis pour accéder à ce module.</p>
      </div>
    );
  }

  const showAi = canViewOrgWideDashboard(role, 'pme');
  let dashboard = null;
  let recommendations: ReturnType<typeof buildPmeRecommendations> = [];

  try {
    const data = await getPmeDashboard(orgId);
    dashboard = data;
    if (showAi) {
      recommendations = buildPmeRecommendations({
        revenue: data.kpis.revenue,
        totalExpenses: data.kpis.totalExpenses,
        profit: data.kpis.profit,
        receivables: data.kpis.receivables,
        lowStockItems: data.kpis.lowStockItems,
        pendingSales: data.pendingSales,
      });
    }
  } catch {
    dashboard = null;
  }

  return (
    <PmeDashboardClient
      orgName={org?.name ?? 'PME'}
      title={title}
      dashboard={dashboard}
      recommendations={recommendations}
      showAiRecommendations={showAi}
    />
  );
}
