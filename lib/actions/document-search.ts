'use server';

import { requireOrgId } from '@/lib/actions/org';
import { createClient } from '@/lib/supabase/server';
import {
  searchOrganizationDocuments,
  type DocumentSearchHit,
} from '@/lib/ai/documents/search-documents';
import { processDocumentAfterUpload } from '@/lib/documents/process-document-after-upload';

export type { DocumentSearchHit };

export async function searchOrgDocuments(
  query: string,
  limit = 10
): Promise<DocumentSearchHit[] | { error: string }> {
  const q = query?.trim();
  if (!q || q.length < 2) return { error: 'Saisissez au moins 2 caractères.' };

  try {
    const orgId = await requireOrgId();
    return await searchOrganizationDocuments(orgId, q, limit);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Recherche impossible' };
  }
}

export async function reindexDocument(
  documentId: string
): Promise<{ ok: boolean; charCount: number; message?: string } | { error: string }> {
  if (!documentId?.trim()) return { error: 'Document invalide.' };

  try {
    const orgId = await requireOrgId();
    const supabase = await createClient();

    const { data: doc, error } = await supabase
      .from('documents')
      .select('id, organization_id, file_path, file_name, mime_type, extracted_data')
      .eq('id', documentId.trim())
      .eq('organization_id', orgId)
      .single();

    if (error || !doc) return { error: 'Document introuvable.' };

    const res = await processDocumentAfterUpload(supabase, {
      documentId: doc.id as string,
      organizationId: orgId,
      filePath: doc.file_path as string,
      fileName: doc.file_name as string,
      mimeType: (doc.mime_type as string) ?? null,
      previousExtracted: (doc.extracted_data as Record<string, unknown>) ?? {},
    });

    return { ok: res.ok, charCount: res.charCount, message: res.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Réindexation impossible' };
  }
}

export async function getOrgIndexedDocumentStats(): Promise<
  | { indexed: number; total: number }
  | { error: string }
> {
  try {
    const orgId = await requireOrgId();
    const supabase = await createClient();

    const [totalRes, indexedRes] = await Promise.all([
      supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId),
      supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .not('search_text', 'is', null),
    ]);

    return {
      total: totalRes.count ?? 0,
      indexed: indexedRes.count ?? 0,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Statistiques indisponibles' };
  }
}
