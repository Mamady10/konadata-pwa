import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { getBtpEquipment, getBtpStock } from '@/lib/actions/btp';
import { SectorPage } from '@/components/dashboard/sector-page';
import { Wrench } from 'lucide-react';

type SiteRow = { name?: string } | null;

export default async function Page() {
  const session = await requireBtpPage('materiels');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];

  try {
    const [equipment, stock] = await Promise.all([
      getBtpEquipment(session.profile.organization_id),
      getBtpStock(session.profile.organization_id),
    ]);

    for (const e of equipment) {
      const site = e.btp_sites as SiteRow;
      items.push({
        id: e.id,
        title: e.name,
        subtitle: `${e.type ?? 'Équipement'} — ${Number(e.hours_used ?? 0).toLocaleString('fr-FR')} h`,
        status: e.status === 'operational' ? 'Opérationnel' : String(e.status ?? '—'),
        date: site?.name ?? undefined,
      });
    }

    for (const s of stock) {
      items.push({
        id: s.id,
        title: s.item_name,
        subtitle: `${Number(s.quantity).toLocaleString('fr-FR')} ${s.unit ?? ''} (seuil ${Number(s.min_threshold).toLocaleString('fr-FR')})`,
        status: s.alert_level === 'critical' ? 'Critique' : s.alert_level === 'warning' ? 'Alerte' : 'Stock OK',
        date: undefined,
      });
    }
  } catch {
    // empty
  }

  return (
    <SectorPage
      title="Matériels"
      description="Équipements et stock de chantier"
      icon={Wrench}
      items={items}
      connected
      emptyMessage="Aucun matériel ou stock enregistré."
    />
  );
}
