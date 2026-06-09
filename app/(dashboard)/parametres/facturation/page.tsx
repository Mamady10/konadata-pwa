import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { getOrganizationBillingStatus } from '@/lib/actions/billing';
import type { Organization } from '@/types/database';
import { getOrgType } from '@/types/database';
import { FacturationClient } from './facturation-client';
import { SchoolOnboardingPanel } from '@/components/school/school-onboarding-panel';

export default async function FacturationPage({
  searchParams,
}: {
  searchParams: Promise<{ blocked?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { status, error } = await getOrganizationBillingStatus();
  if (error || !status) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center space-y-2">
        <h1 className="text-lg font-semibold">Facturation</h1>
        <p className="text-muted-foreground">{error ?? 'Données indisponibles'}</p>
        <p className="text-xs text-muted-foreground">
          Appliquez les migrations 038 et 039 dans Supabase si besoin.
        </p>
      </div>
    );
  }

  const org = session.profile?.organizations as Organization | null;
  const params = await searchParams;

  const orgType = getOrgType(org);

  return (
    <div className="space-y-6">
      {orgType === 'school' && (
        <SchoolOnboardingPanel role={session.profile?.role} />
      )}
      <FacturationClient
        status={status}
        blocked={params.blocked === '1'}
        orgName={org?.name ?? 'Organisation'}
      />
    </div>
  );
}
