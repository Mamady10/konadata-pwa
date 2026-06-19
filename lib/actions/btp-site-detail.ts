'use server';

import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/actions/org';
import { canManageAssignments, getMyAssignedBtpSiteIds } from '@/lib/actions/assignments';
import { getBtpPlanningRefsByOrg } from '@/lib/actions/btp-planning-ref';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/auth';
import { siteStatusLabel } from '@/lib/sector/status-labels';
import { normalizeBudgetBreakdownInput } from '@/lib/btp/site-baseline';
import type { BtpSitePlanningRef } from '@/lib/btp/planning-ref';
import {
  compileBtpSiteClosureDossier,
  BTP_SITE_CLOSURE_REPORT_LABEL,
  BTP_SITE_CLOSURE_REPORT_TYPE,
} from '@/lib/btp/compile-site-closure-dossier';
import { getBtpDocuments } from '@/lib/actions/storage';

export type BtpSiteStatus = 'planning' | 'active' | 'paused' | 'cancelled' | 'completed';

export interface BtpSiteDetailRow {
  id: string;
  name: string;
  location: string | null;
  client: string | null;
  contract_ref: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number;
  opening_spent: number;
  spent: number;
  status: string;
  statusLabel: string;
  physical_progress: number;
  financial_progress: number;
  delay_days: number;
  description: string | null;
  moa_recipient: string | null;
  planned_avg_workers: number | null;
  planned_monthly_fuel_liters: number | null;
  budget_alert_pct: number;
  budget_breakdown: Record<string, number>;
  completed_at: string | null;
  closure_comment: string | null;
  closure_report_id: string | null;
  default_planning_ref_slot: 1 | 2;
  planningRefs: BtpSitePlanningRef[];
}

async function assertSiteAccess(siteId: string): Promise<{ error: string } | { ok: true }> {
  const assigned = await getMyAssignedBtpSiteIds();
  if (assigned === null) return { ok: true };
  if (!assigned.includes(siteId)) {
    return { error: 'Vous n\'êtes pas assigné à ce chantier.' };
  }
  return { ok: true };
}

function parseBudgetBreakdown(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') {
    return { labor: 25, materials: 40, equipment: 15, subcontract: 10, overhead: 10 };
  }
  const o = raw as Record<string, unknown>;
  return {
    labor: Number(o.labor ?? 25),
    materials: Number(o.materials ?? 40),
    equipment: Number(o.equipment ?? 15),
    subcontract: Number(o.subcontract ?? 10),
    overhead: Number(o.overhead ?? 10),
  };
}

function revalidateSitePaths(orgId: string, siteId: string) {
  revalidatePath('/btp/chantiers');
  revalidatePath(`/btp/chantiers/${siteId}`);
  revalidatePath('/btp/documents');
  revalidatePath('/btp/rapports');
}

export async function getBtpSiteDetail(siteId: string): Promise<BtpSiteDetailRow | null> {
  const orgId = await requireOrgId();
  const access = await assertSiteAccess(siteId);
  if ('error' in access) return null;

  const supabase = await createClient();
  const { data: site, error } = await supabase
    .from('btp_sites')
    .select(
      'id, name, location, client, contract_ref, start_date, end_date, budget, opening_spent, spent, status, physical_progress, financial_progress, delay_days, description, moa_recipient, planned_avg_workers, planned_monthly_fuel_liters, budget_alert_pct, budget_breakdown, completed_at, closure_comment, closure_report_id, default_planning_ref_slot'
    )
    .eq('organization_id', orgId)
    .eq('id', siteId)
    .maybeSingle();

  if (error || !site?.id) return null;

  const planningRefsBySite = await getBtpPlanningRefsByOrg(orgId);
  const refs = planningRefsBySite[siteId] ?? [];

  return {
    id: site.id as string,
    name: site.name as string,
    location: (site.location as string) ?? null,
    client: (site.client as string) ?? null,
    contract_ref: (site.contract_ref as string) ?? null,
    start_date: (site.start_date as string)?.slice(0, 10) ?? null,
    end_date: (site.end_date as string)?.slice(0, 10) ?? null,
    budget: Number(site.budget ?? 0),
    opening_spent: Number(site.opening_spent ?? 0),
    spent: Number(site.spent ?? 0),
    status: site.status as string,
    statusLabel: siteStatusLabel(site.status as string),
    physical_progress: Number(site.physical_progress ?? 0),
    financial_progress: Number(site.financial_progress ?? 0),
    delay_days: Number(site.delay_days ?? 0),
    description: (site.description as string) ?? null,
    moa_recipient: (site.moa_recipient as string) ?? null,
    planned_avg_workers:
      site.planned_avg_workers != null ? Number(site.planned_avg_workers) : null,
    planned_monthly_fuel_liters:
      site.planned_monthly_fuel_liters != null
        ? Number(site.planned_monthly_fuel_liters)
        : null,
    budget_alert_pct: Number(site.budget_alert_pct ?? 90),
    budget_breakdown: parseBudgetBreakdown(site.budget_breakdown),
    completed_at: (site.completed_at as string) ?? null,
    closure_comment: (site.closure_comment as string) ?? null,
    closure_report_id: (site.closure_report_id as string) ?? null,
    default_planning_ref_slot: Number(site.default_planning_ref_slot ?? 1) === 2 ? 2 : 1,
    planningRefs: refs,
  };
}

export async function getBtpSiteDocuments(siteId: string) {
  const orgId = await requireOrgId();
  const access = await assertSiteAccess(siteId);
  if ('error' in access) return [];

  const all = await getBtpDocuments(orgId);
  return all.filter((d) => d.site_id === siteId);
}

export async function updateBtpSite(formData: FormData): Promise<{ success: true } | { error: string }> {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Seuls les directeurs peuvent modifier un chantier.' };

  const orgId = await requireOrgId();
  const siteId = String(formData.get('site_id') ?? '').trim();
  if (!siteId) return { error: 'Chantier requis.' };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('btp_sites')
    .select('id, status')
    .eq('organization_id', orgId)
    .eq('id', siteId)
    .maybeSingle();

  if (!existing?.id) return { error: 'Chantier introuvable.' };
  if (existing.status === 'completed') {
    return { error: 'Chantier clôturé : modification impossible. Rouvrez-le en changeant le statut via support si besoin.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Le nom du chantier est requis.' };

  const startDate = String(formData.get('start_date') ?? '').trim() || null;
  const endDate = String(formData.get('end_date') ?? '').trim() || null;
  if (startDate && endDate && startDate > endDate) {
    return { error: 'La date de fin doit être après la date de début.' };
  }

  const statusRaw = String(formData.get('status') ?? 'active').trim();
  const allowedStatuses: BtpSiteStatus[] = ['planning', 'active', 'paused', 'cancelled'];
  const status = allowedStatuses.includes(statusRaw as BtpSiteStatus)
    ? statusRaw
    : 'active';

  const budgetBreakdown = normalizeBudgetBreakdownInput(
    Number(formData.get('budget_labor') || 0),
    Number(formData.get('budget_materials') || 0),
    Number(formData.get('budget_equipment') || 0),
    Number(formData.get('budget_subcontract') || 0),
    Number(formData.get('budget_overhead') || 0)
  );

  const { error } = await supabase
    .from('btp_sites')
    .update({
      name,
      location: String(formData.get('location') ?? '').trim() || null,
      client: String(formData.get('client') ?? '').trim() || null,
      contract_ref: String(formData.get('contract_ref') ?? '').trim() || null,
      start_date: startDate,
      end_date: endDate,
      budget: Number(formData.get('budget') || 0),
      opening_spent: Number(formData.get('opening_spent') || 0),
      status,
      description: String(formData.get('description') ?? '').trim() || null,
      moa_recipient: String(formData.get('moa_recipient') ?? '').trim() || null,
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
    .eq('id', siteId)
    .eq('organization_id', orgId);

  if (error) {
    if (error.message.includes('completed_at') || error.message.includes('closure_')) {
      return { error: 'Migration 105 requise sur Supabase (clôture chantier).' };
    }
    return { error: error.message };
  }

  const { syncBtpSiteSpent } = await import('@/lib/actions/btp-financial');
  await syncBtpSiteSpent(orgId, siteId);

  revalidateSitePaths(orgId, siteId);
  return { success: true };
}

export async function closeBtpSite(
  formData: FormData
): Promise<
  | { error: string }
  | { success: true; report: string; title: string; archiveId: string; documentCount: number }
> {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Seuls les directeurs peuvent clôturer un chantier.' };

  const orgId = await requireOrgId();
  const siteId = String(formData.get('site_id') ?? '').trim();
  const closureComment = String(formData.get('closure_comment') ?? '').trim();
  const planningRefSlot = Number(formData.get('planning_ref_slot') ?? 1) === 2 ? 2 : 1;

  if (!siteId) return { error: 'Chantier requis.' };

  const supabase = await createClient();
  const { data: site } = await supabase
    .from('btp_sites')
    .select('id, name, status')
    .eq('organization_id', orgId)
    .eq('id', siteId)
    .maybeSingle();

  if (!site?.id) return { error: 'Chantier introuvable.' };
  if (site.status === 'completed') return { error: 'Ce chantier est déjà clôturé.' };

  const session = await getSession();
  const org = session?.profile?.organizations as { name?: string } | null;

  let dossier;
  try {
    dossier = await compileBtpSiteClosureDossier({
      orgId,
      siteId,
      closureComment: closureComment || null,
      orgName: org?.name ?? null,
      planningRefSlot,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Compilation du dossier impossible.' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: archive, error: archiveErr } = await supabase
    .from('organization_ai_generated_reports')
    .insert({
      organization_id: orgId,
      sector: 'btp',
      scope_id: siteId,
      scope_label: dossier.siteName,
      report_type: BTP_SITE_CLOSURE_REPORT_TYPE,
      report_type_label: BTP_SITE_CLOSURE_REPORT_LABEL,
      title: dossier.title,
      subtitle: dossier.subtitle,
      content: dossier.report,
      engine: 'local',
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();

  if (archiveErr) return { error: archiveErr.message };

  const completedAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('btp_sites')
    .update({
      status: 'completed',
      completed_at: completedAt,
      closure_comment: closureComment || null,
      closure_report_id: archive.id,
      physical_progress: Math.min(
        100,
        Math.max(
          dossier.structuredReport.structured.physicalEnd ?? 0,
          dossier.structuredReport.structured.physicalStart ?? 0
        )
      ),
    })
    .eq('id', siteId)
    .eq('organization_id', orgId);

  if (updateErr) {
    if (updateErr.message.includes('completed_at') || updateErr.message.includes('closure_')) {
      return { error: 'Migration 105 requise sur Supabase (clôture chantier).' };
    }
    return { error: updateErr.message };
  }

  revalidateSitePaths(orgId, siteId);
  return {
    success: true,
    report: dossier.report,
    title: dossier.title,
    archiveId: archive.id as string,
    documentCount: dossier.documentCount,
  };
}

export async function reopenBtpSite(siteId: string): Promise<{ success: true } | { error: string }> {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Seuls les directeurs peuvent rouvrir un chantier.' };

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { error } = await supabase
    .from('btp_sites')
    .update({
      status: 'active',
      completed_at: null,
    })
    .eq('id', siteId)
    .eq('organization_id', orgId)
    .eq('status', 'completed');

  if (error) return { error: error.message };

  revalidateSitePaths(orgId, siteId);
  return { success: true };
}
