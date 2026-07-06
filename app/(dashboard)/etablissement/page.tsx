import { getSchoolDashboard, getPersonalSchoolDashboard } from '@/lib/actions/school';
import { getSchoolOnboardingStatus } from '@/lib/actions/school-onboarding';
import { isTrialOrg, parseSchoolOrgSettings } from '@/lib/school/school-org-settings';
import { getStudentsWithoutMatriculeSummary } from '@/lib/actions/student-matricules';
import { buildSchoolRecommendations } from '@/lib/ai/recommendations';
import type { AIRecommendation, AppRole, Organization } from '@/types/database';
import { getOrgType } from '@/types/database';
import { sectorHomeFromOrgType } from '@/lib/sector/post-login';
import { EtablissementDashboardClient } from './dashboard-client';
import { redirect } from 'next/navigation';
import { requireEtablissementPage } from '@/lib/school/require-etablissement-page';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { getSectorDashboardTitle } from '@/lib/sector/dashboard-access';

export default async function EtablissementDashboardPage() {
  const session = await requireEtablissementPage('dashboard');
  const role = session.profile?.role as AppRole | undefined;
  const caps = getEtablissementCapabilities(role);
  const title = getSectorDashboardTitle(role, 'school');

  const org = session.profile?.organizations as Organization | null;
  const orgType = getOrgType(org);
  if (orgType && orgType !== 'school') {
    redirect(sectorHomeFromOrgType(orgType));
  }

  const orgId = session.profile?.organization_id;

  if (!orgId) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <h2 className="text-lg font-semibold">Organisation non configurée</h2>
        <p className="text-muted-foreground mt-2">
          {role === 'candidate' || role === 'student' ? (
            <>
              Choisissez votre établissement sur la page{' '}
              <a href="/inscription-etablissement" className="text-primary underline">
                Inscription candidat
              </a>
              .
            </>
          ) : (
            <>
              Saisissez votre code d&apos;accès sur la page{' '}
              <a href="/rejoindre" className="text-primary underline">Rejoindre une organisation</a>.
            </>
          )}
        </p>
      </div>
    );
  }

  if (!caps.viewOrgWideDashboard) {
    const personal = await getPersonalSchoolDashboard(
      orgId,
      role as 'teacher' | 'student' | 'candidate'
    );
    return (
      <EtablissementDashboardClient
        orgName={org?.name ?? 'Établissement'}
        title={title}
        viewMode="personal"
        dashboard={null}
        personal={personal}
        recommendations={[]}
        showAiRecommendations={false}
      />
    );
  }

  let dashboard = null;
  let recommendations: AIRecommendation[] = [];
  let onboarding: Awaited<ReturnType<typeof getSchoolOnboardingStatus>>['status'] = null;
  let trialMode = false;
  let trialEndsAt: string | null = null;
  let matriculeSummary = { total: 0, assignable: 0, byClass: [] as Awaited<ReturnType<typeof getStudentsWithoutMatriculeSummary>>['byClass'] };
  try {
    const data = await getSchoolDashboard(orgId);
    dashboard = {
      kpis: data.kpis,
      charts: data.charts,
      recentEnrollments: data.recentEnrollments,
      recentPayments: data.recentPayments,
      pendingStudents: data.pendingStudents,
    };
    recommendations = buildSchoolRecommendations({
      students: dashboard.kpis.etudiants,
      teachers: dashboard.kpis.enseignants,
      classes: dashboard.kpis.classes,
      pendingEnrollments: dashboard.kpis.candidats,
      unpaidPayments: dashboard.kpis.paiementsEnAttente,
    });
  } catch {
    dashboard = null;
  }

  if (caps.manageStudents) {
    const summary = await getStudentsWithoutMatriculeSummary();
    if (!summary.error) {
      matriculeSummary = {
        total: summary.total,
        assignable: summary.assignable,
        byClass: summary.byClass,
      };
    }
  }

  if (caps.isDirector || caps.viewOrgWideDashboard) {
    const onb = await getSchoolOnboardingStatus();
    onboarding = onb.status ?? null;
  }

  const orgSettings = (org?.settings as Record<string, unknown>) ?? null;
  const schoolSettings = parseSchoolOrgSettings(orgSettings);
  trialMode = isTrialOrg(orgSettings);
  trialEndsAt =
    typeof orgSettings?.platform_subscription_valid_until === 'string'
      ? orgSettings.platform_subscription_valid_until
      : null;

  return (
    <EtablissementDashboardClient
      orgName={org?.name ?? 'Établissement'}
      title={title}
      viewMode="organization"
      dashboard={dashboard}
      personal={null}
      recommendations={recommendations}
      showAiRecommendations={caps.isDirector}
      matriculeSummary={matriculeSummary}
      canManageMatricules={caps.manageStudents}
      onboarding={onboarding}
      trialMode={trialMode}
      trialEndsAt={trialEndsAt}
      showStarterPack={caps.isDirector || caps.manageStudents}
      academicYear={schoolSettings.default_academic_year}
    />
  );
}
