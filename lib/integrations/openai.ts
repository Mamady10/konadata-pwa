import {
  callLlmCompletion,
  getActiveLlmProviderId,
  getActiveLlmProviderLabel,
  getLlmProvider,
  hasActiveLlmProvider,
} from '@/lib/ai/providers/registry';
import { ASSISTANT_DATA_LABEL } from '@/lib/ai/chat/assistant-access';
import type { KonaChatSector } from '@/lib/ai/chat/org-sector';
import { tryOfflineChatAnswer } from '@/lib/ai/chat/offline-faq';
import type { AiCallContext } from '@/lib/ai/providers/types';
import type { LlmProviderId } from '@/lib/ai/providers/types';

export type { AiCallContext };

/** @deprecated Utilisez getActiveLlmProviderId — conservé pour compatibilité UI */
export type KonaAiProvider = 'offline' | 'openai';

export const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY?.trim() || '',
  model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
};

export function getKonaAiProvider(): KonaAiProvider {
  const id = getActiveLlmProviderId();
  return id === 'offline' ? 'offline' : 'openai';
}

export function hasActiveLlmApi(): boolean {
  return hasActiveLlmProvider();
}

/** Libellé du fournisseur actif (OpenAI, Azure, etc.). */
export function getKonaAiProviderLabel(): string {
  return getActiveLlmProviderLabel();
}

export type KonaChatTurn = { role: 'user' | 'assistant'; content: string };

function buildChatSystemPrompt(params: {
  orgName: string;
  sectorLabel: string;
  orgContext: string;
  reportPath: string;
}): string {
  return [
    'Tu es KonaAI, assistant pour directeurs et comptables sur la plateforme KonaData (Guinée).',
    `Organisation : ${params.orgName} (${params.sectorLabel}).`,
    'Règles strictes :',
    '- Réponds en français, clair et structuré (listes courtes si utile).',
    '- Utilise UNIQUEMENT les blocs « DONNÉES ORGANISATION » et « Documents indexés » ci-dessous pour les chiffres et faits.',
    '- Pour les documents : cite le nom du fichier source. Ne invente pas de contenu absent des extraits.',
    '- Si une information manque dans ces blocs, dis-le explicitement ; ne invente pas de montants ni de noms.',
    '- Pour un rapport formel long, oriente vers la page Rapports du module.',
    `- Rapports détaillés : chemin ${params.reportPath}`,
    '',
    '=== DONNÉES ORGANISATION (source Supabase, lecture seule) ===',
    params.orgContext,
  ].join('\n');
}

export async function queryKonaAIChat(params: {
  userMessage: string;
  history: KonaChatTurn[];
  orgName: string;
  sectorLabel: string;
  sector: KonaChatSector;
  orgId: string;
  orgContext: string;
  reportPath: string;
  allowLlm?: boolean;
  aiCtx?: AiCallContext;
}): Promise<{ text: string; usedLlm: boolean }> {
  const system = buildChatSystemPrompt({
    orgName: params.orgName,
    sectorLabel: params.sectorLabel,
    orgContext: params.orgContext,
    reportPath: params.reportPath,
  });

  const canUseLlm = hasActiveLlmProvider() && params.allowLlm !== false;

  if (!canUseLlm) {
    const faq = await tryOfflineChatAnswer({
      orgId: params.orgId,
      orgName: params.orgName,
      sector: params.sector,
      userMessage: params.userMessage,
      reportPath: params.reportPath,
    });
    return { text: faq, usedLlm: false };
  }

  const recent = params.history.slice(-8);
  const { content, quotaError } = await callLlmCompletion({
    messages: [
      { role: 'system', content: system },
      ...recent.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: params.userMessage },
    ],
    maxTokens: 1200,
    temperature: 0.25,
    aiCtx: params.aiCtx ?? undefined,
  });

  if (quotaError) {
    return { text: quotaError, usedLlm: false };
  }

  return {
    text: content || 'Réponse vide de l\'API.',
    usedLlm: true,
  };
}

/** OCR / manuscrit : transcription image via API vision du fournisseur actif. */
export async function extractTextWithVision(
  buffer: Buffer,
  mimeType: string,
  aiCtx?: AiCallContext
): Promise<string> {
  if (!hasActiveLlmProvider()) {
    return '';
  }

  const provider = getLlmProvider(getActiveLlmProviderId());
  if (!provider.supportsVision()) {
    console.warn('[KonaAI Vision] Fournisseur actif sans support vision');
    return '';
  }

  const safeMime = mimeType?.includes('/') ? mimeType : 'image/jpeg';
  const base64 = buffer.toString('base64');

  const visionCtx: AiCallContext | undefined = aiCtx
    ? { ...aiCtx, operation: 'vision_page', visionPages: aiCtx.visionPages ?? 1 }
    : undefined;

  const { content, quotaError } = await callLlmCompletion({
    model: provider.visionModel(),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Transcris intégralement le texte visible sur ce document (y compris manuscrit). ' +
              'Réponds uniquement avec le texte transcrit, en français si possible, sans commentaire.',
          },
          {
            type: 'image_url',
            image_url: { url: `data:${safeMime};base64,${base64}` },
          },
        ],
      },
    ],
    maxTokens: 4000,
    temperature: 0.1,
    aiCtx: visionCtx,
  });

  if (quotaError) {
    console.warn('[KonaAI Vision]', quotaError);
    return '';
  }

  return content;
}

export async function queryKonaAI(
  prompt: string,
  context?: string,
  aiCtx?: AiCallContext
): Promise<string> {
  if (!hasActiveLlmProvider()) {
    return [
      '[Mode local — pas d\'appel API IA]',
      context ? `\n${context}` : '',
      prompt ? `\n\n${prompt}` : '',
    ].join('');
  }

  const { content, quotaError } = await callLlmCompletion({
    messages: [
      {
        role: 'system',
        content:
          'Tu es KonaAI, assistant documentaire pour organisations en Guinée. Tu aides à aligner les documents produits sur des modèles de référence définis par la direction. Réponds en français, de façon structurée et actionnable.',
      },
      {
        role: 'user',
        content: context ? `${context}\n\n---\n\n${prompt}` : prompt,
      },
    ],
    maxTokens: 1800,
    temperature: 0.3,
    aiCtx,
  });

  if (quotaError) return quotaError;
  return content || 'Réponse vide de l\'API.';
}

/** Identifiant technique du backend LLM (pour logs / admin). */
export function getLlmBackendId(): LlmProviderId {
  return getActiveLlmProviderId();
}
