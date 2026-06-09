import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentExtractionResult } from '@/lib/documents/extract-document-text';
import type { CaptureExtractionResult } from '@/lib/ai/extraction/capture-extract-types';

const EXCERPT_LEN = 500;

export async function persistDocumentExtraction(
  supabase: SupabaseClient,
  params: {
    documentId: string;
    organizationId: string;
    fileName: string;
    previousExtracted: Record<string, unknown>;
    result: DocumentExtractionResult;
    captureExtraction?: CaptureExtractionResult | null;
  }
): Promise<void> {
  const { documentId, result, previousExtracted, fileName, captureExtraction } = params;
  const hasText = result.text.length > 20;

  const extracted_data: Record<string, unknown> = {
    ...previousExtracted,
    extraction_status: result.status,
    extraction_method: result.method,
    extraction_message: result.message ?? null,
    extraction_at: new Date().toISOString(),
    char_count: result.text.length,
    text_excerpt: hasText ? result.text.slice(0, EXCERPT_LEN) : null,
  };

  if (hasText) {
    extracted_data.full_text_preview = result.text.slice(0, 8000);
  }

  if (captureExtraction) {
    extracted_data.capture_extraction = captureExtraction;
  }

  const status = hasText ? 'archived' : result.status === 'skipped' ? 'classified' : 'error';

  await supabase
    .from('documents')
    .update({
      search_text: hasText ? result.text : null,
      status,
      extracted_data,
    })
    .eq('id', documentId);

  await supabase.from('document_extractions').delete().eq('document_id', documentId);

  if (hasText) {
    await supabase.from('document_extractions').insert({
      document_id: documentId,
      field_name: 'full_text',
      field_value: result.text.slice(0, 50_000),
      confidence: result.method === 'vision' ? 75 : 90,
    });

    const chunkSize = 4000;
    let chunkIndex = 0;
    for (let i = 0; i < result.text.length && chunkIndex < 25; i += chunkSize, chunkIndex++) {
      await supabase.from('document_extractions').insert({
        document_id: documentId,
        field_name: `chunk_${chunkIndex}`,
        field_value: result.text.slice(i, i + chunkSize),
        confidence: 85,
      });
    }
  } else if (result.message) {
    await supabase.from('document_extractions').insert({
      document_id: documentId,
      field_name: 'extraction_note',
      field_value: `${fileName}: ${result.message}`,
      confidence: null,
    });
  }
}
