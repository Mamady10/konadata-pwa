import { requirePmePage } from '@/lib/pme/require-pme-page';
import { createPmeCustomer, getPmeCustomers } from '@/lib/actions/pme';
import { PmeCrudPage } from '@/components/pme/pme-crud-page';
import { Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default async function Page() {
  const session = await requirePmePage('clients');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const items: { id: string; title: string; subtitle: string; status: string }[] = [];

  try {
    const customers = await getPmeCustomers(session.profile.organization_id);
    for (const c of customers) {
      items.push({
        id: c.id,
        title: c.name,
        subtitle: [c.phone, c.email].filter(Boolean).join(' · ') || '—',
        status: Number(c.balance) > 0 ? `Dû ${formatCurrency(Number(c.balance))}` : 'À jour',
      });
    }
  } catch {
    /* empty */
  }

  return (
    <PmeCrudPage
      title="Clients"
      description={`${items.length} client(s)`}
      icon={Users}
      items={items}
      emptyMessage="Aucun client."
      onCreate={createPmeCustomer}
      addLabel="Nouveau client"
      fields={[
        { name: 'name', label: 'Nom', required: true },
        { name: 'phone', label: 'Téléphone' },
        { name: 'email', label: 'Email' },
      ]}
    />
  );
}
