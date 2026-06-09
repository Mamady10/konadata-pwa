import { getBtpSites } from '@/lib/actions/btp';
import { canManageAssignments } from '@/lib/actions/assignments';
import { siteStatusLabel } from '@/lib/sector/status-labels';
import { ChantiersClient } from './chantiers-client';
import { formatCurrency } from '@/lib/utils';
import { requireBtpPage } from '@/lib/btp/require-btp-page';

export default async function Page() {
  const session = await requireBtpPage('chantiers');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }

  const isDirector = await canManageAssignments();

  let items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];
  let description = 'Suivi des chantiers';

  try {
    const sites = await getBtpSites(session.profile.organization_id);
    const avg = sites.length
      ? sites.reduce((s, site) => s + Number(site.physical_progress ?? 0), 0) / sites.length
      : 0;

    items = sites.map((s) => ({
      id: s.id,
      title: s.name,
      subtitle: `${s.location ?? '—'} — Budget ${formatCurrency(Number(s.budget ?? 0))}`,
      status: siteStatusLabel(s.status),
      date: `${Math.round(Number(s.physical_progress ?? 0))}%${(s.delay_days ?? 0) > 0 ? ` — Retard ${s.delay_days}j` : ''}`,
    }));

    description = `${sites.length} chantier${sites.length !== 1 ? 's' : ''} — Taux avancement moyen : ${avg.toFixed(1)}%`;
  } catch {
    items = [];
  }

  return <ChantiersClient items={items} description={description} canCreate={isDirector} />;
}
