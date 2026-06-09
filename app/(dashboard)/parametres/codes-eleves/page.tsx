import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { getStudentMatriculeSettings } from '@/lib/actions/student-matricules';
import { CodesElevesClient } from './codes-eleves-client';
import { getOrgType } from '@/types/database';
import type { Organization } from '@/types/database';

function canManageMatricules(role: string | undefined): boolean {
  return (
    role === 'org_admin' ||
    role === 'platform_admin' ||
    role === 'deputy_director' ||
    role === 'registrar'
  );
}

export default async function CodesElevesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const org = session.profile?.organizations as Organization | null;
  if (getOrgType(org) !== 'school') {
    redirect('/parametres');
  }

  if (!canManageMatricules(session.profile?.role)) {
    redirect('/parametres');
  }

  const { settings, error } = await getStudentMatriculeSettings();

  return (
    <CodesElevesClient
      initialSettings={settings}
      loadError={error}
      orgName={org?.name ?? 'Établissement'}
    />
  );
}
