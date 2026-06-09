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
  const orgType = (session.profile?.organizations as { type?: string } | null)?.type;

  const quotaResult = await getMyOrganizationAiQuota();
  const aiQuota = 'error' in quotaResult ? null : quotaResult;
  const aiQuotaError = 'error' in quotaResult ? quotaResult.error : undefined;

  const privacyResult = await getOrganizationPrivacySettings();
  const privacy = 'error' in privacyResult ? null : privacyResult;

  return (
    <ParametresClient
      phone={phone}
      canManageTemplates={canManageTemplates}
      canManageBilling={canManageBilling}
      canManageStudentPayments={canManageStudentPayments && orgType === 'school'}
      canManageMatricules={canManageMatricules && orgType === 'school'}
      canManageBulletinTemplate={canManageBulletinTemplate && orgType === 'school'}
      canManageNgoSurveys={canManageNgoSurveys && orgType === 'ngo'}
      aiQuota={aiQuota}
      aiQuotaError={aiQuotaError}
      konaAiDisabled={privacy?.konaAiDisabled ?? false}
      dpaUpToDate={privacy?.dpaUpToDate ?? false}
      canManagePrivacy={canManageBilling}
    />
  );
}
