import { getNgoCartography } from '@/lib/actions/ngo';
import { SectorPage } from '@/components/dashboard/sector-page';
import { requireOngPage } from '@/lib/ong/require-ong-page';
import { MapPin } from 'lucide-react';

export default async function Page() {
  const session = await requireOngPage('cartographie');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  let items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];
  try {
    const localities = await getNgoCartography(session.profile.organization_id);
    items = localities.map((l, i) => ({
      id: `${l.region}-${l.localite}-${i}`,
      title: l.localite,
      subtitle: `${l.projets} projet${l.projets !== 1 ? 's' : ''} — ${l.beneficiaires.toLocaleString('fr-FR')} bénéficiaires`,
      status: l.beneficiaires > 0 ? 'Couvert' : 'À compléter',
      date: l.region,
    }));
  } catch {
    items = [];
  }

  return (
    <SectorPage
      title="Cartographie"
      description="Couverture géographique des interventions"
      icon={MapPin}
      items={items}
      connected
      emptyMessage="Aucune localité couverte pour le moment."
    />
  );
}
