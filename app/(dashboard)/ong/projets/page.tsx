import { getNgoProjects } from '@/lib/actions/ngo';
import { canManageAssignments } from '@/lib/actions/assignments';
import { ProjetsClient } from './projets-client';
import { requireOngPage } from '@/lib/ong/require-ong-page';

export default async function Page() {
  const session = await requireOngPage('projets');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const isDirector = await canManageAssignments();
  let projects: Awaited<ReturnType<typeof getNgoProjects>> = [];

  try {
    projects = await getNgoProjects(session.profile.organization_id);
  } catch {
    projects = [];
  }

  return (
    <ProjetsClient
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        region: p.region,
        locality: p.locality,
        budget: Number(p.budget ?? 0),
        spent: Number(p.spent ?? 0),
        status: p.status as string,
        progress_pct: Number(p.progress_pct ?? 0),
        beneficiaries: Number(p.beneficiaries ?? 0),
      }))}
      canEdit={isDirector}
    />
  );
}
