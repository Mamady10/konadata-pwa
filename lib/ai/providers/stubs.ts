import type { LlmProvider, LlmCompletionParams, LlmCompletionResult } from '@/lib/ai/providers/types';

function notConfigured(id: string, envHint: string): LlmProvider {
  return {
    id: id as LlmProvider['id'],
    label: id,
    isConfigured: () => false,
    supportsVision: () => false,
    defaultModel: () => '',
    visionModel: () => '',
    complete: async (): Promise<LlmCompletionResult> => {
      throw new Error(`${id} non configuré — ${envHint}`);
    },
  };
}

/** Préparé pour branchement futur (Claude, etc.). */
export const anthropicLlmProvider: LlmProvider = {
  ...notConfigured('anthropic', 'ANTHROPIC_API_KEY + implémentation provider'),
  id: 'anthropic',
  label: 'Anthropic (Claude)',
  isConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
};

export const azureOpenAiLlmProvider: LlmProvider = {
  ...notConfigured('azure-openai', 'AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY'),
  id: 'azure-openai',
  label: 'Azure OpenAI',
  isConfigured: () =>
    Boolean(
      process.env.AZURE_OPENAI_API_KEY?.trim() && process.env.AZURE_OPENAI_ENDPOINT?.trim()
    ),
  supportsVision: () => true,
};

export const googleLlmProvider: LlmProvider = {
  ...notConfigured('google', 'GOOGLE_AI_API_KEY + implémentation provider'),
  id: 'google',
  label: 'Google Gemini',
  isConfigured: () => Boolean(process.env.GOOGLE_AI_API_KEY?.trim()),
  supportsVision: () => true,
};

export const offlineLlmProvider: LlmProvider = {
  id: 'offline',
  label: 'Mode local',
  isConfigured: () => true,
  supportsVision: () => false,
  defaultModel: () => 'offline',
  visionModel: () => 'offline',
  complete: async (): Promise<LlmCompletionResult> => ({
    content: '',
    provider: 'offline',
  }),
};
