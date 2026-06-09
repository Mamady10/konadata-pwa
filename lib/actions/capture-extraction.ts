'use server';

import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { revalidatePath } from 'next/cache';
import { processDocumentAfterUpload } from '@/lib/documents/process-document-after-upload';
import { parseCaptureExtraction } from '@/lib/ai/extraction/capture-extraction-parse';
import { importSchoolStudentsBatch } from '@/lib/actions/school';
import type { StudentImportRow } from '@/lib/school/student-import';

export async function reRunCaptureExtraction(
  documentId: string
): Promise<{ error?: string; ok?: boolean }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, file_path, file_name, mime_type, extracted_data')
    .eq('id', documentId)
    .eq('organization_id', orgId)
    .single();

  if (error || !doc) return { error: 'Document introuvable.' };

  const extracted = (doc.extracted_data as Record<string, unknown>) ?? {};
  const docType = String(extracted.document_type ?? '');
  if (!docType.startsWith('konadata_')) {
    return { error: 'Ce document n\'est pas un modèle KonaData.' };
  }

  const res = await processDocumentAfterUpload(supabase, {
    documentId: doc.id as string,
    organizationId: orgId,
    filePath: doc.file_path as string,
    fileName: doc.file_name as string,
    mimeType: (doc.mime_type as string) ?? null,
    previousExtracted: extracted,
  });

  revalidatePath('/ong/documents');
  revalidatePath('/btp/documents');
  revalidatePath('/pme/documents');
  revalidatePath('/etablissement/rapports');
  revalidatePath('/etablissement/resultats');

  if (!res.ok && res.charCount < 20) {
    return { error: res.message ?? 'Extraction impossible.' };
  }
  return { ok: true };
}

export async function applySchoolClassListFromCaptureDocument(
  documentId: string,
  classId: string
): Promise<{ error?: string; created?: number; updated?: number }> {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: doc, error } = await supabase
    .from('documents')
    .select('extracted_data')
    .eq('id', documentId)
    .eq('organization_id', orgId)
    .single();

  if (error || !doc) return { error: 'Document introuvable.' };

  const capture = parseCaptureExtraction(doc.extracted_data as Record<string, unknown>);
  if (!capture || capture.kind !== 'class_list') {
    return { error: 'Ce document ne contient pas une liste de classe structurée.' };
  }
  if (capture.payload.shape !== 'person_rows' || !capture.payload.rows.length) {
    return { error: 'Aucune ligne exploitable pour l\'import.' };
  }

  const rows: StudentImportRow[] = capture.payload.rows
    .filter((r) => r.full_name?.trim())
    .map((r, i) => ({
      full_name: r.full_name.trim(),
      matricule: r.identifier?.trim(),
      phone: r.phone?.trim(),
      email: r.email?.trim(),
      sourceLine: i + 2,
    }));

  const result = await importSchoolStudentsBatch(classId, rows, 'enrolled', {
    autoGenerateMatricules: true,
  });

  if ('error' in result) return { error: result.error };

  revalidatePath('/etablissement/etudiants');
  revalidatePath('/etablissement/rapports');

  return { created: result.created, updated: result.updated };
}
