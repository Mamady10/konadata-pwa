import { getNgoProjects } from '@/lib/actions/ngo';
import { canManageAssignments } from '@/lib/actions/assignments';
import { projectStatusLabel } from '@/lib/sector/status-labels';
import { ProjetsClient } from './projets-client';
import { formatCurrency } from '@/lib/utils';
import { requireOngPage } from '@/lib/ong/require-ong-page';

export default async function Page() {
  const session = await requireOngPage('projets');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const isDirector = await canManageAssignments();

  let items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];
  try {
    const projects = await getNgoProjects(session.profile.organization_id);
    items = projects.map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: `${p.region ?? '—'} — Budget ${formatCurrency(Number(p.budget ?? 0))}`,
      status: projectStatusLabel(p.status),
      date: `${Math.round(Number(p.progress_pct ?? 0))}% avancement`,
    }));
  } catch {
    items = [];
  }

  return <ProjetsClient items={items} canCreate={isDirector} />;
}