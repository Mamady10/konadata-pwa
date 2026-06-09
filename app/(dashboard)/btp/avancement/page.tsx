import { requireBtpPage } from '@/lib/btp/require-btp-page';
import {
  getBtpDailyProgress,
  getBtpSitesForProgress,
} from '@/lib/actions/btp';
import { canManageAssignments } from '@/lib/actions/assignments';
import { AvancementClient } from './avancement-client';

export default async function Page() {
  const session = await requireBtpPage('avancement');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const orgId = session.profile.organization_id;
  const canEditFinancial = await canManageAssignments();

  let sites: Awaited<ReturnType<typeof getBtpSitesForProgress>> = [];
  let history: Awaited<ReturnType<typeof getBtpDailyProgress>> = [];

  try {
    [sites, history] = await Promise.all([
      getBtpSitesForProgress(orgId),
      getBtpDailyProgress(orgId),
    ]);
  } catch {
    sites = [];
    history = [];
  }

  return (
    <AvancementClient
      sites={sites}
      history={history}
      canEditFinancial={canEditFinancial}
      description={
        canEditFinancial
          ? 'Saisie des relevés et suivi physique / financier de tous les chantiers'
          : 'Saisie des relevés sur vos chantiers assignés uniquement'
      }
    />
  );
}
