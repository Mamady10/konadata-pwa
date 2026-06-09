import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { getBtpPersonnel, getBtpSites } from '@/lib/actions/btp';
import { PersonnelClient } from './personnel-client';
import { formatCurrency } from '@/lib/utils';
type PersonRow = { full_name?: string; phone?: string } | null;
type SiteRow = { name?: string } | null;

export default async function Page() {
  const session = await requireBtpPage('personnel');
  if (!session.profile?.organization_id) {
    return <p className="text-muted-foreground">Organisation non configurée.</p>;
  }
  const orgId = session.profile.organization_id;

  let items: { id: string; title: string; subtitle: string; status: string; date?: string }[] = [];
  let sites: { id: string; name: string }[] = [];

  try {
    const [rows, siteRows] = await Promise.all([getBtpPersonnel(orgId), getBtpSites(orgId)]);
    sites = siteRows.map((s) => ({ id: s.id, name: s.name }));
    items = rows.map((p) => {
      const person = p.core_persons as PersonRow;
      const site = p.btp_sites as SiteRow;
      return {
        id: p.id,
        title: person?.full_name ?? p.role ?? 'Personnel',
        subtitle: `${p.role ?? '—'} — ${formatCurrency(Number(p.daily_rate ?? 0))}/jour`,
        status: p.is_active ? 'Actif' : 'Inactif',
        date: site?.name ?? person?.phone ?? undefined,
      };
    });
  } catch {
    items = [];
  }

  return <PersonnelClient items={items} sites={sites} />;
}
