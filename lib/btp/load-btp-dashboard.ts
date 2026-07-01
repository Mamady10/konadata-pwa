import { createClient } from '@/lib/supabase/server';
import { siteStatusLabel } from '@/lib/sector/status-labels';
import { getBtpPlanningRefsByOrg } from '@/lib/actions/btp-planning-ref';
import { mapSiteRowToBaseline } from '@/lib/btp/site-baseline';
import { resolvePlanningRef, plannedPhysicalPctFromResolvedRef } from '@/lib/btp/planning-ref';
import type { BtpDashboardData } from '@/lib/btp/dashboard-types';

const SITE_SELECT_FULL =
  'id, name, location, budget, spent, status, physical_progress, financial_progress, delay_days, default_planning_ref_slot, start_date, end_date, budget_breakdown, opening_spent';

const SITE_SELECT_MINIMAL =
  'id, name, location, budget, spent, status, physical_progress, financial_progress, delay_days, start_date, end_date';

function fuelLogsSinceMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function isMissingColumnError(message: string | undefined): boolean {
  if (!message) return false;
  return message.includes('column') || message.includes('does not exist');
}

type SiteRow = Record<string, unknown> & {
  id: string;
  name: string;
  status: string;
  physical_progress: number | null;
  delay_days: number | null;
};

async function fetchBtpSites(orgId: string): Promise<SiteRow[]> {
  const supabase = await createClient();
  const full = await supabase
    .from('btp_sites')
    .select(SITE_SELECT_FULL)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (!full.error) return (full.data ?? []) as SiteRow[];

  if (isMissingColumnError(full.error.message)) {
    const minimal = await supabase
      .from('btp_sites')
      .select(SITE_SELECT_MINIMAL)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    if (minimal.error) throw minimal.error;
    return (minimal.data ?? []) as SiteRow[];
  }

  throw full.error;
}

async function fetchFuelTotal(orgId: string, sinceIso: string): Promise<number | null> {
  const supabase = await createClient();
  const since = `${sinceIso}T00:00:00Z`;
  const { data, error } = await supabase.rpc('btp_dashboard_fuel_total', {
    p_org_id: orgId,
    p_since: since,
  });
  if (error) return null;
  return Number(data ?? 0);
}

async function fetchFuelByMonth(
  orgId: string,
  sinceIso: string
): Promise<Array<{ mois: string; litres: number }> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('btp_dashboard_fuel_by_month', {
    p_org_id: orgId,
    p_since: sinceIso,
  });
  if (error || !data) return null;
  return (data as Array<{ month_sort: string; litres: number }>).map((row) => ({
    mois: new Date(row.month_sort).toLocaleDateString('fr-FR', { month: 'short' }),
    litres: Number(row.litres ?? 0),
  }));
}

async function fetchEffectifsParChantier(
  orgId: string
): Promise<Array<{ chantier: string; effectif: number }> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('btp_dashboard_effectifs_par_chantier', {
    p_org_id: orgId,
    p_limit: 4,
  });
  if (error || !data) return null;
  return (data as Array<{ chantier: string; effectif: number }>).map((row) => ({
    chantier: row.chantier,
    effectif: Number(row.effectif ?? 0),
  }));
}

function aggregateFuelByMonth(
  fuelLogs: Array<{ logged_at: string; liters: number | null }>
): Array<{ mois: string; litres: number }> {
  const monthMap = new Map<string, number>();
  for (const log of fuelLogs) {
    const d = new Date(log.logged_at);
    const key = d.toLocaleDateString('fr-FR', { month: 'short' });
    monthMap.set(key, (monthMap.get(key) ?? 0) + Number(log.liters ?? 0));
  }
  return Array.from(monthMap.entries()).map(([mois, litres]) => ({ mois, litres }));
}

function buildPlanifieRealise(params: {
  activeSites: SiteRow[];
  progressRows: Array<{ site_id: string; progress_date: string; physical_pct: number | null }>;
  planningBySite: Awaited<ReturnType<typeof getBtpPlanningRefsByOrg>>;
  avgProgress: number;
}): BtpDashboardData['planifieRealise'] {
  const { activeSites, progressRows, planningBySite, avgProgress } = params;
  const weekEnds: string[] = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);
    weekEnds.push(d.toISOString().slice(0, 10));
  }

  return weekEnds.map((weekEnd, i) => {
    let plannedSum = 0;
    let plannedCount = 0;
    let actualSum = 0;
    let actualCount = 0;
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    for (const site of activeSites) {
      const siteId = site.id;
      const refs = planningBySite[siteId] ?? [];
      const slot = Number(site.default_planning_ref_slot ?? 1) as 1 | 2;
      const ref = refs.find((r) => r.slot === slot) ?? refs[0];
      if (ref) {
        const baseline = mapSiteRowToBaseline(site, []);
        const resolved = resolvePlanningRef(baseline, ref);
        const planned = plannedPhysicalPctFromResolvedRef(resolved, weekEnd);
        if (planned != null) {
          plannedSum += planned;
          plannedCount++;
        }
      }

      const weekEntries = progressRows.filter((p) => {
        if (p.site_id !== siteId) return false;
        const d = p.progress_date.slice(0, 10);
        return d >= weekStartStr && d <= weekEnd;
      });
      const actual =
        weekEntries.length > 0
          ? Math.max(...weekEntries.map((p) => Number(p.physical_pct ?? 0)))
          : Number(site.physical_progress ?? 0);
      actualSum += actual;
      actualCount++;
    }

    return {
      semaine: `S${i + 1}`,
      planifie: plannedCount > 0 ? Math.round(plannedSum / plannedCount) : Math.round(avgProgress),
      realise: actualCount > 0 ? Math.round(actualSum / actualCount) : Math.round(avgProgress),
    };
  });
}

export async function loadBtpDashboard(orgId: string): Promise<BtpDashboardData> {
  const supabase = await createClient();
  const fuelSince = fuelLogsSinceMonths(13);
  const progressSince = new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10);

  const [sites, fuelAnomaliesRes, notesRes, personnelRes, stockAlertsRes, progressRes, fuelTotalRpc, fuelByMonthRpc, effectifsRpc] =
    await Promise.all([
      fetchBtpSites(orgId),
      supabase
        .from('btp_fuel_logs')
        .select('id, liters, logged_at, is_anomaly, site_id')
        .eq('organization_id', orgId)
        .eq('is_anomaly', true)
        .order('logged_at', { ascending: false })
        .limit(5),
      supabase
        .from('btp_delivery_notes')
        .select('id, reference, supplier, total_amount, delivery_date')
        .eq('organization_id', orgId)
        .order('delivery_date', { ascending: false })
        .limit(5),
      supabase
        .from('btp_personnel')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_active', true),
      supabase
        .from('btp_stock')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .neq('alert_level', 'normal'),
      supabase
        .from('btp_daily_progress')
        .select('site_id, progress_date, physical_pct')
        .eq('organization_id', orgId)
        .gte('progress_date', progressSince),
      fetchFuelTotal(orgId, fuelSince),
      fetchFuelByMonth(orgId, fuelSince),
      fetchEffectifsParChantier(orgId),
    ]);

  let fuelLogsForFallback: Array<{ logged_at: string; liters: number | null }> = [];
  let totalFuel = fuelTotalRpc;

  if (totalFuel === null || fuelByMonthRpc === null) {
    const fuelRes = await supabase
      .from('btp_fuel_logs')
      .select('liters, logged_at')
      .eq('organization_id', orgId)
      .gte('logged_at', `${fuelSince}T00:00:00`)
      .order('logged_at', { ascending: false })
      .limit(500);
    if (fuelRes.error) throw fuelRes.error;
    fuelLogsForFallback = fuelRes.data ?? [];
    if (totalFuel === null) {
      totalFuel = fuelLogsForFallback.reduce((s, f) => s + Number(f.liters ?? 0), 0);
    }
  }

  const notes = notesRes.data ?? [];
  const activeSites = sites.filter((s) => s.status === 'active');
  const avgProgress = sites.length
    ? sites.reduce((s, site) => s + Number(site.physical_progress ?? 0), 0) / sites.length
    : 0;

  const siteById = new Map(sites.map((s) => [s.id, s.name]));
  const progressRows = progressRes.data ?? [];

  let planningBySite: Awaited<ReturnType<typeof getBtpPlanningRefsByOrg>> = {};
  try {
    planningBySite = await getBtpPlanningRefsByOrg(orgId);
  } catch {
    planningBySite = {};
  }

  const planifieRealise = buildPlanifieRealise({
    activeSites,
    progressRows,
    planningBySite,
    avgProgress,
  });

  const consommationCarburant =
    fuelByMonthRpc ?? aggregateFuelByMonth(fuelLogsForFallback);

  const effectifsChantier =
    effectifsRpc ??
    activeSites.slice(0, 4).map((s) => ({
      chantier: s.name,
      effectif: personnelRes.count ?? 0,
    }));

  const alertesCarburant = (fuelAnomaliesRes.data ?? []).map((f) => ({
    chantier: siteById.get(f.site_id as string) ?? '—',
    consommation: `${Number(f.liters).toLocaleString('fr-FR')} L`,
    seuil: 'Alerte',
  }));

  return {
    kpis: {
      chantiers: sites.length,
      chantiersActifs: activeSites.length,
      consommationCarburant: totalFuel ?? 0,
      heuresMachines: 0,
      tauxAvancement: avgProgress,
      personnel: personnelRes.count ?? 0,
      alertesStock: stockAlertsRes.count ?? 0,
    },
    chantiersActifs: activeSites.map((s) => ({
      id: s.id,
      nom: s.name,
      avancement: Math.round(Number(s.physical_progress ?? 0)),
      retard: s.delay_days ?? 0,
      statut: siteStatusLabel(s.status),
    })),
    derniersBons: notes.map((n) => ({
      id: n.id,
      type: 'Bon de livraison',
      fournisseur: n.supplier ?? '—',
      date: n.delivery_date ? new Date(n.delivery_date).toLocaleDateString('fr-FR') : '—',
    })),
    planifieRealise,
    consommationCarburant,
    effectifsChantier,
    alertesCarburant,
  };
}
