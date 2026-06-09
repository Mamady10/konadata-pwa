import { getNgoSurveyByPublicToken } from '@/lib/actions/ngo-public-survey';
import { ParticipationOngClient } from './participation-client';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ParticipationOngPage({ params }: Props) {
  const { token } = await params;
  const { survey, error } = await getNgoSurveyByPublicToken(token);

  if (error || !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
        <p className="text-muted-foreground text-center max-w-md">
          {error ?? 'Lien de participation invalide ou expiré.'}
        </p>
      </div>
    );
  }

  return <ParticipationOngClient token={token} survey={survey} />;
}
