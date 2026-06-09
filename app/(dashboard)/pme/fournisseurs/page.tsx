import { requirePmePage } from '@/lib/pme/require-pme-page';
import { getPmeSuppliers } from '@/lib/actions/pme';
import { SectorPage } from '@/components/dashboard/sector-page';
import { Truck } from 'lucide-react';

export default async function Page() {
  const session = await requirePmePage('fournisseurs');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];

  try {
    const suppliers = await getPmeSuppliers(session.profile.organization_id);
    for (const s of suppliers) {
      items.push({
        id: s.id,
        title: s.name,
        subtitle: s.phone ?? s.email ?? '—',
        status: s.is_active ? 'Actif' : 'Inactif',
      });
    }
  } catch {
    // empty
  }

  return (
    <SectorPage
      title="Fournisseurs"
      description={`${items.length} fournisseur${items.length !== 1 ? 's' : ''}`}
      icon={Truck}
      items={items}
      connected
      emptyMessage="Aucun fournisseur enregistré."
    />
  );
}
