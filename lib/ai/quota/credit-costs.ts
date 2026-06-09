/** Coût en crédits KonaAI par type d'appel OpenAI. */
export const AI_CREDIT_COSTS = {
  chat: 1,
  report: 15,
  vision_page: 5,
  parse_bulletin: 3,
  parse_roster: 5,
  document_index: 2,
  template_adapt: 8,
} as const;

export type AiOperation = keyof typeof AI_CREDIT_COSTS;

export function creditsForOperation(
  operation: AiOperation,
  options?: { visionPages?: number }
): number {
  if (operation === 'vision_page') {
    return AI_CREDIT_COSTS.vision_page * Math.max(1, options?.visionPages ?? 1);
  }
  return AI_CREDIT_COSTS[operation];
}
