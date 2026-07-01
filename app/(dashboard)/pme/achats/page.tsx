import { requirePmePage } from '@/lib/pme/require-pme-page';
import { createPmePurchase, getPmePurchases, getPmeSuppliers } from '@/lib/actions/pme';
import { paymentStatusLabel } from '@/lib/sector/status-labels';
import { PmeCrudPage } from '@/components/pme/pme-crud-page';
import { Package } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type SupplierRow = { name?: string } | null;

export default async function Page() {
  const session = await requirePmePage('achats');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const orgId = session.profile.organization_id;
  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];
  let suppliers: Array<{ value: string; label: string }> = [];

  try {
    const [purchases, sup] = await Promise.all([getPmePurchases(orgId), getPmeSuppliers(orgId)]);
    suppliers = sup.map((s) => ({ value: s.id, label: s.name }));
    for (const p of purchases) {
      const supplier = p.pme_suppliers as SupplierRow;
      items.push({
        id: p.id,
        title: p.reference,
        subtitle: `${supplier?.name ?? 'Fournisseur —'} — ${formatCurrency(Number(p.total))}`,
        status: paymentStatusLabel(p.payment_status),
        date: new Date(p.purchased_at as string).toLocaleDateString('fr-FR'),
      });
    }
  } catch {
    /* empty */
  }

  return (
    <PmeCrudPage
      title="Achats"
      description={`${items.length} achat(s)`}
      icon={Package}
      items={items}
      emptyMessage="Aucun achat enregistré."
      onCreate={createPmePurchase}
      fields={[
        { name: 'reference', label: 'Référence' },
        { name: 'total', label: 'Montant (GNF)', type: 'number', required: true },
        { name: 'supplier_id', label: 'Fournisseur', type: 'select', options: suppliers },
        {
          name: 'payment_status',
          label: 'Paiement',
          type: 'select',
          defaultValue: 'pending',
          options: [
            { value: 'pending', label: 'En attente' },
            { value: 'paid', label: 'Payé' },
          ],
        },
      ]}
    />
  );
}
