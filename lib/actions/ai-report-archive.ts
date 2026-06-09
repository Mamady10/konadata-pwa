'use server';

import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { canManageAssignments } from '@/lib/actions/assignments';
import { revalidatePath } from 'next/cache';
import type { TemplateSector } from '@/lib/ai/document-template-purposes';

export type AiReportSector = TemplateSector;

export interface AiGeneratedReportRow {
  id: string;
  title: string;
  subtitle: string | null;
  scopeLabel: string;
  reportTypeLabel: string;
  engine: 'local' | 'openai';
  createdAt: string;
}

export interface AiGeneratedReportDetail extends AiGeneratedReportRow {
  content: string;
  scopeId: string;
  reportType: string;
  sector: AiReportSector;
}

async function requireDirectorArchive(): Promise<{ error: string } | { ok: true }> {
  const ok = await canManageAssignments();
  if (!ok) return { error: 'Accès réservé aux directeurs.' };
  return { ok: true };
}

function revalidateSectorRapports(sector: AiReportSector) {
  if (sector === 'btp') revalidatePath('/btp/rapports');
  if (sector === 'ngo') revalidatePath('/ong/rapports');
  if (sector === 'school') revalidatePath('/etablissement/rapports');
}

export async function saveAiGeneratedReport(params: {
  sector: AiReportSector;
  scopeId: string;
  scopeLabel: string;
  reportType: string;
  reportTypeLabel: string;
  title: string;
  subtitle?: string | null;
  content: string;
  usedLlm: boolean;
}): Promise<{ id: string } | { error: string }> {
  const guard = await requireDirectorArchive();
  if ('error' in guard) return guard;

  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('organization_ai_generated_reports')
    .insert({
      organization_id: orgId,
      sector: params.sector,
      scope_id: params.scopeId,
      scope_label: params.scopeLabel,
      report_type: params.reportType,
      report_type_label: params.reportTypeLabel,
      title: params.title,
      subtitle: params.subtitle ?? null,
      content: params.content,
      engine: params.usedLlm ? 'openai' : 'local',
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  revalidateSectorRapports(params.sector);
  return { id: data.id as string };
}

export async function listAiGeneratedReports(
  sector: AiReportSector,
  limit = 30
): Promise<AiGeneratedReportRow[] | { error: string }> {
  const guard = await requireDirectorArchive();
  if ('error' in guard) return guard;

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organization_ai_generated_reports')
    .select('id, title, subtitle, scope_label, report_type_label, engine, created_at')
    .eq('organization_id', orgId)
    .eq('sector', sector)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { error: error.message };

  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    subtitle: (r.subtitle as string) || null,
    scopeLabel: r.scope_label as string,
    reportTypeLabel: r.report_type_label as string,
    engine: r.engine as 'local' | 'openai',
    createdAt: r.created_at as string,
  }));
}

export async function getAiGeneratedReport(
  reportId: string
): Promise<AiGeneratedReportDetail | { error: string }> {
  const guard = await requireDirectorArchive();
  if ('error' in guard) return guard;

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organization_ai_generated_reports')
    .select('*')
    .eq('id', reportId)
    .eq('organization_id', orgId)
    .single();

  if (error || !data) return { error: 'Rapport introuvable.' };

  return {
    id: data.id as string,
    title: data.title as string,
    subtitle: (data.subtitle as string) || null,
    scopeLabel: data.scope_label as string,
    reportTypeLabel: data.report_type_label as string,
    engine: data.engine as 'local' | 'openai',
    createdAt: data.created_at as string,
    content: data.content as string,
    scopeId: data.scope_id as string,
    reportType: data.report_type as string,
    sector: data.sector as AiReportSector,
  };
}

export async function deleteAiGeneratedReport(
  reportId: string
): Promise<{ success: true } | { error: string }> {
  const guard = await requireDirectorArchive();
  if ('error' in guard) return guard;

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from('organization_ai_generated_reports')
    .select('sector')
    .eq('id', reportId)
    .eq('organization_id', orgId)
    .maybeSingle();

  const { error } = await supabase
    .from('organization_ai_generated_reports')
    .delete()
    .eq('id', reportId)
    .eq('organization_id', orgId);

  if (error) return { error: error.message };

  if (row?.sector) revalidateSectorRapports(row.sector as AiReportSector);
  return { success: true };
}
