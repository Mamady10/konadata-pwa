'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/actions/org';
import { canManageAssignments } from '@/lib/actions/assignments';
import { parseMsProjectXml, summarizeScheduleImport } from '@/lib/btp/ms-project-xml';
import {
  comparePlannedVsActual,
  plannedPhysicalPctAt,
  mapSiteRowToBaseline,
} from '@/lib/btp/site-baseline';
import { mapScheduleRow } from '@/lib/btp/site-schedule';
import type { BtpPlannedProgressSnapshot, BtpSiteSchedule } from '@/lib/btp/site-baseline-types';

export async function getBtpSiteSchedule(siteId: string): Promise<BtpSiteSchedule | null> {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_site_schedules')
    .select('*')
    .eq('organization_id', orgId)
    .eq('site_id', siteId)
    .maybeSingle();
  if (error || !data) return null;
  return mapScheduleRow(data);
}

export async function getBtpSiteScheduleSummaries(
  orgId: string
): Promise<Record<string, { taskCount: number; projectTitle: string | null; importedAt: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('btp_site_schedules')
    .select('site_id, task_count, project_title, imported_at')
    .eq('organization_id', orgId);
  if (error || !data) return {};

  const out: Record<string, { taskCount: number; projectTitle: string | null; importedAt: string }> = {};
  for (const row of data) {
    out[row.site_id as string] = {
      taskCount: Number(row.task_count ?? 0),
      projectTitle: (row.project_title as string) ?? null,
      importedAt: row.imported_at as string,
    };
  }
  return out;
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

  const name = file.name.toLowerCase();
  if (!name.endsWith('.xml')) {
    return {
      error:
        'Format attendu : export XML depuis MS Project (Fichier → Exporter → Enregistrer sous → XML).',
    };
  }

  try {
    const text = await file.text();
    const parsed = parseMsProjectXml(text);
    return {
      preview: {
        ...summarizeScheduleImport(parsed),
        projectTitle: parsed.projectTitle,
        warnings: parsed.warnings,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Lecture du fichier XML impossible.' };
  }
}

export async function importBtpSiteSchedule(formData: FormData): Promise<
  | { success: true; summary: ReturnType<typeof summarizeScheduleImport> & { projectTitle: string } }
  | { error: string }
> {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Seuls les directeurs peuvent importer un planning.' };

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const siteId = (formData.get('site_id') as string)?.trim();
  if (!siteId) return { error: 'Chantier requis.' };

  const file = formData.get('file') as File | null;
  if (!file) return { error: 'Fichier XML requis.' };

  const { data: site, error: siteErr } = await supabase
    .from('btp_sites')
    .select('id')
    .eq('id', siteId)
    .eq('organization_id', orgId)
    .single();
  if (siteErr || !site) return { error: 'Chantier introuvable.' };

  let parsed;
  try {
    parsed = parseMsProjectXml(await file.text());
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Import XML impossible.' };
  }

  const summary = summarizeScheduleImport(parsed);
  const row = {
    organization_id: orgId,
    site_id: siteId,
    source_filename: file.name,
    project_title: parsed.projectTitle,
    start_date: parsed.startDate,
    end_date: parsed.endDate,
    task_count: parsed.tasks.length,
    tasks: parsed.tasks,
    imported_by: user?.id ?? null,
    imported_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await supabase.from('btp_site_schedules').upsert(row, {
    onConflict: 'site_id',
  });
  if (upsertErr) return { error: upsertErr.message };

  if (parsed.startDate && parsed.endDate) {
    await supabase
      .from('btp_sites')
      .update({
        start_date: parsed.startDate,
        end_date: parsed.endDate,
      })
      .eq('id', siteId)
      .eq('organization_id', orgId);
  }

  revalidatePath('/btp/chantiers');
  revalidatePath('/btp/avancement');
  revalidatePath('/btp/rapports');

  return {
    success: true,
    summary: { ...summary, projectTitle: parsed.projectTitle },
  };
}

export async function removeBtpSiteSchedule(siteId: string): Promise<{ success: true } | { error: string }> {
  const canManage = await canManageAssignments();
  if (!canManage) return { error: 'Seuls les directeurs peuvent supprimer un planning importé.' };

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { error } = await supabase
    .from('btp_site_schedules')
    .delete()
    .eq('site_id', siteId)
    .eq('organization_id', orgId);
  if (error) return { error: error.message };

  revalidatePath('/btp/chantiers');
  revalidatePath('/btp/avancement');
  revalidatePath('/btp/rapports');
  return { success: true };
}

export async function getBtpPlannedProgressPreview(
  siteId: string,
  progressDate: string,
  actualPct: number
): Promise<BtpPlannedProgressSnapshot | null> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const [{ data: site }, { data: schedule }, { data: milestones }] = await Promise.all([
    supabase
      .from('btp_sites')
      .select(
        'id, client, contract_ref, start_date, end_date, budget, spent, description, moa_recipient, planned_avg_workers, planned_monthly_fuel_liters, budget_alert_pct, budget_breakdown'
      )
      .eq('id', siteId)
      .eq('organization_id', orgId)
      .single(),
    supabase.from('btp_site_schedules').select('*').eq('site_id', siteId).maybeSingle(),
    supabase
      .from('btp_site_milestones')
      .select('id, label, target_physical_pct, planned_date, sort_order')
      .eq('site_id', siteId)
      .order('sort_order'),
  ]);

  if (!site) return null;

  const baseline = mapSiteRowToBaseline(
    site,
    (milestones ?? []).map((m) => ({
      id: m.id as string,
      label: m.label as string,
      targetPhysicalPct: Number(m.target_physical_pct),
      plannedDate: (m.planned_date as string).slice(0, 10),
      sortOrder: Number(m.sort_order ?? 0),
    }))
  );

  const scheduleTasks = schedule ? mapScheduleRow(schedule).tasks : null;
  const source: BtpPlannedProgressSnapshot['source'] =
    scheduleTasks && scheduleTasks.length > 0
      ? 'ms_project'
      : baseline.milestones.length > 0
        ? 'milestones'
        : 'linear';

  const plannedPct = plannedPhysicalPctAt(baseline, progressDate.slice(0, 10), scheduleTasks);
  return comparePlannedVsActual(plannedPct, actualPct, source);
}
