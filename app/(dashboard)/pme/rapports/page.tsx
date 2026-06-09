import { requirePmePage } from '@/lib/pme/require-pme-page';
import { getPmeDashboardKpis } from '@/lib/actions/data';
import { SectorPage } from '@/components/dashboard/sector-page';
import { FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default async function Page() {
  const session = await requirePmePage('rapports');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];

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

  return (
    <SectorPage
      title="Rapports"
      description="Synthèse commerciale"
      icon={FileText}
      items={items}
      connected
      emptyMessage="Aucune donnée pour générer les rapports."
    />
  );
}
