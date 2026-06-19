import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { getBtpDeliveryNotes, getBtpSites } from '@/lib/actions/btp';
import { formatCurrency } from '@/lib/utils';
import { BonsClient } from './bons-client';

export default async function Page() {
  const session = await requireBtpPage('bons');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }
  const orgId = session.profile.organization_id;

  let items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];
  let sites: { id: string; name: string }[] = [];

  try {
    const [notes, siteRows] = await Promise.all([
      getBtpDeliveryNotes(orgId),
      getBtpSites(orgId),
    ]);
    sites = siteRows.map((s) => ({ id: s.id, name: s.name }));
    items = notes.map((n) => ({
      id: n.id,
      title: n.reference,
      subtitle: `${n.supplier ?? '—'} — ${formatCurrency(Number(n.total_amount ?? 0))}`,
      status: 'Validé',
      date: n.delivery_date
        ? new Date(n.delivery_date).toLocaleDateString('fr-FR')
        : new Date(n.created_at as string).toLocaleDateString('fr-FR'),
    }));
  } catch {
    items = [];
    sites = [];
  }

  return <BonsClient items={items} sites={sites} />;
}
