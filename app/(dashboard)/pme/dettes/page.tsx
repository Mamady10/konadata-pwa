import { requirePmePage } from '@/lib/pme/require-pme-page';
import {
  getPmeDebts,
  getPmeCustomers,
  createPmeDebt,
  addPmeDebtPayment,
  type PmeDebtRow,
} from '@/lib/actions/pme';
import { PmeDettesClient } from './pme-dettes-client';

export default async function Page() {
  const session = await requirePmePage('dettes');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const orgId = session.profile.organization_id;
  let debts: PmeDebtRow[] = [];
  let customers: Array<{ value: string; label: string }> = [];

  try {
    const [d, c] = await Promise.all([getPmeDebts(orgId), getPmeCustomers(orgId)]);
    debts = d;
    customers = c.map((x) => ({ value: x.id, label: x.name }));
  } catch {
    /* tables non migrées */
  }

  return (
    <PmeDettesClient
      debts={debts}
      customers={customers}
      onCreate={createPmeDebt}
      onAddPayment={addPmeDebtPayment}
    />
  );
}
