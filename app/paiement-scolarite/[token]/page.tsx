import { getSession } from '@/lib/actions/auth';
import { getStudentPaymentByToken } from '@/lib/actions/student-payments';
import { PaiementScolariteClient } from './paiement-scolarite-client';

export default async function PaiementScolaritePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getSession();

  const { payment, error } = await getStudentPaymentByToken(token);
  if (error || !payment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-muted-foreground">Lien de paiement invalide ou expiré.</p>
      </div>
    );
  }

  const role = session?.profile?.role;

  return (
    <PaiementScolariteClient
      token={token}
      payment={payment}
      isStaff={
        role === 'org_admin' ||
        role === 'platform_admin' ||
        role === 'deputy_director' ||
        role === 'registrar' ||
        role === 'accountant'
      }
      isPlatformAdmin={role === 'platform_admin'}
      isLoggedIn={Boolean(session?.user)}
    />
  );
}
