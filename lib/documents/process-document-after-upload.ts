import type { SupabaseClient } from '@supabase/supabase-js';
import { extractDocumentText } from '@/lib/documents/extract-document-text';
import { persistDocumentExtraction } from '@/lib/documents/persist-document-extraction';
import { extractCaptureStructured } from '@/lib/ai/extraction/capture-extract';
import { isKonadataCaptureDocumentType } from '@/lib/ai/extraction/capture-extraction-parse';

/**
 * Extrait et indexe le texte d'un document déjà enregistré en base + storage.
 */
export async function processDocumentAfterUpload(
  supabase: SupabaseClient,
  params: {
    documentId: string;
    organizationId: string;
    filePath: string;
    fileName: string;
    mimeType: string | null;
    fileBuffer?: Buffer;
    previousExtracted?: Record<string, unknown>;
  }
): Promise<{ ok: boolean; charCount: number; message?: string }> {
  const { documentId, organizationId, filePath, fileName, mimeType } = params;

  let buffer = params.fileBuffer;
  if (!buffer) {
    const { data: blob, error: dlErr } = await supabase.storage
      .from('documents')
      .download(filePath);
    if (dlErr || !blob) {
      return { ok: false, charCount: 0, message: dlErr?.message ?? 'Téléchargement storage impossible' };
    }
    buffer = Buffer.from(await blob.arrayBuffer());
  }

  await supabase
    .from('documents')
    .update({ status: 'processing' })
    .eq('id', documentId);

  const result = await extractDocumentText({
    buffer,
    fileName,
    mimeType,
    organizationId,
  });

  const previousExtracted = params.previousExtracted ?? {};
  const documentType = String(previousExtracted.document_type ?? '');
  let captureExtraction = null;

  if (isKonadataCaptureDocumentType(documentType)) {
    try {
      captureExtraction = await extractCaptureStructured({
        templateId: documentType,
        text: result.text,
        buffer,
        fileName,
        mimeType,
        organizationId,
      });
    } catch (e) {
      console.error('[processDocumentAfterUpload] capture extraction', e);
    }
  }

  await persistDocumentExtraction(supabase, {
    documentId,
    organizationId,
    fileName,
    previousExtracted,
    result,
    captureExtraction,
  });

  return {
    ok: result.text.length > 20,
    charCount: result.text.length,
    message: result.message,
  };
}
