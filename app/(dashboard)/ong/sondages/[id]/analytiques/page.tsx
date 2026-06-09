import Link from 'next/link';
import { getNgoSurveyAnalytics } from '@/lib/actions/ngo-survey-analytics';
import { requireOrgId } from '@/lib/actions/org';
import { getAiTemplateContext } from '@/lib/ai/adapt-from-template';
import { NGO_SURVEY_REPORT_PURPOSE } from '@/lib/ai/document-template-purposes';
import { requireOngPage } from '@/lib/ong/require-ong-page';
import { isOngDirector } from '@/lib/ong/ong-access';
import { SurveyAnalyticsClient } from './survey-analytics-client';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SurveyAnalyticsPage({ params }: Props) {
  const { id } = await params;
  const session = await requireOngPage('sondages');
  const isDirector = isOngDirector(session.profile?.role);

  const { analytics, error } = await getNgoSurveyAnalytics(id);

  if (error || !analytics) {
    return (
      <div className="space-y-4 p-4">
        <p className="text-destructive">{error ?? 'Analytiques indisponibles'}</p>
        <p className="text-sm text-muted-foreground">
          Appliquez la migration 064 dans Supabase SQL Editor.
        </p>
        <Link href={`/ong/sondages/${id}`} className="text-primary underline text-sm">
          Retour au sondage
        </Link>
      </div>
    );
  }

  let surveyReportTemplate = null;
  if (isDirector) {
    const orgId = await requireOrgId();
    const tpl = await getAiTemplateContext(orgId, 'ngo', NGO_SURVEY_REPORT_PURPOSE);
    if (tpl) {
      surveyReportTemplate = {
        id: tpl.templateId,
        label: tpl.label,
        fileName: tpl.fileName,
        notes: tpl.notes,
      };
    }
  }

  return (
    <SurveyAnalyticsClient
      analytics={analytics}
      isDirector={isDirector}
      surveyReportTemplate={surveyReportTemplate}
    />
  );
}
