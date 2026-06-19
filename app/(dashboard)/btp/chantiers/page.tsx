import { getBtpSites } from '@/lib/actions/btp';
import { canManageAssignments } from '@/lib/actions/assignments';
import { getBtpPlanningRefsByOrg } from '@/lib/actions/btp-planning-ref';
import type { BtpSitePlanningRef } from '@/lib/btp/planning-ref';
import { siteStatusLabel } from '@/lib/sector/status-labels';
import { ChantiersClient } from './chantiers-client';
import { formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import { requireBtpPage } from '@/lib/btp/require-btp-page';

export default async function Page() {
  const session = await requireBtpPage('chantiers');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const isDirector = await canManageAssignments();

  let items: {
    id: string;
    title: string;
    subtitle: string;
    status: string;
    date?: string;
    schedule?: { taskCount: number; projectTitle: string | null; importedAt: string };
    planningRefs: BtpSitePlanningRef[];
    defaultPlanningRefSlot: 1 | 2;
  }[] = [];
  let description = 'Suivi des chantiers';

  try {
    const orgId = session.profile.organization_id;
    const [sites, planningRefsBySite, sitesMeta] = await Promise.all([
      getBtpSites(orgId),
      getBtpPlanningRefsByOrg(orgId),
      createClient().then(async (sb) => {
        const { data } = await sb
          .from('btp_sites')
          .select('id, default_planning_ref_slot')
          .eq('organization_id', orgId);
        return data ?? [];
      }),
    ]);
    const avg = sites.length
      ? sites.reduce((s, site) => s + Number(site.physical_progress ?? 0), 0) / sites.length
      : 0;

    const defaultBySite = new Map(
      sitesMeta.map((m) => [m.id as string, Number(m.default_planning_ref_slot ?? 1)])
    );

    items = sites.map((s) => {
      const refs = planningRefsBySite[s.id as string] ?? [];
      const msRef = refs.find((r) => r.sourceType === 'ms_project');
      return {
        id: s.id,
        title: s.name,
        subtitle: `${s.location ?? '—'} — Budget ${formatCurrency(Number(s.budget ?? 0))}`,
        status: siteStatusLabel(s.status),
        date: `${Math.round(Number(s.physical_progress ?? 0))}%${(s.delay_days ?? 0) > 0 ? ` — Retard ${s.delay_days}j` : ''}`,
        schedule: msRef
          ? {
              taskCount: msRef.tasks.length,
              projectTitle: msRef.projectTitle,
              importedAt: msRef.updatedAt,
            }
          : undefined,
        planningRefs: refs,
        defaultPlanningRefSlot: (defaultBySite.get(s.id as string) === 2 ? 2 : 1) as 1 | 2,
      };
    });

    description = `${sites.length} chantier${sites.length !== 1 ? 's' : ''} — Taux avancement moyen : ${avg.toFixed(1)}%`;
  } catch {
    items = [];
  }

  return <ChantiersClient items={items} description={description} canCreate={isDirector} />;
}
