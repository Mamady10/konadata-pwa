import { requirePmePage } from '@/lib/pme/require-pme-page';
import { getPmePurchases } from '@/lib/actions/pme';
import { paymentStatusLabel } from '@/lib/sector/status-labels';
import { SectorPage } from '@/components/dashboard/sector-page';
import { Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type SupplierRow = { name?: string } | null;

export default async function Page() {
  const session = await requirePmePage('achats');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];

  try {
    const purchases = await getPmePurchases(session.profile.organization_id);
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
    // empty
  }

  return (
    <SectorPage
      title="Achats"
      description={`${items.length} achat${items.length !== 1 ? 's' : ''}`}
      icon={Receipt}
      items={items}
      connected
      emptyMessage="Aucun achat enregistré."
    />
  );
}
