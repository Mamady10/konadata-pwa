import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { getStudentPaymentSettings } from '@/lib/actions/student-payments';
import { getSchoolOrgSettings } from '@/lib/actions/school-settings';
import { getEtablissementCapabilities } from '@/lib/school/etablissement-access';
import { PaiementsElevesClient } from './paiements-eleves-client';
import { getOrgType } from '@/types/database';
import type { Organization } from '@/types/database';

function canManageStudentPayments(role: string | undefined): boolean {
  return (
    role === 'org_admin' ||
    role === 'platform_admin' ||
    role === 'deputy_director' ||
    role === 'registrar' ||
    role === 'accountant'
  );
}

export default async function PaiementsElevesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const org = session.profile?.organizations as Organization | null;
  if (getOrgType(org) !== 'school') {
    redirect('/parametres');
  }

  if (!canManageStudentPayments(session.profile?.role)) {
    redirect('/parametres');
  }

  const [{ settings, error }, { settings: schoolSettings }] = await Promise.all([
    getStudentPaymentSettings(),
    getSchoolOrgSettings(),
  ]);
  const caps = getEtablissementCapabilities(session.profile?.role);

  return (
    <PaiementsElevesClient
      initialSettings={settings}
      loadError={error}
      orgName={org?.name ?? 'Établissement'}
      schoolSettings={schoolSettings}
      canEditSchoolSettings={caps.isDirector}
    />
  );
}
