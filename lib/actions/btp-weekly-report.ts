'use server';

import { revalidatePath } from 'next/cache';
import { requireOrgId } from '@/lib/actions/org';
import { canManageAssignments, getMyAssignedBtpSiteIds } from '@/lib/actions/assignments';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/auth';
import {
  BTP_WEEKLY_SITE_REPORT_LABEL,
  BTP_WEEKLY_SITE_REPORT_TYPE,
  compileBtpWeeklySiteReport,
} from '@/lib/btp/compile-weekly-site-report';
import { getDefaultPeriodValue, type ReportPeriodType } from '@/lib/btp/report-period';
import type { ReportSection } from '@/lib/ai/reports/render-report';
import type { WeeklyReportExportStructured } from '@/lib/btp/weekly-report-export-types';

export type CompileBtpWeeklyReportResult =
  | { error: string }
  | {
      report: string;
      title: string;
      subtitle: string;
      periodType: ReportPeriodType;
      periodValue: string;
      periodLabel: string;
      isoWeek: string;
      scopeLabel: string;
      orgName: string | null;
      sections: ReportSection[];
      structured: WeeklyReportExportStructured;
      stats: {
        dailyEntries: number;
        fuelLogs: number;
        deliveryNotes: number;
        hseMentions: number;
      };
      archived: boolean;
      archiveId?: string;
      usedLlm: false;
    };

async function assertCanCompileSite(siteId: string): Promise<{ error: string } | { ok: true }> {
  const assigned = await getMyAssignedBtpSiteIds();
  if (assigned === null) return { ok: true };
  if (!assigned.includes(siteId)) {
    return { error: 'Vous n\'êtes pas assigné à ce chantier.' };
  }
  return { ok: true };
}

async function saveWeeklyReportArchive(params: {
  scopeId: string;
  scopeLabel: string;
  title: string;
  subtitle: string;
  content: string;
  periodValue: string;
}): Promise<{ id: string } | { error: string }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('organization_ai_generated_reports')
    .insert({
      organization_id: orgId,
      sector: 'btp',
      scope_id: params.scopeId,
      scope_label: params.scopeLabel,
      report_type: BTP_WEEKLY_SITE_REPORT_TYPE,
      report_type_label: BTP_WEEKLY_SITE_REPORT_LABEL,
      title: params.title,
      subtitle: `${params.subtitle} · ${params.periodValue}`,
      content: params.content,
      engine: 'local',
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/btp/rapports');
  return { id: data.id as string };
}

export async function compileBtpWeeklySiteReportAction(
  formData: FormData
): Promise<CompileBtpWeeklyReportResult> {
  const siteId = String(formData.get('site_id') ?? '').trim();
  const periodTypeRaw = String(formData.get('period_type') ?? 'week').trim();
  const periodType: ReportPeriodType =
    periodTypeRaw === 'month' || periodTypeRaw === 'quarter' || periodTypeRaw === 'year'
      ? periodTypeRaw
      : 'week';
  const periodValue =
    String(formData.get('period_value') ?? '').trim() || getDefaultPeriodValue(periodType);
  const weeklyComment = String(formData.get('weekly_comment') ?? '').trim();
  const planningRefSlot = Number(formData.get('planning_ref_slot') ?? 1) === 2 ? 2 : 1;

  if (!siteId) return { error: 'Chantier requis.' };

  const access = await assertCanCompileSite(siteId);
  if ('error' in access) return access;

  try {
    const orgId = await requireOrgId();
    const session = await getSession();
    const org = session?.profile?.organizations as { name?: string } | null;

    const compiled = await compileBtpWeeklySiteReport({
      orgId,
      siteId,
      periodType,
      periodValue,
      weeklyComment: weeklyComment || null,
      orgName: org?.name ?? null,
      planningRefSlot,
    });

    const isDirector = await canManageAssignments();
    let archiveId: string | undefined;
    let archived = false;

    if (isDirector) {
      const saved = await saveWeeklyReportArchive({
        scopeId: siteId,
        scopeLabel: compiled.scopeLabel,
        title: compiled.title,
        subtitle: compiled.subtitle,
        content: compiled.report,
        periodValue: compiled.periodValue,
      });
      if ('error' in saved) return { error: saved.error };
      archiveId = saved.id;
      archived = true;
    }

    return {
      report: compiled.report,
      title: compiled.title,
      subtitle: compiled.subtitle,
      periodType: compiled.periodType,
      periodValue: compiled.periodValue,
      periodLabel: compiled.periodLabel,
      isoWeek: compiled.isoWeek,
      scopeLabel: compiled.scopeLabel,
      orgName: org?.name ?? null,
      sections: compiled.sections,
      structured: compiled.structured,
      stats: compiled.stats,
      archived,
      archiveId,
      usedLlm: false,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Compilation impossible.' };
  }
}
