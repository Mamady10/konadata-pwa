import type { LlmProviderId } from '@/lib/ai/providers/types';

const KNOWN: LlmProviderId[] = ['offline', 'openai', 'azure-openai', 'anthropic', 'google'];

function parseProvider(raw: string | undefined): LlmProviderId | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;
  if (KNOWN.includes(v as LlmProviderId)) return v as LlmProviderId;
  return null;
}

/** Fournisseur principal (défaut : openai si clé présente, sinon offline). */
export function getPrimaryLlmProviderId(): LlmProviderId {
  const forced = parseProvider(process.env.KONA_AI_PROVIDER);
  if (forced) return forced;

  if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
  if (process.env.AZURE_OPENAI_API_KEY?.trim() && process.env.AZURE_OPENAI_ENDPOINT?.trim()) {
    return 'azure-openai';
  }
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  if (process.env.GOOGLE_AI_API_KEY?.trim()) return 'google';

  return 'offline';
}

/** Chaîne de secours si le principal échoue (ex. openai → anthropic). */
export function getFallbackLlmProviderIds(): LlmProviderId[] {
  const raw = process.env.KONA_AI_FALLBACK_PROVIDERS?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => parseProvider(s))
    .filter((p): p is LlmProviderId => p != null && p !== 'offline');
}

export const LLM_PROVIDER_LABELS: Record<LlmProviderId, string> = {
  offline: 'Mode local (sans API)',
  openai: 'OpenAI',
  'azure-openai': 'Azure OpenAI',
  anthropic: 'Anthropic (Claude)',
  google: 'Google Gemini',
};
