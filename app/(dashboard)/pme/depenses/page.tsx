import { requirePmePage } from '@/lib/pme/require-pme-page';
import { createPmeExpense, getPmeExpenses } from '@/lib/actions/pme';
import { PmeCrudPage } from '@/components/pme/pme-crud-page';
import { Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default async function Page() {
  const session = await requirePmePage('depenses');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];

  try {
    const expenses = await getPmeExpenses(session.profile.organization_id);
    for (const e of expenses) {
      items.push({
        id: e.id,
        title: e.category,
        subtitle: e.description ?? e.category,
        status: formatCurrency(Number(e.amount)),
        date: e.expense_date
          ? new Date(e.expense_date).toLocaleDateString('fr-FR')
          : '—',
      });
    }
  } catch {
    /* empty */
  }

  return (
    <PmeCrudPage
      title="Dépenses"
      description={`${items.length} dépense(s)`}
      icon={Wallet}
      items={items}
      emptyMessage="Aucune dépense."
      onCreate={createPmeExpense}
      fields={[
        { name: 'category', label: 'Catégorie', required: true, defaultValue: 'general' },
        { name: 'description', label: 'Description' },
        { name: 'amount', label: 'Montant (GNF)', type: 'number', required: true },
        { name: 'expense_date', label: 'Date', type: 'date' },
      ]}
    />
  );
}
