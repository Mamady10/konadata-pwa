import { requirePmePage } from '@/lib/pme/require-pme-page';
import { createPmeExpense, getPmeExpenses, getPmeBoutiques } from '@/lib/actions/pme';
import { PmeCrudPage } from '@/components/pme/pme-crud-page';
import { formatCurrency } from '@/lib/utils';

export default async function Page() {
  const session = await requirePmePage('depenses');
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
    const expenses = await getPmeExpenses(orgId);
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
      icon="wallet"
      items={items}
      emptyMessage="Aucune dépense."
      onCreate={createPmeExpense}
      fields={[
        { name: 'category', label: 'Catégorie', required: true, defaultValue: 'general' },
        { name: 'description', label: 'Description' },
        { name: 'amount', label: 'Montant (GNF)', type: 'number', required: true },
        { name: 'expense_date', label: 'Date', type: 'date' },
        ...(boutiques.length > 0
          ? [{ name: 'boutique_id', label: 'Boutique', type: 'select' as const, options: boutiques }]
          : []),
      ]}
    />
  );
}
