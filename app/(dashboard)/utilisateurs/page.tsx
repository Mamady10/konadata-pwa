import { getSession } from '@/lib/actions/auth';
import { getOrgProfiles } from '@/lib/actions/profile';
import {
  listAccessCodes,
  getAccessCodesIssueStatus,
  getOrgResponsablesCount,
  type AccessCodesIssueStatus,
} from '@/lib/actions/access-codes';
import { UtilisateursClient } from './utilisateurs-client';
import { redirect } from 'next/navigation';
import type { AppRole, Organization } from '@/types/database';
import { getOrgType } from '@/types/database';
import { SchoolOnboardingPanel } from '@/components/school/school-onboarding-panel';
import { isSyntheticPhoneEmail } from '@/lib/auth/phone-email';

export default async function UtilisateursPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const orgId = session.profile?.organization_id;
  const role = session.profile?.role;
  const org = session.profile?.organizations as Organization | null;
  const orgType = getOrgType(org) ?? 'school';

  if (!orgId || !['org_admin', 'platform_admin', 'deputy_director'].includes(role ?? '')) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <h2 className="text-lg font-semibold">Accès restreint</h2>
        <p className="text-muted-foreground mt-2">Seuls les administrateurs peuvent gérer les utilisateurs.</p>
      </div>
    );
  }

  let users: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    isPhoneAccount: boolean;
    role: AppRole;
    status: string;
    lastLogin: string;
  }[] = [];
  let accessCodes: Awaited<ReturnType<typeof listAccessCodes>> = [];
  let canIssue = false;
  let issueStatus: AccessCodesIssueStatus = { allowed: false };
  let responsablesCount = 0;

  try {
    const [rows, codes, issue, respCount] = await Promise.all([
      getOrgProfiles(orgId),
      listAccessCodes().catch(() => []),
      getAccessCodesIssueStatus(),
      getOrgResponsablesCount(orgId),
    ]);
    users = rows.map((p) => ({
      id: p.id,
      name: p.full_name,
      email: p.email,
      phone: (p.phone as string | null) ?? null,
      isPhoneAccount: isSyntheticPhoneEmail(p.email) || Boolean((p.phone as string | null)?.trim()),
      role: p.role as AppRole,
      status: p.is_active ? 'Actif' : 'Inactif',
      lastLogin: p.last_login_at
        ? new Date(p.last_login_at).toLocaleDateString('fr-FR')
        : '—',
    }));
    accessCodes = codes;
    issueStatus = issue;
    canIssue = issue.allowed;
    responsablesCount = respCount;
  } catch {
    users = [];
  }

  return (
    <div className="space-y-6">
      {orgType === 'school' && <SchoolOnboardingPanel role={role} compact />}
      <UtilisateursClient
        users={users}
        orgName={org?.name ?? 'Organisation'}
        orgType={orgType}
        accessCodes={accessCodes}
        canIssueCodes={canIssue}
        issueStatus={issueStatus}
        responsablesCount={responsablesCount}
        isOrgAdmin={role === 'org_admin'}
        actorRole={(role ?? 'teacher') as AppRole}
        actorId={session.user.id}
      />
    </div>
  );
}
