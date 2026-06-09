import type { AiOperation } from '@/lib/ai/quota/credit-costs';

export type AiCallContext = {
  organizationId: string;
  operation: AiOperation;
  profileId?: string;
  visionPages?: number;
};

/** Fournisseurs LLM supportés ou prévus par KonaData. */
export type LlmProviderId = 'offline' | 'openai' | 'azure-openai' | 'anthropic' | 'google';

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | unknown[];
};

export type LlmCompletionParams = {
  messages: LlmMessage[];
  maxTokens: number;
  temperature: number;
  model?: string;
  aiCtx?: AiCallContext;
};

export type LlmCompletionResult = {
  content: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  quotaError?: string;
  provider: LlmProviderId;
};

export type LlmProvider = {
  id: LlmProviderId;
  label: string;
  isConfigured: () => boolean;
  supportsVision: () => boolean;
  complete: (params: LlmCompletionParams) => Promise<LlmCompletionResult>;
  defaultModel: () => string;
  visionModel: () => string;
};
