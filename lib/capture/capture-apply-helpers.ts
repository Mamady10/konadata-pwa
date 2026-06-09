import type { SupabaseClient } from '@supabase/supabase-js';
import { parseCaptureExtraction } from '@/lib/ai/extraction/capture-extraction-parse';
import type { CaptureExtractionResult } from '@/lib/ai/extraction/capture-extract-types';

import type { ReportCardsSuggestion } from '@/lib/school/grades-to-bulletins';

export interface CaptureApplyResult {
  error?: string;
  saved?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  message?: string;
  extraExtracted?: Record<string, unknown>;
  reportCards?: ReportCardsSuggestion;
}

export function parseNumericValue(raw?: string | null): number | null {
  if (!raw?.trim()) return null;
  const cleaned = raw.replace(/\s/g, '').replace(/[^\d,.-]/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseIntegerValue(raw?: string | null): number | null {
  const n = parseNumericValue(raw);
  if (n === null) return null;
  return Math.round(n);
}

export function parseOptionalDate(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const fr = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (fr) {
    const y = fr[3].length === 2 ? `20${fr[3]}` : fr[3];
    const m = fr[2].padStart(2, '0');
    const d = fr[1].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

export function normalizePersonName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function currentAcademicYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export async function loadCaptureDocument(
  supabase: SupabaseClient,
  orgId: string,
  documentId: string
): Promise<
  | { error: string }
  | {
      extracted: Record<string, unknown>;
      capture: CaptureExtractionResult;
      documentId: string;
    }
> {
  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, extracted_data')
    .eq('id', documentId)
    .eq('organization_id', orgId)
    .single();

  if (error || !doc) return { error: 'Document introuvable.' };

  const extracted = (doc.extracted_data as Record<string, unknown>) ?? {};
  const capture = parseCaptureExtraction(extracted);
  if (!capture || capture.status === 'failed') {
    return { error: 'Aucune extraction structurée exploitable sur ce document.' };
  }

  return { extracted, capture, documentId: doc.id as string };
}

export async function resolveBtpSiteIdForDocument(
  supabase: SupabaseClient,
  orgId: string,
  documentId: string,
  extracted: Record<string, unknown>,
  siteIdParam?: string
): Promise<string | { error: string }> {
  if (siteIdParam?.trim()) return siteIdParam.trim();

  const fromMeta = String(extracted.site_id ?? '').trim();
  if (fromMeta) return fromMeta;

  const { data: link } = await supabase
    .from('btp_site_documents')
    .select('site_id')
    .eq('organization_id', orgId)
    .eq('document_id', documentId)
    .maybeSingle();

  if (link?.site_id) return link.site_id as string;
  return { error: 'Sélectionnez un chantier.' };
}

export async function resolveNgoProjectIdForDocument(
  supabase: SupabaseClient,
  orgId: string,
  documentId: string,
  extracted: Record<string, unknown>,
  projectIdParam?: string
): Promise<string | { error: string }> {
  if (projectIdParam?.trim()) return projectIdParam.trim();

  const fromMeta = String(extracted.project_id ?? '').trim();
  if (fromMeta) return fromMeta;

  const { data: link } = await supabase
    .from('ngo_project_documents')
    .select('project_id')
    .eq('organization_id', orgId)
    .eq('document_id', documentId)
    .maybeSingle();

  if (link?.project_id) return link.project_id as string;
  return { error: 'Sélectionnez un projet.' };
}

export async function markDocumentCaptureApplied(
  supabase: SupabaseClient,
  documentId: string,
  orgId: string,
  extracted: Record<string, unknown>,
  applyResult: CaptureApplyResult & { kind: string }
): Promise<void> {
  await supabase
    .from('documents')
    .update({
      extracted_data: {
        ...extracted,
        ...(applyResult.extraExtracted ?? {}),
        capture_apply: {
          kind: applyResult.kind,
          applied_at: new Date().toISOString(),
          saved: applyResult.saved ?? applyResult.created ?? applyResult.updated ?? 0,
          skipped: applyResult.skipped ?? 0,
          message: applyResult.message ?? null,
        },
      },
    })
    .eq('id', documentId)
    .eq('organization_id', orgId);
}
