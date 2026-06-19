import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { getBtpDeliveryNotes, getBtpSites } from '@/lib/actions/btp';
import { formatCurrency } from '@/lib/utils';
import {
  BTP_ITEM_CATEGORY_LABELS,
  formatDeliveryItemsSummary,
  parseDeliveryNoteItems,
  type BtpItemCategory,
} from '@/lib/btp/delivery-note-types';
import { BonsClient } from './bons-client';

export default async function Page() {
  const session = await requireBtpPage('bons');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }
  const orgId = session.profile.organization_id;

  let items: {
    id: string;
    title: string;
    subtitle: string;
    status: string;
    date?: string;
    categoryLabel?: string;
    description?: string;
  }[] = [];
  let sites: { id: string; name: string }[] = [];

  try {
    const [notes, siteRows] = await Promise.all([
      getBtpDeliveryNotes(orgId),
      getBtpSites(orgId),
    ]);
    sites = siteRows.map((s) => ({ id: s.id, name: s.name }));
    items = notes.map((n) => {
      const parsedItems = parseDeliveryNoteItems(n.items);
      const cat = n.category as BtpItemCategory | null;
      const itemsSummary = formatDeliveryItemsSummary(parsedItems);
      return {
        id: n.id,
        title: n.reference,
        subtitle: `${n.supplier ?? '—'} — ${formatCurrency(Number(n.total_amount ?? 0))}${itemsSummary !== '—' ? ` · ${itemsSummary}` : ''}`,
        status: 'Validé',
        date: n.delivery_date
          ? new Date(n.delivery_date).toLocaleDateString('fr-FR')
          : new Date(n.created_at as string).toLocaleDateString('fr-FR'),
        categoryLabel: cat ? BTP_ITEM_CATEGORY_LABELS[cat] : undefined,
        description: (n.description as string) || undefined,
      };
    });
  } catch {
    items = [];
    sites = [];
  }

  return <BonsClient items={items} sites={sites} />;
}
