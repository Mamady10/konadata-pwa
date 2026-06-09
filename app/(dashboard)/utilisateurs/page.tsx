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
import type { Organization } from '@/types/database';
import { getOrgType } from '@/types/database';
import { SchoolOnboardingPanel } from '@/components/school/school-onboarding-panel';

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

  let users: { id: string; name: string; email: string; role: string; status: string; lastLogin: string }[] = [];
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
      role: p.role,
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
      />
    </div>
  );
}
