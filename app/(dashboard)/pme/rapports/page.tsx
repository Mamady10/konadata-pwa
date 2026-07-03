import { requirePmePage } from '@/lib/pme/require-pme-page';
import { getPmeDashboardKpis } from '@/lib/actions/data';
import { getPmeBoutiques } from '@/lib/actions/pme';
import { PmeRapportsClient } from './pme-rapports-client';
import { formatCurrency } from '@/lib/utils';

export default async function Page() {
  const session = await requirePmePage('rapports');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];

  let boutiques: { id: string; name: string }[] = [];
  try {
    boutiques = (await getPmeBoutiques(session.profile.organization_id)).map((b) => ({
      id: b.id,
      name: b.name,
    }));
  } catch {
    /* table non migrée */
  }

  try {
    const kpis = await getPmeDashboardKpis(session.profile.organization_id);
    items.push(
      {
        id: 'ca',
        title: 'Chiffre d\'affaires',
        subtitle: `${kpis.totalSales} vente(s) enregistrée(s)`,
        status: formatCurrency(kpis.revenue),
      },
      {
        id: 'dep',
        title: 'Total dépenses',
        subtitle: 'Charges opérationnelles',
        status: formatCurrency(kpis.totalExpenses),
      },
      {
        id: 'res',
        title: 'Résultat net',
        subtitle: 'CA − dépenses',
        status: formatCurrency(kpis.profit),
      },
      {
        id: 'cre',
        title: 'Créances clients',
        subtitle: 'Soldes à recouvrer',
        status: formatCurrency(kpis.receivables),
      },
      {
        id: 'stk',
        title: 'Alertes stock',
        subtitle: `${kpis.totalProducts} références`,
        status: `${kpis.lowStockItems} sous seuil`,
      }
    );
  } catch {
    // empty
  }

  return <PmeRapportsClient items={items} boutiques={boutiques} />;
}
