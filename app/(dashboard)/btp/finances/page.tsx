import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { isBtpDirector } from '@/lib/btp/btp-access';
import {
  getBtpFinancialDashboard,
  getBtpSiteExpenses,
  getBtpSubcontracts,
} from '@/lib/actions/btp-financial';
import type { BtpFinancialDashboardRowExtended } from '@/lib/btp/site-financial';
import { getBtpSites } from '@/lib/actions/btp';
import { FinancesClient } from './finances-client';
import type { AppRole } from '@/types/database';

export default async function Page() {
  const session = await requireBtpPage('finances');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }
  const orgId = session.profile.organization_id;
  const isDirector = isBtpDirector(session.profile.role as AppRole);

  let dashboard: Awaited<ReturnType<typeof getBtpFinancialDashboard>> = [];
  let expenses: Awaited<ReturnType<typeof getBtpSiteExpenses>> = [];
  let subcontracts: Awaited<ReturnType<typeof getBtpSubcontracts>> = [];
  let sites: { id: string; name: string }[] = [];

  try {
    [dashboard, expenses, subcontracts, sites] = await Promise.all([
      getBtpFinancialDashboard(orgId),
      getBtpSiteExpenses(orgId),
      isDirector ? getBtpSubcontracts(orgId) : Promise.resolve([]),
      getBtpSites(orgId).then((rows) => rows.map((s) => ({ id: s.id, name: s.name }))),
    ]);
  } catch {
    dashboard = [];
    expenses = [];
    subcontracts = [];
    sites = [];
  }

  return (
    <FinancesClient
      dashboard={dashboard}
      expenses={expenses}
      subcontracts={subcontracts}
      sites={sites}
      isDirector={isDirector}
    />
  );
}
