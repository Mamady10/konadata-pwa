import { requirePmePage } from '@/lib/pme/require-pme-page';
import { createPmeSale, getPmeSales, getPmeCustomers } from '@/lib/actions/pme';
import { paymentStatusLabel } from '@/lib/sector/status-labels';
import { PmeCrudPage } from '@/components/pme/pme-crud-page';
import { ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type CustomerRow = { name?: string; id?: string } | null;

export default async function Page() {
  const session = await requirePmePage('ventes');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const orgId = session.profile.organization_id;
  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];
  let customers: Array<{ value: string; label: string }> = [];

  try {
    const [sales, cust] = await Promise.all([getPmeSales(orgId), getPmeCustomers(orgId)]);
    customers = cust.map((c) => ({ value: c.id, label: c.name }));
    for (const s of sales) {
      const customer = s.pme_customers as CustomerRow;
      items.push({
        id: s.id,
        title: s.reference,
        subtitle: `${customer?.name ?? 'Client —'} — ${formatCurrency(Number(s.total))}`,
        status: paymentStatusLabel(s.payment_status),
        date: new Date(s.sold_at as string).toLocaleDateString('fr-FR'),
      });
    }
  } catch {
    /* empty */
  }

  return (
    <PmeCrudPage
      title="Ventes"
      description={`${items.length} vente(s) enregistrée(s)`}
      icon={ShoppingCart}
      items={items}
      emptyMessage="Aucune vente. Cliquez sur Ajouter pour enregistrer une vente."
      onCreate={createPmeSale}
      addLabel="Nouvelle vente"
      fields={[
        { name: 'reference', label: 'Référence' },
        { name: 'total', label: 'Montant (GNF)', type: 'number', required: true },
        {
          name: 'customer_id',
          label: 'Client',
          type: 'select',
          options: customers,
        },
        {
          name: 'payment_status',
          label: 'Paiement',
          type: 'select',
          defaultValue: 'pending',
          options: [
            { value: 'pending', label: 'En attente' },
            { value: 'paid', label: 'Payé' },
            { value: 'partial', label: 'Partiel' },
          ],
        },
        { name: 'notes', label: 'Notes' },
      ]}
    />
  );
}
