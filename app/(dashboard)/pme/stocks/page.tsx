import { requirePmePage } from '@/lib/pme/require-pme-page';
import { getPmeProducts } from '@/lib/actions/pme';
import { SectorPage } from '@/components/dashboard/sector-page';
import { Package } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default async function Page() {
  const session = await requirePmePage('stocks');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];

  try {
    const products = await getPmeProducts(session.profile.organization_id);
    for (const p of products) {
      const stock = Number(p.stock_quantity);
      const min = Number(p.min_stock);
      const low = stock <= min;
      items.push({
        id: p.id,
        title: p.name,
        subtitle: `${stock.toLocaleString('fr-FR')} ${p.unit ?? ''} — Prix ${formatCurrency(Number(p.unit_price))}`,
        status: low ? 'Stock bas' : 'OK',
        date: p.sku ?? undefined,
      });
    }
  } catch {
    // empty
  }

  return (
    <SectorPage
      title="Stocks"
      description={`${items.length} article${items.length !== 1 ? 's' : ''} en catalogue`}
      icon={Package}
      items={items}
      connected
      emptyMessage="Aucun produit en stock."
    />
  );
}
