import { getSession } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { AssignationsClient } from './assignations-client';
import type { Organization } from '@/types/database';
import { getOrgType } from '@/types/database';
import {
  getSchoolAssignments,
  getNgoAssignments,
  canManageAssignments,
} from '@/lib/actions/assignments';
import { SchoolOnboardingPanel } from '@/components/school/school-onboarding-panel';

export default async function AssignationsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const org = session.profile?.organizations as Organization | null;
  let orgType = getOrgType(org) ?? 'school';
  if (orgType !== 'btp' && orgType !== 'ngo' && org?.name?.toLowerCase().includes('btp')) {
    orgType = 'btp';
  }
  const role = session.profile?.role;

  const allowed = ['org_admin', 'deputy_director', 'platform_admin'].includes(role ?? '');
  if (!allowed) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <h2 className="text-lg font-semibold">Accès restreint</h2>
        <p className="text-muted-foreground mt-2">
          Seuls les directeurs peuvent gérer les assignations des collaborateurs.
        </p>
      </div>
    );
  }

  const canManage = await canManageAssignments().catch(() => false);

  if (orgType === 'ngo') {
    let ngoData: Awaited<ReturnType<typeof getNgoAssignments>> | null = null;
    try {
      ngoData = await getNgoAssignments();
    } catch (e) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h2 className="text-lg font-semibold text-amber-900">Migration requise</h2>
          <p className="text-sm text-amber-800 mt-2">
            Exécutez la migration <code className="font-mono">016_ngo_assignments_rls.sql</code> dans Supabase SQL Editor.
          </p>
          <p className="text-xs text-amber-700 mt-2">{(e as Error).message}</p>
        </div>
      );
    }

    return (
      <AssignationsClient
        orgName={org?.name ?? 'Organisation'}
        orgType={orgType}
        schoolData={null}
        ngoData={ngoData}
        btpData={null}
        canManage={canManage}
      />
    );
  }

  if (orgType === 'btp') {
    redirect('/btp/assignations');
  }

  if (orgType !== 'school') {
    return (
      <AssignationsClient
        orgName={org?.name ?? 'Organisation'}
        orgType={orgType}
        schoolData={null}
        ngoData={null}
        btpData={null}
        canManage={canManage}
      />
    );
  }

  let schoolData: Awaited<ReturnType<typeof getSchoolAssignments>> | null = null;
  try {
    schoolData = await getSchoolAssignments();
  } catch (e) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <h2 className="text-lg font-semibold text-amber-900">Migration requise</h2>
        <p className="text-sm text-amber-800 mt-2">
          Exécutez les migrations établissement dans Supabase SQL Editor, notamment{' '}
          <code className="font-mono">088</code> à <code className="font-mono">091</code>{' '}
          (bulletins, paliers, matières actives) ainsi que{' '}
          <code className="font-mono">021_school_teaching_assignments.sql</code>.
        </p>
        <p className="text-xs text-amber-700 mt-2">{(e as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SchoolOnboardingPanel role={role} compact />
      <AssignationsClient
        orgName={org?.name ?? 'Organisation'}
        orgType={orgType}
        schoolData={schoolData}
        ngoData={null}
        btpData={null}
        canManage={canManage}
      />
    </div>
  );
}
