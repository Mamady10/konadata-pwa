import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { getOrganizationPrivacySettings } from '@/lib/actions/org-privacy';
import { ConfidentialiteClient } from './confidentialite-client';

export default async function ConfidentialitePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const role = session.profile?.role;
  const canManage =
    role === 'org_admin' || role === 'platform_admin' || role === 'deputy_director';

  const privacyResult = await getOrganizationPrivacySettings();
  const privacy = 'error' in privacyResult ? null : privacyResult;
  const privacyError = 'error' in privacyResult ? privacyResult.error : undefined;

  return (
    <ConfidentialiteClient
      canManage={canManage}
      privacy={privacy}
      privacyError={privacyError}
    />
  );
}
