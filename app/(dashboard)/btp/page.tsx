import type { Organization } from '@/types/database';
import type { AppRole } from '@/types/database';
import { redirect } from 'next/navigation';
import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { canViewOrgWideDashboard, getSectorDashboardTitle } from '@/lib/sector/dashboard-access';
import { getOrgType } from '@/types/database';
import { sectorHomeFromOrgType } from '@/lib/sector/post-login';
import { BtpDashboardRoot } from './btp-dashboard-root';

export default async function BTPDashboardPage() {
  const session = await requireBtpPage('dashboard');

  const org = session.profile?.organizations as Organization | null;
  const orgType = getOrgType(org);
  if (orgType && orgType !== 'btp') {
    redirect(sectorHomeFromOrgType(orgType));
  }

  const orgId = session.profile?.organization_id;
  const role = session.profile?.role as AppRole | undefined;
  const title = getSectorDashboardTitle(role, 'btp');

  if (!orgId) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <h2 className="text-lg font-semibold">Organisation non configurée</h2>
        <p className="text-muted-foreground mt-2">Compte BTP requis pour accéder à ce module.</p>
      </div>
    );
  }

  const viewMode = canViewOrgWideDashboard(role, 'btp') ? 'organization' : 'personal';

  return (
    <BtpDashboardRoot
      orgId={orgId}
      orgName={org?.name ?? 'BTP'}
      title={title}
      viewMode={viewMode}
      showAiRecommendations={viewMode === 'organization'}
    />
  );
}
