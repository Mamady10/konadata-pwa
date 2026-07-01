import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { listOrganizationsForPlatformAdmin } from '@/lib/actions/billing';
import { listNgoSurveyChargesForCeoManagement } from '@/lib/actions/ngo-survey-billing';
import { OrganisationsClient } from './organisations-client';
import { PendingSurveyQuotes } from './pending-survey-quotes';
import { CeoPlatformOverview } from './ceo-platform-overview';
import {
  getOrganizationsUsageStats,
  getPlatformBillingSummary,
  listPlatformBillingPayments,
} from '@/lib/actions/platform-ceo';

export default async function OrganisationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.profile?.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  const [{ rows, error }, { rows: surveyQuotes }, usageRes, billingRes, paymentsRes] =
    await Promise.all([
      listOrganizationsForPlatformAdmin(),
      listNgoSurveyChargesForCeoManagement(),
      getOrganizationsUsageStats(),
      getPlatformBillingSummary(),
      listPlatformBillingPayments(30),
    ]);

  const usageMap = new Map(
    ('rows' in usageRes ? usageRes.rows : []).map((r) => [r.org_id, r])
  );
  const ceoLoadError =
    'error' in usageRes
      ? usageRes.error
      : 'error' in billingRes
        ? billingRes.error
        : undefined;

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
    <div className="space-y-8">
      <CeoPlatformOverview
        usageRows={'rows' in usageRes ? usageRes.rows : []}
        billing={'error' in billingRes ? null : billingRes}
        payments={'rows' in paymentsRes ? paymentsRes.rows : []}
        loadError={ceoLoadError}
      />
      <PendingSurveyQuotes rows={surveyQuotes} />
      <OrganisationsClient rows={rows} usageMap={Object.fromEntries(usageMap)} />
    </div>
  );
}
