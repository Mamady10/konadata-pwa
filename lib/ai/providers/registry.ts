import {
  getFallbackLlmProviderIds,
  getPrimaryLlmProviderId,
  LLM_PROVIDER_LABELS,
} from '@/lib/ai/providers/config';
import { openAiLlmProvider } from '@/lib/ai/providers/openai-provider';
import {
  anthropicLlmProvider,
  azureOpenAiLlmProvider,
  googleLlmProvider,
  offlineLlmProvider,
} from '@/lib/ai/providers/stubs';
import type { LlmCompletionParams, LlmCompletionResult, LlmProvider, LlmProviderId } from '@/lib/ai/providers/types';

const REGISTRY: Record<LlmProviderId, LlmProvider> = {
  offline: offlineLlmProvider,
  openai: openAiLlmProvider,
  'azure-openai': azureOpenAiLlmProvider,
  anthropic: anthropicLlmProvider,
  google: googleLlmProvider,
};

export function getLlmProvider(id: LlmProviderId): LlmProvider {
  return REGISTRY[id] ?? offlineLlmProvider;
}

export function getActiveLlmProviderId(): LlmProviderId {
  const primary = getPrimaryLlmProviderId();
  if (primary === 'offline') return 'offline';
  const provider = getLlmProvider(primary);
  if (provider.isConfigured()) return primary;
  return 'offline';
}

export function hasActiveLlmProvider(): boolean {
  return getActiveLlmProviderId() !== 'offline';
}

export function getActiveLlmProviderLabel(): string {
  return LLM_PROVIDER_LABELS[getActiveLlmProviderId()];
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status && status >= 500) return true;
  if (err instanceof TypeError) return true;
  return false;
}

/** Appel LLM avec quotas + bascule optionnelle vers fournisseurs de secours. */
export async function callLlmCompletion(
  params: LlmCompletionParams
): Promise<LlmCompletionResult> {
  const primaryId = getActiveLlmProviderId();
  if (primaryId === 'offline') {
    return { content: '', provider: 'offline' };
  }

  const chain = [primaryId, ...getFallbackLlmProviderIds().filter((id) => id !== primaryId)];
  let lastError: unknown;

  for (const id of chain) {
    const provider = getLlmProvider(id);
    if (!provider.isConfigured()) continue;

    try {
      const result = await provider.complete(params);
      if (result.quotaError) return result;
      if (id !== primaryId) {
        console.warn(`[KonaAI] Bascule LLM : ${primaryId} → ${id}`);
      }
      return result;
    } catch (e) {
      lastError = e;
      if (!isRetryable(e)) throw e;
      console.warn(`[KonaAI] Échec ${id}, essai suivant…`, e);
    }
  }

  console.error('[KonaAI] Tous les fournisseurs LLM ont échoué', lastError);
  return {
    content: 'Impossible de contacter le service IA. Réessayez plus tard.',
    provider: primaryId,
  };
}
