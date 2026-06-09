export interface DocumentAiAdaptation {
  templateFileName: string;
  guidance: string;
  appliedAt: string | null;
}

export function parseDocumentAiAdaptation(
  extractedData: Record<string, unknown> | null | undefined
): DocumentAiAdaptation | null {
  if (!extractedData || typeof extractedData !== 'object') return null;

  const raw = extractedData.ai_template_adaptation;
  if (!raw || typeof raw !== 'object') return null;

  const block = raw as Record<string, unknown>;
  const guidance = typeof block.guidance === 'string' ? block.guidance.trim() : '';
  if (!guidance) return null;

  const templateFileName =
    typeof block.template_file_name === 'string' ? block.template_file_name : 'Modèle';

  const appliedAt =
    typeof block.applied_at === 'string' ? block.applied_at : null;

  return { templateFileName, guidance, appliedAt };
}
