import { requirePmePage } from '@/lib/pme/require-pme-page';
import { createPmeProduct, getPmeProducts } from '@/lib/actions/pme';
import { PmeCrudPage } from '@/components/pme/pme-crud-page';
import { Boxes } from 'lucide-react';
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
      items.push({
        id: p.id,
        title: p.name,
        subtitle: `Stock ${stock} ${p.unit ?? ''} · ${formatCurrency(Number(p.unit_price))}`,
        status: stock <= min ? 'Stock bas' : 'OK',
      });
    }
  } catch {
    /* empty */
  }

  return (
    <PmeCrudPage
      title="Stocks"
      description={`${items.length} article(s)`}
      icon={Boxes}
      items={items}
      emptyMessage="Aucun article en stock."
      onCreate={createPmeProduct}
      addLabel="Nouvel article"
      fields={[
        { name: 'name', label: 'Nom', required: true },
        { name: 'sku', label: 'SKU / code' },
        { name: 'unit', label: 'Unité', defaultValue: 'unité' },
        { name: 'unit_price', label: 'Prix unitaire', type: 'number' },
        { name: 'stock_quantity', label: 'Quantité en stock', type: 'number', defaultValue: '0' },
        { name: 'min_stock', label: 'Seuil alerte', type: 'number', defaultValue: '0' },
      ]}
    />
  );
}
