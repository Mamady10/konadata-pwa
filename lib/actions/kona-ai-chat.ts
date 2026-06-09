'use server';

import { getSession } from '@/lib/actions/auth';
import { requireOrgId } from '@/lib/actions/org';
import { canManageAssignments } from '@/lib/actions/assignments';
import { gatherOrgChatContext } from '@/lib/ai/chat/gather-org-context';
import {
  chatReportPath,
  chatSectorFromOrgType,
  chatSectorLabel,
  chatSuggestionsForSector,
  type KonaChatSector,
} from '@/lib/ai/chat/org-sector';
import {
  getKonaAiProvider,
  getKonaAiProviderLabel,
  getLlmBackendId,
  hasActiveLlmApi,
  queryKonaAIChat,
  type KonaChatTurn,
} from '@/lib/integrations/openai';
import {
  assistantDisplayName,
  aiOfferTierLabel,
  isAiOfferActiveForWidget,
  isDirectorRole,
} from '@/lib/ai/chat/assistant-access';
import { getOrganizationAiQuotaStatus } from '@/lib/ai/quota/ai-quota';
import { getOrgType } from '@/types/database';
import type { Organization } from '@/types/database';
import type { AppRole } from '@/types/database';

const MAX_MESSAGE_LEN = 2000;
const MAX_HISTORY = 10;

export type KonaAIChatConfig = {
  orgName: string;
  sector: KonaChatSector;
  sectorLabel: string;
  suggestions: string[];
  reportPath: string;
  /** Afficher le widget (directeur + offre IA ≠ Essentiel). */
  widgetVisible: boolean;
  assistantLabel: string;
  aiOfferTier: string | null;
  aiOfferTierLabel: string;
  llmAvailable: boolean;
  provider: 'offline' | 'openai';
  providerLabel: string;
  llmBackend: string;
  canProduceDocuments: boolean;
  documentsIndexed: number;
  documentsTotal: number;
  konaAiDisabled: boolean;
  dpaUpToDate: boolean;
  privacyBlockReason: string | null;
};

export type AskKonaAIResult =
  | { error: string }
  | {
      content: string;
      usedLlm: boolean;
      reportPath: string;
    };

async function loadOrgForChat(): Promise<
  | { error: string }
  | { orgId: string; orgName: string; orgType: string; sector: KonaChatSector }
> {
  const session = await getSession();
  if (!session) {
    return { error: 'Connectez-vous pour utiliser KonaAI.' };
  }

  if (!session.profile?.organization_id) {
    return {
      error:
        'Aucune organisation liée à ce compte. Rejoignez votre structure via /rejoindre ou utilisez un compte directeur d\'établissement.',
    };
  }

  const org = session.profile.organizations as Organization | null;
  const orgType = getOrgType(org) ?? (org?.type as string) ?? 'school';
  const sector = chatSectorFromOrgType(orgType);

  return {
    orgId: session.profile.organization_id,
    orgName: org?.name?.trim() || 'Mon organisation',
    orgType,
    sector,
  };
}

export async function getKonaAIChatConfig(): Promise<KonaAIChatConfig | { error: string }> {
  const loaded = await loadOrgForChat();
  if ('error' in loaded) return loaded;

  const session = await getSession();
  const role = session?.profile?.role as AppRole | undefined;
  const sector = loaded.sector;
  const canProduce = await canManageAssignments();

  let aiOfferTier: string | null = null;
  try {
    const quota = await getOrganizationAiQuotaStatus(loaded.orgId);
    if (!('error' in quota)) {
      aiOfferTier = quota.tier;
    }
  } catch {
    /* optionnel */
  }

  const aiOfferActive = isAiOfferActiveForWidget(aiOfferTier);
  const widgetVisible = isDirectorRole(role) && aiOfferActive;

  let documentsIndexed = 0;
  let documentsTotal = 0;
  try {
    const { getOrgIndexedDocumentStats } = await import('@/lib/actions/document-search');
    const stats = await getOrgIndexedDocumentStats();
    if (!('error' in stats)) {
      documentsIndexed = stats.indexed;
      documentsTotal = stats.total;
    }
  } catch {
    /* optionnel */
  }

  let konaAiDisabled = false;
  let dpaUpToDate = false;
  let privacyBlockReason: string | null = null;

  try {
    const { getOrganizationPrivacySettings } = await import('@/lib/actions/org-privacy');
    const privacy = await getOrganizationPrivacySettings();
    if (!('error' in privacy)) {
      konaAiDisabled = privacy.konaAiDisabled;
      dpaUpToDate = privacy.dpaUpToDate;
      if (konaAiDisabled) {
        privacyBlockReason =
          'KonaAI désactivé — Paramètres → Confidentialité pour réactiver.';
      } else if (!dpaUpToDate) {
        privacyBlockReason =
          'Acceptez le DPA dans Paramètres → Confidentialité avant d\'utiliser KonaAI.';
      }
    }
  } catch {
    /* migration 055 peut être absente */
  }

  const apiReady = hasActiveLlmApi();
  const llmAvailable = apiReady && !konaAiDisabled && dpaUpToDate;
  const assistantLabel = assistantDisplayName(llmAvailable);

  return {
    orgName: loaded.orgName,
    sector,
    sectorLabel: chatSectorLabel(sector),
    suggestions: chatSuggestionsForSector(sector),
    reportPath: chatReportPath(sector),
    widgetVisible,
    assistantLabel,
    aiOfferTier,
    aiOfferTierLabel: aiOfferTierLabel(aiOfferTier),
    llmAvailable,
    provider: getKonaAiProvider(),
    providerLabel: getKonaAiProviderLabel(),
    llmBackend: getLlmBackendId(),
    canProduceDocuments: canProduce && sector !== 'global' && sector !== 'pme',
    documentsIndexed,
    documentsTotal,
    konaAiDisabled,
    dpaUpToDate,
    privacyBlockReason,
  };
}

export async function askKonaAI(
  message: string,
  history: KonaChatTurn[] = []
): Promise<AskKonaAIResult> {
  const trimmed = message?.trim().slice(0, MAX_MESSAGE_LEN);
  if (!trimmed) return { error: 'Message vide.' };

  const loaded = await loadOrgForChat();
  if ('error' in loaded) return loaded;

  const session = await getSession();
  const role = session?.profile?.role as AppRole | undefined;
  const quota = await getOrganizationAiQuotaStatus(loaded.orgId);
  const aiTier = 'error' in quota ? null : quota.tier;
  if (!isDirectorRole(role) || !isAiOfferActiveForWidget(aiTier)) {
    return { error: 'Assistant réservé aux directeurs avec offre IA activée.' };
  }

  let konaAiDisabled = false;
  let dpaUpToDate = false;
  try {
    const { getOrganizationPrivacySettings } = await import('@/lib/actions/org-privacy');
    const privacy = await getOrganizationPrivacySettings();
    if (!('error' in privacy)) {
      konaAiDisabled = privacy.konaAiDisabled;
      dpaUpToDate = privacy.dpaUpToDate;
    }
  } catch {
    /* */
  }
  const allowLlm = hasActiveLlmApi() && !konaAiDisabled && dpaUpToDate;

  const safeHistory = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_LEN),
    }));

  try {
    const orgId = await requireOrgId();
    if (orgId !== loaded.orgId) {
      return { error: 'Session organisation invalide.' };
    }

    const orgContext = await gatherOrgChatContext(loaded.orgId, loaded.orgType, trimmed);
    const reportPath = chatReportPath(loaded.sector);

    const { text, usedLlm } = await queryKonaAIChat({
      userMessage: trimmed,
      history: safeHistory,
      orgName: loaded.orgName,
      sectorLabel: chatSectorLabel(loaded.sector),
      sector: loaded.sector,
      orgId: loaded.orgId,
      orgContext,
      reportPath,
      allowLlm,
      aiCtx: {
        organizationId: loaded.orgId,
        operation: 'chat',
        profileId: session?.user?.id,
      },
    });

    return {
      content: text,
      usedLlm,
      reportPath,
    };
  } catch (e) {
    console.error('[askKonaAI]', e);
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    return { error: `Impossible d'analyser les données : ${msg}` };
  }
}
