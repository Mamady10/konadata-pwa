import { requirePmePage } from '@/lib/pme/require-pme-page';
import { getPmeSales } from '@/lib/actions/pme';
import { paymentStatusLabel } from '@/lib/sector/status-labels';
import { SectorPage } from '@/components/dashboard/sector-page';
import { ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type CustomerRow = { name?: string } | null;

export default async function Page() {
  const session = await requirePmePage('ventes');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];

  try {
    const sales = await getPmeSales(session.profile.organization_id);
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
    // empty
  }

  return (
    <SectorPage
      title="Ventes"
      description={`${items.length} vente${items.length !== 1 ? 's' : ''} enregistrée${items.length !== 1 ? 's' : ''}`}
      icon={ShoppingCart}
      items={items}
      connected
      emptyMessage="Aucune vente enregistrée."
    />
  );
}
