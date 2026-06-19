import { requireBtpPage } from '@/lib/btp/require-btp-page';
import { getBtpPersonnel, getBtpSites } from '@/lib/actions/btp';
import { getBtpLaborEntries, getBtpPersonnelForLabor } from '@/lib/actions/btp-financial';
import { PersonnelClient } from './personnel-client';
import { formatCurrency } from '@/lib/utils';
import { sumLaborEntryAmount } from '@/lib/btp/site-financial';
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

  let laborEntries: Array<{
    id: string;
    siteName: string;
    personName: string;
    workDate: string;
    days: number;
    amount: number;
  }> = [];
  let personnelForLabor: Array<{ id: string; name: string; dailyRate: number; siteName?: string }> = [];

  try {
    const [rows, siteRows, laborRows, laborPersonnel] = await Promise.all([
      getBtpPersonnel(orgId),
      getBtpSites(orgId),
      getBtpLaborEntries(orgId),
      getBtpPersonnelForLabor(orgId),
    ]);
    sites = siteRows.map((s) => ({ id: s.id, name: s.name }));
    personnelForLabor = laborPersonnel.map((p) => {
      const person = p.core_persons as PersonRow;
      const site = p.btp_sites as SiteRow;
      return {
        id: p.id as string,
        name: person?.full_name ?? (p.role as string) ?? 'Personnel',
        dailyRate: Number(p.daily_rate ?? 0),
        siteName: site?.name,
      };
    });
    laborEntries = laborRows.map((r) => {
      const person = r.btp_personnel as { role?: string; core_persons?: PersonRow } | null;
      const site = r.btp_sites as SiteRow;
      const personName = person?.core_persons?.full_name ?? person?.role ?? '—';
      return {
        id: r.id as string,
        siteName: site?.name ?? '—',
        personName,
        workDate: (r.work_date as string).slice(0, 10),
        days: Number(r.days),
        amount: sumLaborEntryAmount(Number(r.days), Number(r.daily_rate)),
      };
    });
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

  return <PersonnelClient items={items} sites={sites} laborEntries={laborEntries} personnelForLabor={personnelForLabor} />;
}
