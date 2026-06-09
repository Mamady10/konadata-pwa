import { redirect } from 'next/navigation';
import { AssignationsClient } from '@/app/(dashboard)/utilisateurs/assignations/assignations-client';
import type { Organization } from '@/types/database';
import { getBtpAssignments, canManageAssignments } from '@/lib/actions/assignments';
import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { isBtpDirector } from '@/lib/btp/btp-access';
import type { AppRole } from '@/types/database';

export default async function BtpAssignationsPage() {
  const session = await requireBtpPage('assignations');
  const role = session.profile?.role as AppRole | undefined;
  if (!isBtpDirector(role)) {
    redirect('/btp');
  }

  const org = session.profile?.organizations as Organization | null;
  const canManage = await canManageAssignments().catch(() => false);

  let btpData: Awaited<ReturnType<typeof getBtpAssignments>> | null = null;
  try {
    btpData = await getBtpAssignments();
  } catch (e) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <h2 className="text-lg font-semibold text-amber-900">Migration requise</h2>
        <p className="text-sm text-amber-800 mt-2">
          Exécutez <code className="font-mono">017-F4-btp-assignments-ONLY.sql</code> dans Supabase SQL Editor.
        </p>
        <p className="text-xs text-amber-700 mt-2">{(e as Error).message}</p>
      </div>
    );
  }

  return (
    <AssignationsClient
      orgName={org?.name ?? 'Organisation BTP'}
      orgType="btp"
      schoolData={null}
      ngoData={null}
      btpData={btpData}
      canManage={canManage}
    />
  );
}
