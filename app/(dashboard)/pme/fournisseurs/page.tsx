import { requirePmePage } from '@/lib/pme/require-pme-page';
import { createPmeSupplier, getPmeSuppliers } from '@/lib/actions/pme';
import { PmeCrudPage } from '@/components/pme/pme-crud-page';
import { Truck } from 'lucide-react';

export default async function Page() {
  const session = await requirePmePage('fournisseurs');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const items: { id: string; title: string; subtitle: string; status: string }[] = [];

  try {
    const suppliers = await getPmeSuppliers(session.profile.organization_id);
    for (const s of suppliers) {
      items.push({
        id: s.id,
        title: s.name,
        subtitle: [s.phone, s.email].filter(Boolean).join(' · ') || '—',
        status: s.is_active ? 'Actif' : 'Inactif',
      });
    }
  } catch {
    /* empty */
  }

  return (
    <PmeCrudPage
      title="Fournisseurs"
      description={`${items.length} fournisseur(s)`}
      icon={Truck}
      items={items}
      emptyMessage="Aucun fournisseur."
      onCreate={createPmeSupplier}
      fields={[
        { name: 'name', label: 'Nom', required: true },
        { name: 'phone', label: 'Téléphone' },
        { name: 'email', label: 'Email' },
      ]}
    />
  );
}
