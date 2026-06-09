import { createClient } from '@/lib/supabase/server';
import { getNgoProjects } from '@/lib/actions/ngo';
import { listNgoSurveysForUser } from '@/lib/actions/ngo-surveys';
import { getNgoSurveySettings } from '@/lib/actions/ngo-survey-settings';
import { surveyStatusLabel } from '@/lib/sector/status-labels';
import { COLLECTION_MODE_LABELS } from '@/lib/ngo/survey-settings';
import { isOngDirector } from '@/lib/ong/ong-access';
import { SondagesClient } from './sondages-client';
import { requireOngPage } from '@/lib/ong/require-ong-page';
import { getSurveyOnlyCreateGate } from '@/lib/actions/survey-only-org';

export default async function Page() {
  const session = await requireOngPage('sondages');
  const orgId = session.profile?.organization_id;
  if (!orgId) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const isDirector = isOngDirector(session.profile?.role);
  const [{ settings }, createGate] = await Promise.all([
    getNgoSurveySettings(),
    getSurveyOnlyCreateGate(orgId),
  ]);

  let items: Parameters<typeof SondagesClient>[0]['items'] = [];
  let projects: { id: string; name: string }[] = [];

  try {
    const supabase = await createClient();
    const [surveys, projectRows, chargesRes] = await Promise.all([
      listNgoSurveysForUser(orgId),
      isDirector ? getNgoProjects(orgId) : Promise.resolve([]),
      isDirector
        ? supabase
            .from('ngo_survey_charges')
            .select(
              'survey_id, status, amount_gnf, payment_token, campaign_ends_at, final_report_at'
            )
            .eq('organization_id', orgId)
        : Promise.resolve({ data: [] }),
    ]);
    const chargeMap = new Map(
      (chargesRes.data ?? []).map((c) => [c.survey_id as string, c])
    );
    projects = projectRows.map((p) => ({ id: p.id, name: p.name }));
    items = surveys.map((s) => {
      const ch = chargeMap.get(s.id);
      return {
      id: s.id,
      title: s.title,
      subtitle: [
        s.region ? `Région : ${s.region}` : null,
        s.project_id ? 'Lié à un projet' : null,
        s.starts_at
          ? `Début ${new Date(s.starts_at).toLocaleDateString('fr-FR')}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Enquête terrain',
      status: surveyStatusLabel(s.status),
      rawStatus: s.status ?? 'draft',
      date: new Date(s.created_at).toLocaleDateString('fr-FR'),
      responseCount: s.response_count ?? 0,
      targetResponses: s.target_responses,
      collectionMode:
        COLLECTION_MODE_LABELS[s.collection_mode as keyof typeof COLLECTION_MODE_LABELS] ??
        s.collection_mode,
      chargeStatus: (ch?.status as string) ?? null,
      chargeAmountGnf: ch?.amount_gnf != null ? Number(ch.amount_gnf) : null,
      paymentToken: (ch?.payment_token as string) ?? null,
      campaignEndsAt: (ch?.campaign_ends_at as string) ?? null,
      finalReportAt: (ch?.final_report_at as string) ?? null,
    };
    });
  } catch {
    items = [];
  }

  return (
    <SondagesClient
      items={items}
      projects={projects}
      isDirector={isDirector}
      settingsEnabled={settings.enabled}
      surveyOnly={createGate.isSurveyOnly}
      canCreateSurvey={createGate.canCreate}
      createBlockedMessage={createGate.message}
    />
  );
}
