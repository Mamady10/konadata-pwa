import { requirePmePage } from '@/lib/pme/require-pme-page';
import { redirect } from 'next/navigation';
import { isPmeDirector } from '@/lib/pme/pme-access';
import { getPmeAssignments, canManageAssignments } from '@/lib/actions/assignments';
import type { Organization } from '@/types/database';
import { AssignationsClient } from '@/app/(dashboard)/utilisateurs/assignations/assignations-client';

export default async function Page() {
  const session = await requirePmePage('assignations');
  if (!isPmeDirector(session.profile?.role)) {
    redirect('/pme');
  }

  const org = session.profile?.organizations as Organization | null;
  const canManage = await canManageAssignments().catch(() => false);

  let pmeData: Awaited<ReturnType<typeof getPmeAssignments>> | null = null;
  try {
    pmeData = await getPmeAssignments();
  } catch (e) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <h2 className="text-lg font-semibold text-amber-900">Migration requise</h2>
        <p className="text-sm text-amber-800 mt-2">
          Exécutez la migration{' '}
          <code className="font-mono">115_pme_boutique_assignments.sql</code> dans Supabase SQL Editor.
        </p>
        <p className="text-xs text-amber-700 mt-2">{(e as Error).message}</p>
      </div>
    );
  }

  return (
    <AssignationsClient
      orgName={org?.name ?? 'Entreprise PME'}
      orgType="business"
      schoolData={null}
      ngoData={null}
      btpData={null}
      pmeData={pmeData}
      canManage={canManage}
    />
  );
}
