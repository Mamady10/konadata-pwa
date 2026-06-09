'use server';

import { requireOrgId } from '@/lib/actions/org';
import { canManageAssignments } from '@/lib/actions/assignments';
import { saveAiGeneratedReport } from '@/lib/actions/ai-report-archive';
import { gatherBtpReport } from '@/lib/ai/reports/gather-btp';
import { gatherNgoReport } from '@/lib/ai/reports/gather-ngo';
import { gatherSchoolReport } from '@/lib/ai/reports/gather-school';
import { finalizeSectorReport } from '@/lib/ai/reports/render-report';
import { getAiReportTypeLabel } from '@/lib/ai/report-type-label';
import type { BtpAiReportType, NgoAiReportType, SchoolAiReportType } from '@/lib/ai/sector-report-types';
import {
  BTP_AI_REPORT_TYPES,
  NGO_AI_REPORT_TYPES,
  SCHOOL_AI_REPORT_TYPES,
  SCOPE_ALL,
} from '@/lib/ai/sector-report-types';

async function requireDirector(): Promise<{ error: string } | { ok: true }> {
  const isDirector = await canManageAssignments();
  if (!isDirector) {
    return { error: 'Cette fonction est réservée aux directeurs de l\'organisation.' };
  }
  return { ok: true };
}

export type GenerateAiReportResult =
  | { error: string }
  | {
      report: string;
      usedLlm: boolean;
      title: string;
      archiveId: string;
      archived: true;
    };

async function archiveReport(params: {
  sector: 'btp' | 'ngo' | 'school';
  scopeId: string;
  scopeLabel: string;
  reportType: string;
  title: string;
  subtitle: string;
  content: string;
  usedLlm: boolean;
}): Promise<{ archiveId: string } | { error: string }> {
  const saved = await saveAiGeneratedReport({
    sector: params.sector,
    scopeId: params.scopeId,
    scopeLabel: params.scopeLabel,
    reportType: params.reportType,
    reportTypeLabel: getAiReportTypeLabel(params.sector, params.reportType),
    title: params.title,
    subtitle: params.subtitle,
    content: params.content,
    usedLlm: params.usedLlm,
  });
  if ('error' in saved) return saved;
  return { archiveId: saved.id };
}

export async function generateBtpAiReport(
  siteId: string,
  reportType: BtpAiReportType
): Promise<GenerateAiReportResult> {
  const guard = await requireDirector();
  if ('error' in guard) return guard;

  const valid = BTP_AI_REPORT_TYPES.some((t) => t.id === reportType);
  if (!valid || !siteId?.trim()) return { error: 'Paramètres invalides.' };

  try {
    const orgId = await requireOrgId();
    const gathered = await gatherBtpReport(orgId, siteId.trim(), reportType);
    const { report, usedLlm } = await finalizeSectorReport({
      title: gathered.title,
      subtitle: gathered.subtitle,
      contextText: gathered.contextText,
      offlineSections: gathered.sections,
      organizationId: orgId,
    });

    const archived = await archiveReport({
      sector: 'btp',
      scopeId: siteId.trim(),
      scopeLabel: gathered.scopeLabel,
      reportType,
      title: gathered.title,
      subtitle: gathered.subtitle,
      content: report,
      usedLlm,
    });
    if ('error' in archived) return { error: archived.error };

    return {
      report,
      usedLlm,
      title: gathered.title,
      archiveId: archived.archiveId,
      archived: true,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Impossible de générer le rapport.' };
  }
}

export async function generateNgoAiReport(
  projectId: string,
  reportType: NgoAiReportType
): Promise<GenerateAiReportResult> {
  const guard = await requireDirector();
  if ('error' in guard) return guard;

  const valid = NGO_AI_REPORT_TYPES.some((t) => t.id === reportType);
  if (!valid || !projectId?.trim()) return { error: 'Paramètres invalides.' };

  try {
    const orgId = await requireOrgId();
    const gathered = await gatherNgoReport(orgId, projectId.trim(), reportType);
    const { report, usedLlm } = await finalizeSectorReport({
      title: gathered.title,
      subtitle: gathered.subtitle,
      contextText: gathered.contextText,
      offlineSections: gathered.sections,
      organizationId: orgId,
    });

    const archived = await archiveReport({
      sector: 'ngo',
      scopeId: projectId.trim(),
      scopeLabel: gathered.scopeLabel,
      reportType,
      title: gathered.title,
      subtitle: gathered.subtitle,
      content: report,
      usedLlm,
    });
    if ('error' in archived) return { error: archived.error };

    return {
      report,
      usedLlm,
      title: gathered.title,
      archiveId: archived.archiveId,
      archived: true,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Impossible de générer le rapport.' };
  }
}

export async function generateSchoolAiReport(
  classId: string,
  reportType: SchoolAiReportType
): Promise<GenerateAiReportResult> {
  const guard = await requireDirector();
  if ('error' in guard) return guard;

  const valid = SCHOOL_AI_REPORT_TYPES.some((t) => t.id === reportType);
  if (!valid || !classId?.trim()) return { error: 'Paramètres invalides.' };

  try {
    const orgId = await requireOrgId();
    const gathered = await gatherSchoolReport(
      orgId,
      classId.trim(),
      reportType,
      reportType === 'monthly'
        ? { month: new Date().getMonth() + 1, year: new Date().getFullYear() }
        : undefined
    );
    const { report, usedLlm } = await finalizeSectorReport({
      title: gathered.title,
      subtitle: gathered.subtitle,
      contextText: gathered.contextText,
      offlineSections: gathered.sections,
      organizationId: orgId,
    });

    const archived = await archiveReport({
      sector: 'school',
      scopeId: classId.trim(),
      scopeLabel: gathered.scopeLabel,
      reportType,
      title: gathered.title,
      subtitle: gathered.subtitle,
      content: report,
      usedLlm,
    });
    if ('error' in archived) return { error: archived.error };

    return {
      report,
      usedLlm,
      title: gathered.title,
      archiveId: archived.archiveId,
      archived: true,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Impossible de générer le rapport.' };
  }
}

/** Rapport mensuel direction — établissement entier, mois en cours, 1 clic. */
export async function generateSchoolMonthlyReport(): Promise<GenerateAiReportResult> {
  return generateSchoolAiReport(SCOPE_ALL, 'monthly');
}
