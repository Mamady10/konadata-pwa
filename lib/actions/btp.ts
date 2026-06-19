'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/actions/org';
import { siteStatusLabel } from '@/lib/sector/status-labels';
import { getSession } from '@/lib/actions/auth';
import { getBtpDocuments } from '@/lib/actions/storage';
import { canManageAssignments, getMyAssignedBtpSiteIds } from '@/lib/actions/assignments';
import type { PersonalDashboardLink } from '@/lib/sector/personal-dashboard-types';
import { getBtpPlannedProgressPreview } from '@/lib/actions/btp-planning-ref';
import { ensureBtpSitePlanningRefs } from '@/lib/actions/btp-planning-ref';
import { normalizeBudgetBreakdownInput } from '@/lib/btp/site-baseline';
import type { BtpSiteMilestoneInput } from '@/lib/btp/site-baseline-types';

async function filterSitesByAssignment<T extends { id: string }>(sites: T[]): Promise<T[]> {
  const assigned = await getMyAssignedBtpSiteIds();
  if (assigned === null) return sites;
  if (assigned.length === 0) return [];
  const allowed = new Set(assigned);
  return sites.filter((s) => allowed.has(s.id));
}

/** null = directeur (tous les chantiers). */
async function assignedSiteIdSet(): Promise<Set<string> | null> {
  const assigned = await getMyAssignedBtpSiteIds();
  if (assigned === null) return null;
  return new Set(assigned);
}

function filterBySiteId<T extends { site_id?: string | null }>(
  rows: T[],
  allowed: Set<string> | null
): T[] {
  if (allowed === null) return rows;
  return rows.filter((r) => r.site_id && allowed.has(r.site_id));
}
export async function getBtpSites(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_sites')
    .select('id, name, location, budget, spent, status, physical_progress, financial_progress, delay_days, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return filterSitesByAssignment(data ?? []);
}

export async function getBtpFuelLogs(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_fuel_logs')
    .select('id, site_id, liters, cost, logged_at, is_anomaly, btp_sites(name)')
    .eq('organization_id', orgId)
    .order('logged_at', { ascending: false });
  if (error) throw error;
  const allowed = await assignedSiteIdSet();
  return filterBySiteId(data ?? [], allowed);
}

export async function getBtpDeliveryNotes(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_delivery_notes')
    .select('id, site_id, reference, supplier, total_amount, delivery_date, created_at')
    .eq('organization_id', orgId)
    .order('delivery_date', { ascending: false });
  if (error) throw error;
  const allowed = await assignedSiteIdSet();
  return filterBySiteId(data ?? [], allowed);
}

export async function getBtpStock(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_stock')
    .select('id, item_name, unit, quantity, min_threshold, alert_level')
    .eq('organization_id', orgId)
    .order('item_name');
  if (error) throw error;
  return data ?? [];
}

export async function getBtpPersonnel(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_personnel')
    .select('id, role, daily_rate, is_active, core_persons(full_name, phone), btp_sites(name)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getBtpEquipment(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_equipment')
    .select('id, name, type, status, hours_used, btp_sites(name)')
    .eq('organization_id', orgId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getBtpDashboard(orgId: string) {
  const supabase = await createClient();

  const [sitesRes, fuelRes, notesRes, personnelRes, stockRes] = await Promise.all([
    supabase
      .from('btp_sites')
      .select('id, name, location, budget, spent, status, physical_progress, financial_progress, delay_days')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('btp_fuel_logs')
      .select('id, liters, cost, logged_at, is_anomaly, site_id')
      .eq('organization_id', orgId)
      .order('logged_at', { ascending: false }),
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
      .select('id, item_name, alert_level')
      .eq('organization_id', orgId),
  ]);

  const sites = sitesRes.data ?? [];
  const fuelLogs = fuelRes.data ?? [];
  const notes = notesRes.data ?? [];
  const stock = stockRes.data ?? [];

  const activeSites = sites.filter((s) => s.status === 'active');
  const totalFuel = fuelLogs.reduce((s, f) => s + Number(f.liters ?? 0), 0);
  const avgProgress = sites.length
    ? sites.reduce((s, site) => s + Number(site.physical_progress ?? 0), 0) / sites.length
    : 0;

  const siteById = new Map(sites.map((s) => [s.id, s.name]));

  const planifieRealise = ['S1', 'S2', 'S3', 'S4'].map((semaine, i) => ({
    semaine,
    planifie: Math.round(avgProgress * (0.7 + i * 0.08)),
    realise: Math.round(avgProgress * (0.65 + i * 0.09)),
  }));

  const monthMap = new Map<string, number>();
  for (const log of fuelLogs) {
    const d = new Date(log.logged_at as string);
    const key = d.toLocaleDateString('fr-FR', { month: 'short' });
    monthMap.set(key, (monthMap.get(key) ?? 0) + Number(log.liters ?? 0));
  }
  const consommationCarburant = Array.from(monthMap.entries()).map(([mois, litres]) => ({ mois, litres }));

  const effectifsChantier = activeSites.slice(0, 4).map((s) => ({
    chantier: s.name,
    effectif: personnelRes.count ?? 0,
  }));

  const alertesCarburant = fuelLogs
    .filter((f) => f.is_anomaly)
    .slice(0, 5)
    .map((f) => ({
      chantier: siteById.get(f.site_id as string) ?? '—',
      consommation: `${Number(f.liters).toLocaleString('fr-FR')} L`,
      seuil: 'Alerte',
    }));

  return {
    kpis: {
      chantiers: sites.length,
      chantiersActifs: activeSites.length,
      consommationCarburant: totalFuel,
      heuresMachines: 0,
      tauxAvancement: avgProgress,
      personnel: personnelRes.count ?? 0,
      alertesStock: stock.filter((s) => s.alert_level !== 'normal').length,
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
      date: n.delivery_date
        ? new Date(n.delivery_date).toLocaleDateString('fr-FR')
        : '—',
    })),
    planifieRealise,
    consommationCarburant,
    effectifsChantier,
    alertesCarburant,
  };
}

export interface PersonalBtpDashboard {
  userName: string;
  highlights: { label: string; value: string }[];
  links: PersonalDashboardLink[];
  sites: Array<{ id: string; name: string; meta: string; status: string }>;
}

export async function getPersonalBtpDashboard(orgId: string): Promise<PersonalBtpDashboard> {
  const session = await getSession();
  const userName = session?.profile?.full_name ?? 'Utilisateur';
  const assigned = await getMyAssignedBtpSiteIds();
  const siteIds = assigned ?? [];

  const supabase = await createClient();
  let sites: Array<{
    id: string;
    name: string;
    location: string | null;
    status: string;
    physical_progress: number | null;
    delay_days: number | null;
  }> = [];

  if (siteIds.length > 0) {
    const { data } = await supabase
      .from('btp_sites')
      .select('id, name, location, status, physical_progress, delay_days')
      .eq('organization_id', orgId)
      .in('id', siteIds)
      .order('name');
    sites = data ?? [];
  }

  const docs = await getBtpDocuments(orgId);
  const activeCount = sites.filter((s) => s.status === 'active').length;
  const avgProgress = sites.length
    ? Math.round(
        sites.reduce((s, site) => s + Number(site.physical_progress ?? 0), 0) / sites.length
      )
    : 0;
  const withDelay = sites.filter((s) => (s.delay_days ?? 0) > 0).length;

  const highlights = [
    { label: 'Chantiers assignés', value: String(sites.length) },
    { label: 'Chantiers actifs', value: String(activeCount) },
    { label: 'Documents déposés', value: String(docs.length) },
    { label: 'Avancement moyen', value: sites.length ? `${avgProgress}%` : '—' },
  ];

  if (withDelay > 0) {
    highlights.push({ label: 'Retards signalés', value: String(withDelay) });
  }

  const links: PersonalDashboardLink[] = [
    {
      href: '/btp/chantiers',
      label: 'Mes chantiers',
      description: 'Suivre vos chantiers assignés',
    },
    {
      href: '/btp/documents',
      label: 'Documents',
      description: 'Pièces techniques et administratives par chantier',
    },
    {
      href: '/btp/avancement',
      label: 'Avancement',
      description: 'Saisir ou consulter l\'avancement',
    },
    {
      href: '/btp/carburant',
      label: 'Carburant',
      description: 'Consommations sur vos chantiers',
    },
    {
      href: '/btp/bons',
      label: 'Bons',
      description: 'Bons de livraison et achats',
    },
    {
      href: '/btp/rapports',
      label: 'Rapports',
      description: 'Rapports de votre périmètre',
    },
  ];

  return {
    userName,
    highlights,
    links,
    sites: sites.map((s) => ({
      id: s.id,
      name: s.name,
      meta: s.location ?? '—',
      status: siteStatusLabel(s.status),
    })),
  };
}

export interface BtpSiteProgressRow {
  id: string;
  name: string;
  location: string | null;
  status: string;
  statusLabel: string;
  physicalProgress: number;
  financialProgress: number;
  delayDays: number;
  hasMsProjectSchedule: boolean;
  defaultPlanningRefSlot: 1 | 2;
}

export interface BtpDailyProgressRow {
  id: string;
  siteId: string;
  siteName: string;
  progressDate: string;
  physicalPct: number;
  workersCount: number | null;
  notes: string | null;
  weather: string | null;
  createdAt: string;
}

export async function getBtpSitesForProgress(orgId: string): Promise<BtpSiteProgressRow[]> {
  const supabase = await createClient();
  const [sites, refsRes] = await Promise.all([
    getBtpSites(orgId),
    supabase
      .from('btp_site_planning_refs')
      .select('site_id, slot, source_type')
      .eq('organization_id', orgId),
  ]);
  const msProjectSites = new Set(
    (refsRes.data ?? [])
      .filter((r) => r.source_type === 'ms_project')
      .map((r) => r.site_id as string)
  );
  const defaultRefBySite = new Map<string, number>();
  const sitesWithDefault = await supabase
    .from('btp_sites')
    .select('id, default_planning_ref_slot')
    .eq('organization_id', orgId);
  for (const s of sitesWithDefault.data ?? []) {
    defaultRefBySite.set(s.id as string, Number(s.default_planning_ref_slot ?? 1));
  }

  return sites.map((s) => ({
    id: s.id as string,
    name: s.name as string,
    location: (s.location as string) || null,
    status: s.status as string,
    statusLabel: siteStatusLabel(s.status as string),
    physicalProgress: Math.round(Number(s.physical_progress ?? 0)),
    financialProgress: Math.round(Number(s.financial_progress ?? 0)),
    delayDays: Number(s.delay_days ?? 0),
    hasMsProjectSchedule: msProjectSites.has(s.id as string),
    defaultPlanningRefSlot: (defaultRefBySite.get(s.id as string) === 2 ? 2 : 1) as 1 | 2,
  }));
}

export async function getBtpDailyProgress(orgId: string, limit = 25): Promise<BtpDailyProgressRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_daily_progress')
    .select('id, site_id, progress_date, physical_pct, workers_count, notes, weather, created_at, btp_sites(name)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const allowed = await assignedSiteIdSet();
  const rows = filterBySiteId(data ?? [], allowed);

  return rows.map((r) => ({
    id: r.id as string,
    siteId: r.site_id as string,
    siteName: (r.btp_sites as { name?: string } | null)?.name ?? '—',
    progressDate: r.progress_date as string,
    physicalPct: Math.round(Number(r.physical_pct ?? 0)),
    workersCount: r.workers_count != null ? Number(r.workers_count) : null,
    notes: (r.notes as string) || null,
    weather: (r.weather as string) || null,
    createdAt: r.created_at as string,
  }));
}

async function assertCanEditBtpSite(siteId: string): Promise<{ error: string } | { ok: true }> {
  const assigned = await getMyAssignedBtpSiteIds();
  if (assigned !== null && !assigned.includes(siteId)) {
    return { error: 'Vous n\'êtes pas assigné à ce chantier.' };
  }
  return { ok: true };
}

export async function recordBtpSiteProgress(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const siteId = (formData.get('site_id') as string)?.trim();
  if (!siteId) return { error: 'Chantier requis.' };

  const access = await assertCanEditBtpSite(siteId);
  if ('error' in access) return access;

  const physicalPct = Number(formData.get('physical_pct'));
  if (Number.isNaN(physicalPct) || physicalPct < 0 || physicalPct > 100) {
    return { error: 'Avancement physique invalide (0 à 100 %).' };
  }

  const progressDateRaw = (formData.get('progress_date') as string)?.trim();
  const progressDate =
    progressDateRaw || new Date().toISOString().slice(0, 10);

  const workersRaw = formData.get('workers_count') as string;
  const workersCount =
    workersRaw && workersRaw !== '' ? Number(workersRaw) : null;
  if (workersCount !== null && (Number.isNaN(workersCount) || workersCount < 0)) {
    return { error: 'Effectif invalide.' };
  }

  const notes = ((formData.get('notes') as string) || '').trim() || null;
  const weather = ((formData.get('weather') as string) || '').trim() || null;

  const { error: insertErr } = await supabase.from('btp_daily_progress').insert({
    organization_id: orgId,
    site_id: siteId,
    progress_date: progressDate,
    physical_pct: physicalPct,
    workers_count: workersCount,
    notes,
    weather,
    created_by: user?.id ?? null,
  });

  if (insertErr) return { error: insertErr.message };

  const canManage = await canManageAssignments();
  if (canManage) {
    const financialRaw = formData.get('financial_pct') as string;
    const delayRaw = formData.get('delay_days') as string;
    const patch: Record<string, number> = { physical_progress: physicalPct };
    if (financialRaw !== '' && financialRaw != null) {
      const financialPct = Number(financialRaw);
      if (!Number.isNaN(financialPct) && financialPct >= 0 && financialPct <= 100) {
        patch.financial_progress = financialPct;
      }
    }
    if (delayRaw !== '' && delayRaw != null) {
      const delayDays = Number(delayRaw);
      if (!Number.isNaN(delayDays) && delayDays >= 0) {
        patch.delay_days = delayDays;
      }
    }
    const { error: siteErr } = await supabase
      .from('btp_sites')
      .update(patch)
      .eq('id', siteId)
      .eq('organization_id', orgId);
    if (siteErr) return { error: siteErr.message };
  }

  revalidatePath('/btp/avancement');
  revalidatePath('/btp/chantiers');
  revalidatePath('/btp');
  revalidatePath('/btp/rapports');

  const comparison = await getBtpPlannedProgressPreview(siteId, progressDate, physicalPct);
  return { success: true, comparison };
}

export async function createBtpSite(formData: FormData) {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Seuls les directeurs peuvent créer des chantiers.' };

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const name = (formData.get('name') as string)?.trim();
  if (!name) return { error: 'Le nom du chantier est requis' };

  const startDate = (formData.get('start_date') as string)?.trim() || null;
  const endDate = (formData.get('end_date') as string)?.trim() || null;
  if (startDate && endDate && startDate > endDate) {
    return { error: 'La date de fin doit être après la date de début.' };
  }

  const budgetBreakdown = normalizeBudgetBreakdownInput(
    Number(formData.get('budget_labor') || 0),
    Number(formData.get('budget_materials') || 0),
    Number(formData.get('budget_equipment') || 0),
    Number(formData.get('budget_subcontract') || 0),
    Number(formData.get('budget_overhead') || 0)
  );

  let milestones: BtpSiteMilestoneInput[] = [];
  const ref1Mode = (formData.get('ref1_mode') as string)?.trim() || 'milestones';
  const milestonesRaw = (formData.get('milestones_json') as string)?.trim();
  if (ref1Mode === 'milestones' && milestonesRaw) {
    try {
      const parsed = JSON.parse(milestonesRaw) as BtpSiteMilestoneInput[];
      if (Array.isArray(parsed)) {
        milestones = parsed.filter(
          (m) =>
            m.label?.trim() &&
            m.plannedDate &&
            !Number.isNaN(Number(m.targetPhysicalPct)) &&
            Number(m.targetPhysicalPct) >= 0 &&
            Number(m.targetPhysicalPct) <= 100
        );
      }
    } catch {
      return { error: 'Format des jalons invalide.' };
    }
  }

  const { data: site, error } = await supabase
    .from('btp_sites')
    .insert({
      organization_id: orgId,
      name,
      location: (formData.get('location') as string)?.trim() || null,
      client: (formData.get('client') as string)?.trim() || null,
      contract_ref: (formData.get('contract_ref') as string)?.trim() || null,
      start_date: startDate,
      end_date: endDate,
      budget: Number(formData.get('budget') || 0),
      spent: Number(formData.get('opening_spent') || 0),
      status: 'active',
      physical_progress: Number(formData.get('physical_progress') || 0),
      financial_progress: Number(formData.get('financial_progress') || 0),
      description: (formData.get('description') as string)?.trim() || null,
      moa_recipient: (formData.get('moa_recipient') as string)?.trim() || null,
      planned_avg_workers:
        formData.get('planned_avg_workers') !== ''
          ? Number(formData.get('planned_avg_workers'))
          : null,
      planned_monthly_fuel_liters:
        formData.get('planned_monthly_fuel_liters') !== ''
          ? Number(formData.get('planned_monthly_fuel_liters'))
          : null,
      budget_alert_pct: Number(formData.get('budget_alert_pct') || 90),
      budget_breakdown: budgetBreakdown,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  if (milestones.length > 0 && site?.id) {
    const { error: msErr } = await supabase.from('btp_site_milestones').insert(
      milestones.map((m, i) => ({
        organization_id: orgId,
        site_id: site.id,
        label: m.label.trim(),
        target_physical_pct: Number(m.targetPhysicalPct),
        planned_date: m.plannedDate,
        sort_order: m.sortOrder ?? i,
      }))
    );
    if (msErr) return { error: msErr.message };
  }

  if (site?.id) {
    await ensureBtpSitePlanningRefs({
      orgId,
      siteId: site.id,
      startDate,
      endDate,
      ref1: {
        sourceType: ref1Mode === 'milestones' && milestones.length > 0 ? 'milestones' : 'linear',
        milestones,
        label: milestones.length > 0 ? 'Référence 1 — Jalons' : 'Référence 1 — Dates contractuelles',
      },
    });
  }

  revalidatePath('/btp/chantiers');
  revalidatePath('/btp');
  revalidatePath('/btp/rapports');
  return { success: true };
}

export async function createBtpPersonnel(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const fullName = (formData.get('full_name') as string)?.trim();
  const role = (formData.get('role') as string)?.trim();
  if (!fullName) return { error: 'Le nom est requis' };
  if (!role) return { error: 'Le rôle est requis' };

  const { data: person, error: personError } = await supabase
    .from('core_persons')
    .insert({
      organization_id: orgId,
      kind: 'worker',
      full_name: fullName,
      phone: (formData.get('phone') as string) || null,
    })
    .select('id')
    .single();

  if (personError) return { error: personError.message };

  const siteId = (formData.get('site_id') as string) || null;

  const { error } = await supabase.from('btp_personnel').insert({
    organization_id: orgId,
    person_id: person.id,
    site_id: siteId && siteId !== 'none' ? siteId : null,
    role,
    daily_rate: Number(formData.get('daily_rate') || 0),
    is_active: true,
  });

  if (error) return { error: error.message };
  revalidatePath('/btp/personnel');
  revalidatePath('/btp');
  return { success: true };
}

export async function createBtpFuelLog(formData: FormData) {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const siteId = formData.get('site_id') as string;
  const liters = Number(formData.get('liters') || 0);
  if (!siteId) return { error: 'Chantier requis' };
  if (liters <= 0) return { error: 'Litres invalides' };

  const assigned = await getMyAssignedBtpSiteIds();
  if (assigned !== null && !assigned.includes(siteId)) {
    return { error: 'Vous n\'êtes pas assigné à ce chantier.' };
  }

  const { error } = await supabase.from('btp_fuel_logs').insert({
    organization_id: orgId,
    site_id: siteId,
    liters,
    cost: Number(formData.get('cost') || 0),
    is_anomaly: formData.get('is_anomaly') === 'true',
    notes: (formData.get('notes') as string) || null,
  });

  if (error) return { error: error.message };
  const { syncBtpSiteSpent } = await import('@/lib/actions/btp-financial');
  await syncBtpSiteSpent(orgId, siteId);
  revalidatePath('/btp/carburant');
  revalidatePath('/btp/finances');
  return { success: true };
}
