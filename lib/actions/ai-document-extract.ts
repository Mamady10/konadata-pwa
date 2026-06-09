'use server';

import { requireOrgId } from '@/lib/actions/org';
import { createClient } from '@/lib/supabase/server';
import { extractDocumentForAi } from '@/lib/ai/extraction/extract-document-for-ai';
import {
  purposeForOrgType,
  type RosterExtractPurpose,
  type RosterExtractResult,
} from '@/lib/ai/extraction/roster-extract';
import { getOrganizationAiQuotaStatus } from '@/lib/ai/quota/ai-quota';

export type AiDocumentExtractPreview = {
  extractionMethod: string;
  extractionStatus: string;
  charCount: number;
  message?: string;
  roster: RosterExtractResult | null;
  quotaHint?: string;
};

async function readOrgType(orgId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('organizations').select('type').eq('id', orgId).maybeSingle();
  return (data?.type as string) ?? null;
}

/** Extraction IA (Vision + structuration) depuis un fichier uploadé — toutes organisations. */
export async function previewAiDocumentExtract(
  formData: FormData,
  options?: { purpose?: RosterExtractPurpose; structureList?: boolean }
): Promise<AiDocumentExtractPreview | { error: string }> {
  const orgId = await requireOrgId();
  const file = formData.get('file') as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: 'Fichier requis.' };
  }

  const maxBytes = 12 * 1024 * 1024;
  if (file.size > maxBytes) {
    return { error: 'Fichier trop volumineux (max 12 Mo).' };
  }

  const allowed = /\.(pdf|png|jpe?g|webp|heic|heif|tiff?|xlsx|xls|csv)$/i;
  if (!allowed.test(file.name)) {
    return {
      error: 'Formats acceptés : PDF, images (JPG/PNG…), Excel, CSV.',
    };
  }

  const quota = await getOrganizationAiQuotaStatus(orgId);
  const quotaHint =
    'error' in quota
      ? undefined
      : !quota.visionEnabled
        ? 'OCR Vision non inclus dans votre offre — texte natif uniquement.'
        : quota.creditsRemaining <= 0
          ? 'Crédits KonaAI épuisés ce mois.'
          : undefined;

  const orgType = await readOrgType(orgId);
  const buffer = Buffer.from(await file.arrayBuffer());

  const extracted = await extractDocumentForAi({
    buffer,
    fileName: file.name,
    mimeType: file.type || null,
    organizationId: orgId,
    orgType,
    purpose: options?.purpose ?? purposeForOrgType(orgType),
    structureList: options?.structureList ?? true,
  });

  if ('error' in extracted) {
    return { error: extracted.error };
  }

  const { extraction, roster } = extracted;

  return {
    extractionMethod: extraction.method,
    extractionStatus: extraction.status,
    charCount: extraction.text.length,
    message: extraction.message,
    roster: roster ?? null,
    quotaHint,
  };
}

/** Ré-extraction depuis un document déjà en Data Factory (toutes orgs). */
export async function extractRosterFromStoredDocument(
  documentId: string,
  purpose?: RosterExtractPurpose
): Promise<AiDocumentExtractPreview | { error: string }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, file_path, file_name, mime_type, search_text, extracted_data')
    .eq('id', documentId.trim())
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error || !doc?.file_path) return { error: 'Document introuvable.' };

  const { processDocumentAfterUpload } = await import(
    '@/lib/documents/process-document-after-upload'
  );

  const { data: blob, error: dlErr } = await supabase.storage
    .from('documents')
    .download(doc.file_path as string);

  if (dlErr || !blob) return { error: dlErr?.message ?? 'Téléchargement impossible.' };

  const buffer = Buffer.from(await blob.arrayBuffer());
  const orgType = await readOrgType(orgId);

  const processed = await processDocumentAfterUpload(supabase, {
    documentId: doc.id as string,
    organizationId: orgId,
    filePath: doc.file_path as string,
    fileName: doc.file_name as string,
    mimeType: (doc.mime_type as string) ?? null,
    fileBuffer: buffer,
    previousExtracted: (doc.extracted_data as Record<string, unknown>) ?? {},
  });

  const { data: refreshed } = await supabase
    .from('documents')
    .select('search_text, extracted_data')
    .eq('id', documentId)
    .single();

  const text = (refreshed?.search_text as string)?.trim() ?? '';
  if (!text) {
    return {
      error:
        processed.message ??
        'Aucun texte extrait. Vérifiez KonaAI Vision (offre Standard+) et la qualité du scan.',
    };
  }

  const ext = (refreshed?.extracted_data ?? {}) as Record<string, unknown>;
  const { parseRosterFromExtractedText } = await import('@/lib/ai/extraction/roster-extract');

  const roster = await parseRosterFromExtractedText(
    text,
    purpose ?? purposeForOrgType(orgType),
    orgId
  );

  return {
    extractionMethod: String(ext.extraction_method ?? 'vision'),
    extractionStatus: String(ext.extraction_status ?? 'ok'),
    charCount: text.length,
    message: processed.message,
    roster,
  };
}
