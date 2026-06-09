import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { getNgoSurveyChargeByToken } from '@/lib/actions/ngo-survey-billing';
import { PaiementSondageClient } from './paiement-sondage-client';

export default async function PaiementSondagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?redirect=/paiement-sondage/${token}`);

  const { charge, error } = await getNgoSurveyChargeByToken(token);
  if (error || !charge) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-muted-foreground">Lien de paiement invalide ou expiré.</p>
      </div>
    );
  }

  const orgId = session.profile?.organization_id ?? '';
  const role = session.profile?.role;

  return (
    <PaiementSondageClient
      token={token}
      charge={charge}
      orgId={orgId}
      isOrgAdmin={role === 'org_admin' || role === 'deputy_director'}
      isPlatformAdmin={role === 'platform_admin'}
    />
  );
}
