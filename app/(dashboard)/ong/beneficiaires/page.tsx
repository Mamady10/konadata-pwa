import { getNgoBeneficiaries, getNgoProjects } from '@/lib/actions/ngo';
import { BeneficiairesClient } from './beneficiaires-client';
import { requireOngPage } from '@/lib/ong/require-ong-page';

type PersonRow = { full_name?: string; gender?: string; email?: string; phone?: string } | null;
type ProjectRow = { name?: string } | null;

export default async function Page() {
  const session = await requireOngPage('beneficiaires');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const orgId = session.profile.organization_id;
  let rows: Awaited<ReturnType<typeof getNgoBeneficiaries>> = [];
  let projectOptions: Array<{ id: string; name: string }> = [];

  try {
    const [beneficiaries, projects] = await Promise.all([getNgoBeneficiaries(orgId), getNgoProjects(orgId)]);
    rows = beneficiaries;
    projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));
  } catch {
    rows = [];
  }

  const items = rows.map((b) => {
    const person = b.core_persons as PersonRow;
    const project = b.ngo_projects as ProjectRow;
    const contact = [person?.phone, person?.email].filter(Boolean).join(' · ');
    return {
      id: b.id as string,
      fullName: person?.full_name ?? 'Bénéficiaire',
      gender: person?.gender ?? null,
      email: person?.email ?? null,
      phone: person?.phone ?? null,
      region: (b.region as string) ?? null,
      locality: (b.locality as string) ?? null,
      category: (b.category as string) ?? null,
      projectId: (b.project_id as string) ?? null,
      projectName: project?.name ?? null,
      subtitle: [b.region, b.category, project?.name].filter(Boolean).join(' — ') || 'Non classé',
      contact,
    };
  });

  return <BeneficiairesClient items={items} projects={projectOptions} />;
}
