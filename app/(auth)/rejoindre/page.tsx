import { getSession } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { RejoindreClient } from './rejoindre-client';
import { sectorFromOrgType, getOrgType } from '@/types/database';
import type { Organization } from '@/types/database';

const SECTOR_HOME: Record<string, string> = {
  etablissement: '/etablissement',
  ong: '/ong',
  btp: '/btp',
};

export default async function RejoindrePage() {
  const session = await getSession();

  if (session?.profile?.role === 'platform_admin') {
    redirect('/dashboard');
  }

  if (session?.profile?.organization_id) {
    const org = session.profile.organizations as Organization | null;
    const sector = sectorFromOrgType(getOrgType(org));
    redirect(SECTOR_HOME[sector] ?? '/dashboard');
  }

  return (
    <RejoindreClient
      isLoggedIn={Boolean(session)}
      userEmail={session?.profile?.email ?? session?.user?.email}
    />
  );
}
