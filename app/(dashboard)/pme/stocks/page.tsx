import { requirePmePage } from '@/lib/pme/require-pme-page';
import { createPmeProduct, getPmeProducts, getPmeBoutiques } from '@/lib/actions/pme';
import { PmeCrudPage } from '@/components/pme/pme-crud-page';
import { formatCurrency } from '@/lib/utils';

export default async function Page() {
  const session = await requirePmePage('stocks');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const orgId = session.profile.organization_id;
  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];
  let boutiques: Array<{ value: string; label: string }> = [];

  try {
    boutiques = (await getPmeBoutiques(orgId)).map((b) => ({ value: b.id, label: b.name }));
  } catch {
    /* table non migrée */
  }

  try {
    const products = await getPmeProducts(orgId);
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
      icon="boxes"
      items={items}
      emptyMessage="Aucun article en stock."
      onCreate={createPmeProduct}
      addLabel="Nouvel article"
      fields={[
        { name: 'name', label: 'Nom', required: true },
        ...(boutiques.length > 0
          ? [{ name: 'boutique_id', label: 'Boutique', type: 'select' as const, options: boutiques }]
          : []),
        { name: 'sku', label: 'SKU / code' },
        { name: 'unit', label: 'Unité', defaultValue: 'unité' },
        { name: 'unit_price', label: 'Prix unitaire', type: 'number' },
        { name: 'stock_quantity', label: 'Quantité en stock', type: 'number', defaultValue: '0' },
        { name: 'min_stock', label: 'Seuil alerte', type: 'number', defaultValue: '0' },
      ]}
    />
  );
}
