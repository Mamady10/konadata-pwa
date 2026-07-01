import { getSession } from '@/lib/actions/auth';
import { canManageAssignments } from '@/lib/actions/assignments';
import { getMyOrganizationAiQuota } from '@/lib/actions/ai-quota';
import { getOrganizationPrivacySettings } from '@/lib/actions/org-privacy';
import { ParametresClient } from './parametres-client';
import { redirect } from 'next/navigation';

export default async function ParametresPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const phone = session.profile?.phone as string | null | undefined;
  const canManageTemplates = await canManageAssignments();
  const role = session.profile?.role;
  const canManageBilling =
    role === 'org_admin' || role === 'platform_admin' || role === 'deputy_director';
  const canManageStudentPayments =
    role === 'org_admin' ||
    role === 'platform_admin' ||
    role === 'deputy_director' ||
    role === 'registrar';
  const canManageMatricules =
    role === 'org_admin' ||
    role === 'platform_admin' ||
    role === 'deputy_director' ||
    role === 'registrar';
  const canManageNgoSurveys =
    role === 'org_admin' || role === 'platform_admin' || role === 'deputy_director';
  const canManageBulletinTemplate =
    role === 'org_admin' || role === 'platform_admin' || role === 'deputy_director';
  const orgId = session.profile?.organization_id;
  const isPlatformAdmin = role === 'platform_admin';
  const orgType = (session.profile?.organizations as { type?: string } | null)?.type;
  const hasOrg = Boolean(orgId);

  let aiQuota = null;
  let aiQuotaError: string | undefined;
  let privacy: Awaited<ReturnType<typeof getOrganizationPrivacySettings>> | null = null;

  if (hasOrg) {
    try {
      const quotaResult = await getMyOrganizationAiQuota();
      aiQuota = quotaResult;
    } catch (e) {
      aiQuotaError = e instanceof Error ? e.message : 'Quota indisponible';
    }

    const privacyResult = await getOrganizationPrivacySettings();
    privacy = 'error' in privacyResult ? null : privacyResult;
    if ('error' in privacyResult) {
      aiQuotaError = aiQuotaError ?? privacyResult.error;
    }
  }

  return (
    <ParametresClient
      phone={phone}
      isPlatformAdmin={isPlatformAdmin}
      canManageTemplates={canManageTemplates && hasOrg}
      canManageBilling={canManageBilling && hasOrg}
      canManageStudentPayments={canManageStudentPayments && orgType === 'school'}
      canManageMatricules={canManageMatricules && orgType === 'school'}
      canManageBulletinTemplate={canManageBulletinTemplate && orgType === 'school'}
      canManageNgoSurveys={canManageNgoSurveys && orgType === 'ngo'}
      aiQuota={aiQuota}
      aiQuotaError={hasOrg ? aiQuotaError : undefined}
      konaAiDisabled={privacy?.konaAiDisabled ?? false}
      dpaUpToDate={privacy?.dpaUpToDate ?? false}
      canManagePrivacy={canManageBilling && hasOrg}
      canRenameOrganization={role === 'org_admin' && hasOrg}
    />
  );
}
