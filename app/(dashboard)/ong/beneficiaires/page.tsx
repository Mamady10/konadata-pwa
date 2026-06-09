import { getNgoBeneficiaries } from '@/lib/actions/ngo';
import { BeneficiairesClient } from './beneficiaires-client';
import { requireOngPage } from '@/lib/ong/require-ong-page';

type PersonRow = { full_name?: string; gender?: string } | null;

export default async function Page() {
  const session = await requireOngPage('beneficiaires');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  let items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];
  try {
    const rows = await getNgoBeneficiaries(session.profile.organization_id);
    items = rows.map((b) => {
      const person = b.core_persons as PersonRow;
      return {
        id: b.id,
        title: person?.full_name ?? 'Bénéficiaire',
        subtitle: `${b.region ?? '—'} — ${b.category ?? 'Non classé'}`,
        status: 'Actif',
        date: b.locality ?? undefined,
      };
    });
  } catch {
    items = [];
  }

  return <BeneficiairesClient items={items} />;
}
