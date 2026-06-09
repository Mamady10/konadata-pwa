import Link from 'next/link';
import { getNgoSurveyDetail, submitNgoSurveyResponse } from '@/lib/actions/ngo-surveys';
import { getNgoSurveySettings } from '@/lib/actions/ngo-survey-settings';
import { requireOngPage } from '@/lib/ong/require-ong-page';
import { CollecterClient } from './collecter-client';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CollecterPage({ params }: Props) {
  await requireOngPage('sondages');
  const { id } = await params;

  const [{ survey, error }, { settings }] = await Promise.all([
    getNgoSurveyDetail(id),
    getNgoSurveySettings(),
  ]);

  if (error || !survey) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{error ?? 'Sondage introuvable'}</p>
        <Link href="/ong/sondages" className="text-primary underline text-sm">
          Retour
        </Link>
      </div>
    );
  }

  return (
    <CollecterClient
      surveyId={survey.id as string}
      title={survey.title as string}
      questions={survey.questions}
      requireGps={settings.require_gps}
      onSubmit={submitNgoSurveyResponse}
    />
  );
}
