import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { getBtpFuelLogs, getBtpSites } from '@/lib/actions/btp';
import { CarburantClient } from './carburant-client';
import { formatCurrency } from '@/lib/utils';
type SiteRow = { name?: string } | null;

export default async function Page() {
  const session = await requireBtpPage('carburant');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }
  const orgId = session.profile.organization_id;

  let items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];
  let sites: { id: string; name: string }[] = [];
  let totalLiters = 0;

  try {
    const [logs, siteRows] = await Promise.all([getBtpFuelLogs(orgId), getBtpSites(orgId)]);
    sites = siteRows.map((s) => ({ id: s.id, name: s.name }));
    totalLiters = logs.reduce((s, l) => s + Number(l.liters ?? 0), 0);
    items = logs.map((l) => {
      const site = l.btp_sites as SiteRow;
      return {
        id: l.id,
        title: site?.name ?? 'Chantier',
        subtitle: `${Number(l.liters).toLocaleString('fr-FR')} L — ${formatCurrency(Number(l.cost ?? 0))}`,
        status: l.is_anomaly ? 'Alerte' : 'Normal',
        date: new Date(l.logged_at as string).toLocaleDateString('fr-FR'),
      };
    });
  } catch {
    items = [];
  }

  return <CarburantClient items={items} sites={sites} totalLiters={totalLiters} />;
}
