import {
  formatDocumentHitsForChat,
  getRecentIndexedDocuments,
  searchOrganizationDocuments,
} from '@/lib/ai/documents/search-documents';

/** Mots-clés type « trouver document », « facture », etc. */
const SEARCH_HINT =
  /document|fichier|pdf|word|rapport|facture|bon|pièce|trouv|recherch|où est|quel.*fichier/i;

export function shouldSearchDocumentsForMessage(message: string): boolean {
  const t = message.trim();
  if (t.length < 4) return false;
  if (SEARCH_HINT.test(t)) return true;
  return t.split(/\s+/).length >= 4;
}

export async function gatherDocumentContextForChat(
  orgId: string,
  userMessage?: string
): Promise<string> {
  const query = userMessage?.trim();
  let hits;

  if (query && shouldSearchDocumentsForMessage(query)) {
    hits = await searchOrganizationDocuments(orgId, query, 6);
    if (hits.length === 0) {
      hits = await searchOrganizationDocuments(orgId, query.split(/\s+/).slice(0, 3).join(' '), 6);
    }
  } else {
    hits = await getRecentIndexedDocuments(orgId, 4);
  }

  return formatDocumentHitsForChat(hits, query);
}
