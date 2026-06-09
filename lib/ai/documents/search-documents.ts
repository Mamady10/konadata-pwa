import { createClient } from '@/lib/supabase/server';

export interface DocumentSearchHit {
  documentId: string;
  fileName: string;
  excerpt: string;
  rank: number;
  /** Passage centré sur la requête si disponible */
  snippet: string;
}

function buildSnippet(text: string, query: string, radius = 220): string {
  const lower = text.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q || !lower) return text.slice(0, radius * 2);

  const words = q.split(/\s+/).filter((w) => w.length > 2);
  let idx = -1;
  for (const w of words) {
    idx = lower.indexOf(w);
    if (idx >= 0) break;
  }
  if (idx < 0) return text.slice(0, radius * 2);

  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return prefix + text.slice(start, end).replace(/\s+/g, ' ') + suffix;
}

export async function searchOrganizationDocuments(
  orgId: string,
  query: string,
  limit = 8
): Promise<DocumentSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();

  const { data: rpcData, error: rpcErr } = await supabase.rpc('search_organization_documents', {
    p_org_id: orgId,
    p_query: q,
    p_limit: limit,
  });

  if (!rpcErr && rpcData?.length) {
    const ids = rpcData.map((r: { document_id: string }) => r.document_id);
    const { data: fullRows } = await supabase
      .from('documents')
      .select('id, search_text')
      .in('id', ids);

    const textById = new Map(
      (fullRows ?? []).map((d) => [d.id as string, (d.search_text as string) ?? ''])
    );

    return rpcData.map((row: { document_id: string; file_name: string; excerpt: string; rank: number }) => {
      const full = textById.get(row.document_id) ?? row.excerpt ?? '';
      return {
        documentId: row.document_id,
        fileName: row.file_name,
        excerpt: row.excerpt ?? '',
        rank: Number(row.rank ?? 0),
        snippet: buildSnippet(full, q),
      };
    });
  }

  const pattern = `%${q.replace(/%/g, '')}%`;
  const { data: fallback } = await supabase
    .from('documents')
    .select('id, file_name, search_text, created_at')
    .eq('organization_id', orgId)
    .not('search_text', 'is', null)
    .ilike('search_text', pattern)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (fallback ?? []).map((d) => {
    const text = (d.search_text as string) ?? '';
    return {
      documentId: d.id as string,
      fileName: d.file_name as string,
      excerpt: text.slice(0, 500),
      rank: 0.1,
      snippet: buildSnippet(text, q),
    };
  });
}

export async function getRecentIndexedDocuments(
  orgId: string,
  limit = 5
): Promise<DocumentSearchHit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('documents')
    .select('id, file_name, search_text, extracted_data')
    .eq('organization_id', orgId)
    .not('search_text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((d) => {
    const text = (d.search_text as string) ?? '';
    const ext = d.extracted_data as Record<string, unknown> | null;
    return {
      documentId: d.id as string,
      fileName: d.file_name as string,
      excerpt: text.slice(0, 400),
      rank: 0,
      snippet: (ext?.text_excerpt as string) ?? text.slice(0, 400),
    };
  });
}

export function formatDocumentHitsForChat(
  hits: DocumentSearchHit[],
  query?: string
): string {
  if (hits.length === 0) {
    return query
      ? '=== Documents indexés ===\nAucun document ne correspond à la recherche.'
      : '=== Documents indexés ===\nAucun document textuel indexé pour cette organisation.';
  }

  const lines = ['=== Extraits de documents indexés (PDF, Word, OCR) ==='];
  for (const h of hits) {
    lines.push(
      '',
      `• Fichier : « ${h.fileName} » (id: ${h.documentId})`,
      `  Extrait : ${h.snippet}`
    );
  }
  lines.push(
    '',
    'Citez le nom du fichier lorsque vous vous appuyez sur ces extraits.'
  );
  return lines.join('\n');
}
