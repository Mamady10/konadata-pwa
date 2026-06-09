import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { listOrganizationsForPlatformAdmin } from '@/lib/actions/billing';
import { listNgoSurveyChargesForCeoManagement } from '@/lib/actions/ngo-survey-billing';
import { OrganisationsClient } from './organisations-client';
import { PendingSurveyQuotes } from './pending-survey-quotes';

export default async function OrganisationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.profile?.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  const [{ rows, error }, { rows: surveyQuotes }] = await Promise.all([
    listOrganizationsForPlatformAdmin(),
    listNgoSurveyChargesForCeoManagement(),
  ]);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive">{error}</p>
        <p className="text-sm text-muted-foreground mt-2">
          Appliquez les migrations 040 et 041 si les tables offres n&apos;existent pas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <PendingSurveyQuotes rows={surveyQuotes} />
      <OrganisationsClient rows={rows} />
    </div>
  );
}
