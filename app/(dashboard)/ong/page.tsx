import { getNgoDashboard, getPersonalNgoDashboard, getNgoSurveys } from '@/lib/actions/ngo';
import { buildNgoRecommendations } from '@/lib/ai/recommendations';
import type { AIRecommendation, AppRole } from '@/types/database';
import { OngDashboardClient } from './dashboard-client';
import { requireOngPage } from '@/lib/ong/require-ong-page';
import {
  canViewOrgWideDashboard,
  getSectorDashboardTitle,
} from '@/lib/sector/dashboard-access';

export default async function ONGDashboardPage() {
  const session = await requireOngPage('dashboard');

  const orgId = session.profile?.organization_id;
  const org = session.profile?.organizations as { name?: string; type?: string } | null;
  const role = session.profile?.role as AppRole | undefined;
  const title = getSectorDashboardTitle(role, 'ngo');

  if (!orgId) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <h2 className="text-lg font-semibold">Organisation non configurée</h2>
        <p className="text-muted-foreground mt-2">Compte ONG requis pour accéder à ce module.</p>
      </div>
    );
  }

  if (!canViewOrgWideDashboard(role, 'ngo')) {
    const personal = await getPersonalNgoDashboard(orgId);
    return (
      <OngDashboardClient
        orgName={org?.name ?? 'ONG'}
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
    dashboard = await getNgoDashboard(orgId);
    const surveys = await getNgoSurveys(orgId).catch(() => []);
    recommendations = buildNgoRecommendations({
      projects: dashboard.kpis.projets,
      activeProjects: dashboard.kpis.projetsActifs,
      beneficiaries: dashboard.kpis.beneficiaires,
      executionRate: dashboard.kpis.tauxExecution,
      surveys: surveys.length,
    });
  } catch {
    dashboard = null;
  }

  return (
    <OngDashboardClient
      orgName={org?.name ?? 'ONG'}
      title={title}
      viewMode="organization"
      personal={null}
      dashboard={dashboard}
      recommendations={recommendations}
      showAiRecommendations
    />
  );
}
