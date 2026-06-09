import 'server-only';

import { extractDocumentText, type DocumentExtractionResult } from '@/lib/documents/extract-document-text';
import {
  parseRosterFromExtractedText,
  purposeForOrgType,
  type RosterExtractPurpose,
  type RosterExtractResult,
} from '@/lib/ai/extraction/roster-extract';

export interface ExtractDocumentForAiResult {
  extraction: DocumentExtractionResult;
  roster?: RosterExtractResult;
}

/**
 * Pipeline commun : fichier → texte (PDF / Excel / image / scan Vision) → liste structurée optionnelle.
 * Utilisé par import élèves, Data Factory et futures demandes KonaAI multi-secteurs.
 */
export async function extractDocumentForAi(params: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
  organizationId: string;
  orgType?: string | null;
  purpose?: RosterExtractPurpose;
  structureList?: boolean;
}): Promise<ExtractDocumentForAiResult | { error: string }> {
  const extraction = await extractDocumentText({
    buffer: params.buffer,
    fileName: params.fileName,
    mimeType: params.mimeType,
    organizationId: params.organizationId,
  });

  if (!extraction.text.trim() && extraction.status !== 'ok') {
    return {
      error:
        extraction.message ??
        'Extraction impossible. Vérifiez le format ou votre quota KonaAI Vision.',
    };
  }

  const result: ExtractDocumentForAiResult = { extraction };

  if (params.structureList !== false && extraction.text.trim().length > 0) {
    const purpose =
      params.purpose ?? purposeForOrgType(params.orgType ?? null);
    result.roster = await parseRosterFromExtractedText(
      extraction.text,
      purpose,
      params.organizationId
    );
  }

  return result;
}
