import { requirePmePage } from '@/lib/pme/require-pme-page';
import { getPmeCustomers } from '@/lib/actions/pme';
import { SectorPage } from '@/components/dashboard/sector-page';
import { UserCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default async function Page() {
  const session = await requirePmePage('clients');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];

  try {
    const customers = await getPmeCustomers(session.profile.organization_id);
    for (const c of customers) {
      items.push({
        id: c.id,
        title: c.name,
        subtitle: c.phone ?? c.email ?? '—',
        status: c.is_active ? 'Actif' : 'Inactif',
        date:
          Number(c.balance) > 0 ? `Créance ${formatCurrency(Number(c.balance))}` : undefined,
      });
    }
  } catch {
    // empty
  }

  return (
    <SectorPage
      title="Clients"
      description={`${items.length} client${items.length !== 1 ? 's' : ''}`}
      icon={UserCircle}
      items={items}
      connected
      emptyMessage="Aucun client enregistré."
    />
  );
}
