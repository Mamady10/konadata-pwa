import type { CaptureExtractionResult } from '@/lib/ai/extraction/capture-extract-types';

export function parseCaptureExtraction(
  extractedData: Record<string, unknown> | null | undefined
): CaptureExtractionResult | null {
  if (!extractedData || typeof extractedData !== 'object') return null;
  const raw = extractedData.capture_extraction;
  if (!raw || typeof raw !== 'object') return null;

  const block = raw as Record<string, unknown>;
  const template_id = typeof block.template_id === 'string' ? block.template_id : '';
  const kind = typeof block.kind === 'string' ? block.kind : '';
  const status = block.status === 'ok' || block.status === 'partial' || block.status === 'failed'
    ? block.status
    : 'failed';
  const parse_method =
    block.parse_method === 'llm' || block.parse_method === 'csv' || block.parse_method === 'heuristic'
      ? block.parse_method
      : 'heuristic';
  const payload = block.payload;
  if (!template_id || !kind || !payload || typeof payload !== 'object') return null;

  return {
    template_id,
    kind: kind as CaptureExtractionResult['kind'],
    status,
    parse_method,
    confidence: typeof block.confidence === 'number' ? block.confidence : 0,
    warnings: Array.isArray(block.warnings)
      ? block.warnings.filter((w): w is string => typeof w === 'string')
      : [],
    extracted_at: typeof block.extracted_at === 'string' ? block.extracted_at : '',
    row_count: typeof block.row_count === 'number' ? block.row_count : 0,
    payload: payload as CaptureExtractionResult['payload'],
  };
}

export function isKonadataCaptureDocumentType(typeId: string | null | undefined): boolean {
  return Boolean(typeId?.startsWith('konadata_'));
}
