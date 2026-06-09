/** Champs conservés pour les listes documents (sans texte OCR volumineux). */
const DOCUMENT_LIST_EXTRACTED_KEYS = [
  'document_type',
  'document_type_label',
  'classified_by',
  'detected_by',
  'sector',
  'site_id',
  'project_id',
  'class_id',
  'original_name',
  'extraction_status',
  'extraction_method',
  'extraction_message',
  'char_count',
  'ai_template_adaptation',
  'capture_extraction',
  'capture_apply',
] as const;

export function slimExtractedDataForList(
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const key of DOCUMENT_LIST_EXTRACTED_KEYS) {
    if (key in raw && raw[key] !== undefined) {
      out[key] = raw[key];
    }
  }
  return Object.keys(out).length ? out : null;
}

export function isDocumentLikelyIndexed(extracted: Record<string, unknown> | null): boolean {
  if (!extracted) return false;
  const chars = extracted.char_count;
  if (typeof chars === 'number' && chars > 20) return true;
  return extracted.extraction_status === 'ok' || extracted.extraction_status === 'archived';
}
