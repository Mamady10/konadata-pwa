import type { SupabaseClient } from '@supabase/supabase-js';
import { processDocumentAfterUpload } from '@/lib/documents/process-document-after-upload';

export async function indexUploadedDocument(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    documentId: string;
    filePath: string;
    fileName: string;
    mimeType: string | null;
    fileBuffer: Buffer;
    previousExtracted?: Record<string, unknown>;
  }
): Promise<{ charCount: number; message?: string }> {
  try {
    const res = await processDocumentAfterUpload(supabase, {
      documentId: params.documentId,
      organizationId: params.organizationId,
      filePath: params.filePath,
      fileName: params.fileName,
      mimeType: params.mimeType,
      fileBuffer: params.fileBuffer,
      previousExtracted: params.previousExtracted,
    });
    return { charCount: res.charCount, message: res.message };
  } catch (e) {
    console.error('[indexUploadedDocument]', e);
    return {
      charCount: 0,
      message: e instanceof Error ? e.message : 'Indexation impossible',
    };
  }
}
