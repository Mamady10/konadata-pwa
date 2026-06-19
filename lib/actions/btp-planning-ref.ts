'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/actions/org';
import { canManageAssignments } from '@/lib/actions/assignments';
import { parseMsProjectXml, summarizeScheduleImport } from '@/lib/btp/ms-project-xml';
import {
  comparePlannedVsActual,
  mapSiteRowToBaseline,
} from '@/lib/btp/site-baseline';
import {
  mapPlanningRefRow,
  planningRefSummary,
  resolvePlanningRef,
  plannedPhysicalPctFromResolvedRef,
  PLANNING_REF_SLOT_LABELS,
  PLANNING_SOURCE_LABELS,
  type BtpSitePlanningRef,
} from '@/lib/btp/planning-ref';
import type {
  BtpPlannedProgressSnapshot,
  BtpSiteMilestoneInput,
  PlanningRefSlot,
  PlanningSourceType,
} from '@/lib/btp/site-baseline-types';

function parseSlot(raw: unknown): PlanningRefSlot {
  const n = Number(raw);
  return n === 2 ? 2 : 1;
}

function revalidatePlanningPaths() {
  revalidatePath('/btp/chantiers');
  revalidatePath('/btp/avancement');
  revalidatePath('/btp/rapports');
}

export async function getBtpSitePlanningRefs(siteId: string): Promise<BtpSitePlanningRef[]> {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_site_planning_refs')
    .select('*')
    .eq('organization_id', orgId)
    .eq('site_id', siteId)
    .order('slot', { ascending: true });
  if (error || !data) return [];
  return data.map((row) => mapPlanningRefRow(row));
}

export async function getBtpPlanningRefsByOrg(
  orgId: string
): Promise<Record<string, BtpSitePlanningRef[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_site_planning_refs')
    .select('*')
    .eq('organization_id', orgId)
    .order('slot', { ascending: true });
  if (error || !data) return {};
  const out: Record<string, BtpSitePlanningRef[]> = {};
  for (const row of data) {
    const siteId = row.site_id as string;
    if (!out[siteId]) out[siteId] = [];
    out[siteId].push(mapPlanningRefRow(row));
  }
  return out;
}

export async function ensureBtpSitePlanningRefs(params: {
  orgId: string;
  siteId: string;
  startDate: string | null;
  endDate: string | null;
  ref1?: { sourceType: PlanningSourceType; milestones?: BtpSiteMilestoneInput[]; label?: string };
}): Promise<void> {
  const supabase = await createClient();
  const { orgId, siteId, startDate, endDate, ref1 } = params;

  const ref1Type = ref1?.sourceType ?? 'linear';
  const ref1Milestones =
    ref1Type === 'milestones' && ref1?.milestones?.length ? ref1.milestones : [];

  await supabase.from('btp_site_planning_refs').upsert(
    {
      organization_id: orgId,
      site_id: siteId,
      slot: 1,
      label: ref1?.label ?? PLANNING_REF_SLOT_LABELS[1],
      source_type: ref1Type,
      start_date: startDate,
      end_date: endDate,
      milestones: ref1Milestones,
      tasks: [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'site_id,slot' }
  );

  await supabase.from('btp_site_planning_refs').upsert(
    {
      organization_id: orgId,
      site_id: siteId,
      slot: 2,
      label: `${PLANNING_REF_SLOT_LABELS[2]} — À configurer`,
      source_type: 'linear',
      start_date: startDate,
      end_date: endDate,
      milestones: [],
      tasks: [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'site_id,slot' }
  );
}

export async function saveBtpPlanningRefConfig(formData: FormData): Promise<{ success: true } | { error: string }> {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Seuls les directeurs peuvent modifier les références planning.' };

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const siteId = (formData.get('site_id') as string)?.trim();
  const slot = parseSlot(formData.get('slot'));
  const label = (formData.get('label') as string)?.trim() || PLANNING_REF_SLOT_LABELS[slot];
  const sourceType = (formData.get('source_type') as PlanningSourceType) || 'linear';

  if (!siteId) return { error: 'Chantier requis.' };
  if (!['linear', 'milestones', 'ms_project'].includes(sourceType)) {
    return { error: 'Type de référence invalide.' };
  }

  const { data: site } = await supabase
    .from('btp_sites')
    .select('start_date, end_date')
    .eq('id', siteId)
    .eq('organization_id', orgId)
    .single();
  if (!site) return { error: 'Chantier introuvable.' };

  let milestones: BtpSiteMilestoneInput[] = [];
  if (sourceType === 'milestones') {
    const raw = (formData.get('milestones_json') as string)?.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as BtpSiteMilestoneInput[];
        milestones = parsed.filter(
          (m) =>
            m.label?.trim() &&
            m.plannedDate &&
            !Number.isNaN(Number(m.targetPhysicalPct)) &&
            Number(m.targetPhysicalPct) >= 0 &&
            Number(m.targetPhysicalPct) <= 100
        );
      } catch {
        return { error: 'Format des jalons invalide.' };
      }
    }
    if (milestones.length === 0) {
      return { error: 'Ajoutez au moins un jalon pour cette référence.' };
    }
  }

  const { data: existing } = await supabase
    .from('btp_site_planning_refs')
    .select('tasks, source_filename, project_title')
    .eq('site_id', siteId)
    .eq('slot', slot)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    organization_id: orgId,
    site_id: siteId,
    slot,
    label,
    source_type: sourceType,
    start_date: site.start_date,
    end_date: site.end_date,
    milestones: sourceType === 'milestones' ? milestones : [],
    updated_at: new Date().toISOString(),
  };

  if (sourceType === 'ms_project') {
    patch.tasks = existing?.tasks ?? [];
    patch.source_filename = existing?.source_filename ?? null;
    patch.project_title = existing?.project_title ?? null;
    if (!patch.tasks || (patch.tasks as unknown[]).length === 0) {
      return { error: 'Importez d\'abord un fichier XML MS Project pour cette référence.' };
    }
  } else {
    patch.tasks = [];
    patch.source_filename = null;
    patch.project_title = null;
  }

  const { error } = await supabase.from('btp_site_planning_refs').upsert(patch, {
    onConflict: 'site_id,slot',
  });
  if (error) return { error: error.message };

  revalidatePlanningPaths();
  return { success: true };
}

export async function setBtpDefaultPlanningRefSlot(
  siteId: string,
  slot: PlanningRefSlot
): Promise<{ success: true } | { error: string }> {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Action réservée aux directeurs.' };

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { error } = await supabase
    .from('btp_sites')
    .update({ default_planning_ref_slot: slot })
    .eq('id', siteId)
    .eq('organization_id', orgId);
  if (error) return { error: error.message };
  revalidatePlanningPaths();
  return { success: true };
}

export async function previewBtpMsProjectXml(formData: FormData): Promise<
  | {
      preview: ReturnType<typeof summarizeScheduleImport> & {
        projectTitle: string;
        warnings: string[];
      };
    }
  | { error: string }
> {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Seuls les directeurs peuvent importer un planning.' };

  const file = formData.get('file') as File | null;
  if (!file) return { error: 'Fichier XML requis.' };
  if (!file.name.toLowerCase().endsWith('.xml')) {
    return { error: 'Export XML MS Project requis (Fichier → Exporter → XML).' };
  }

  try {
    const parsed = parseMsProjectXml(await file.text());
    return {
      preview: {
        ...summarizeScheduleImport(parsed),
        projectTitle: parsed.projectTitle,
        warnings: parsed.warnings,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Lecture XML impossible.' };
  }
}

export async function importBtpPlanningRefMsProject(formData: FormData): Promise<
  | { success: true; summary: ReturnType<typeof summarizeScheduleImport> & { projectTitle: string } }
  | { error: string }
> {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Seuls les directeurs peuvent importer un planning.' };

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const siteId = (formData.get('site_id') as string)?.trim();
  const slot = parseSlot(formData.get('slot'));
  const label =
    (formData.get('label') as string)?.trim() || `${PLANNING_REF_SLOT_LABELS[slot]} — MS Project`;
  const file = formData.get('file') as File | null;

  if (!siteId) return { error: 'Chantier requis.' };
  if (!file) return { error: 'Fichier XML requis.' };

  const { data: site } = await supabase
    .from('btp_sites')
    .select('start_date, end_date')
    .eq('id', siteId)
    .eq('organization_id', orgId)
    .single();
  if (!site) return { error: 'Chantier introuvable.' };

  let parsed;
  try {
    parsed = parseMsProjectXml(await file.text());
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Import XML impossible.' };
  }

  const summary = summarizeScheduleImport(parsed);
  const { error } = await supabase.from('btp_site_planning_refs').upsert(
    {
      organization_id: orgId,
      site_id: siteId,
      slot,
      label,
      source_type: 'ms_project',
      start_date: parsed.startDate ?? site.start_date,
      end_date: parsed.endDate ?? site.end_date,
      milestones: [],
      tasks: parsed.tasks,
      source_filename: file.name,
      project_title: parsed.projectTitle,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'site_id,slot' }
  );
  if (error) return { error: error.message };

  revalidatePlanningPaths();
  return { success: true, summary: { ...summary, projectTitle: parsed.projectTitle } };
}

export async function getBtpPlannedProgressPreview(
  siteId: string,
  progressDate: string,
  actualPct: number,
  refSlot?: PlanningRefSlot
): Promise<BtpPlannedProgressSnapshot | null> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: site } = await supabase
    .from('btp_sites')
    .select(
      'id, client, contract_ref, start_date, end_date, budget, spent, description, moa_recipient, planned_avg_workers, planned_monthly_fuel_liters, budget_alert_pct, budget_breakdown, default_planning_ref_slot'
    )
    .eq('id', siteId)
    .eq('organization_id', orgId)
    .single();
  if (!site) return null;

  const slot = refSlot ?? (Number(site.default_planning_ref_slot) === 2 ? 2 : 1);

  const { data: refRow } = await supabase
    .from('btp_site_planning_refs')
    .select('*')
    .eq('site_id', siteId)
    .eq('slot', slot)
    .maybeSingle();

  if (!refRow) return null;

  const siteBaseline = mapSiteRowToBaseline(site, []);
  const ref = mapPlanningRefRow(refRow);
  const resolved = resolvePlanningRef(siteBaseline, ref);
  const plannedPct = plannedPhysicalPctFromResolvedRef(resolved, progressDate.slice(0, 10));

  return comparePlannedVsActual(
    actualPct,
    resolved.sourceType,
    planningRefSummary(ref),
    resolved.slot
  );
}

export async function getBtpPlanningRefOptionsForSite(siteId: string): Promise<
  Array<{ slot: PlanningRefSlot; label: string; summary: string; sourceType: PlanningSourceType }>
> {
  const refs = await getBtpSitePlanningRefs(siteId);
  return refs.map((ref) => ({
    slot: ref.slot,
    label: ref.label,
    summary: planningRefSummary(ref),
    sourceType: ref.sourceType,
  }));
}
