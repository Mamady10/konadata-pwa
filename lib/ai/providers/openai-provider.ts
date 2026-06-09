import type { LlmProvider, LlmCompletionParams, LlmCompletionResult } from '@/lib/ai/providers/types';
import { assertAiQuotaForCall, chargeAiQuota } from '@/lib/ai/quota/ai-quota';
import { AiQuotaExceededError } from '@/lib/ai/quota/errors';

const apiKey = () => process.env.OPENAI_API_KEY?.trim() || '';
const defaultModel = () => process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
const visionModel = () =>
  process.env.OPENAI_VISION_MODEL?.trim() ||
  (defaultModel().includes('gpt-4') ? defaultModel() : 'gpt-4o-mini');

async function openAiComplete(params: LlmCompletionParams): Promise<LlmCompletionResult> {
  if (params.aiCtx) {
    try {
      await assertAiQuotaForCall(params.aiCtx.organizationId, params.aiCtx.operation, {
        visionPages: params.aiCtx.visionPages,
      });
    } catch (e) {
      if (e instanceof AiQuotaExceededError) {
        return { content: '', quotaError: e.message, provider: 'openai' };
      }
      throw e;
    }
  }

  const model = params.model ?? defaultModel();

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        max_tokens: params.maxTokens,
        temperature: params.temperature,
        store: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[OpenAI]', res.status, errText);
      const err = new Error(`OpenAI HTTP ${res.status}`);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = json.choices?.[0]?.message?.content?.trim() ?? '';

    if (params.aiCtx && content) {
      await chargeAiQuota(params.aiCtx.organizationId, params.aiCtx.operation, {
        profileId: params.aiCtx.profileId,
        tokensIn: json.usage?.prompt_tokens,
        tokensOut: json.usage?.completion_tokens,
        visionPages: params.aiCtx.visionPages,
      });
    }

    return { content, usage: json.usage, provider: 'openai' };
  } catch (e) {
    console.error('[OpenAI]', e);
    throw e;
  }
}

export const openAiLlmProvider: LlmProvider = {
  id: 'openai',
  label: 'OpenAI',
  isConfigured: () => Boolean(apiKey()),
  supportsVision: () => true,
  complete: openAiComplete,
  defaultModel,
  visionModel,
};
