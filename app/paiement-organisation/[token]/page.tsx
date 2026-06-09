import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';
import { getBillingOfferByToken } from '@/lib/actions/billing';
import { PaiementOrganisationClient } from './paiement-client';

export default async function PaiementOrganisationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?redirect=/paiement-organisation/${token}`);

  const { offer, error } = await getBillingOfferByToken(token);
  if (error || !offer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-muted-foreground">Lien de paiement invalide ou expiré.</p>
      </div>
    );
  }

  const orgId = session.profile?.organization_id;
  const role = session.profile?.role;

  return (
    <PaiementOrganisationClient
      token={token}
      offer={offer}
      orgId={orgId ?? ''}
      isOrgAdmin={role === 'org_admin'}
      isPlatformAdmin={role === 'platform_admin'}
    />
  );
}
