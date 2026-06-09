import 'server-only';

import type { KonaChatSector } from '@/lib/ai/chat/org-sector';
import {
  answerSchoolOfflineFaq,
  fetchSchoolQuickMetrics,
} from '@/lib/ai/chat/offline-faq-school';
import { ASSISTANT_DATA_LABEL } from '@/lib/ai/chat/assistant-access';

export async function tryOfflineChatAnswer(params: {
  orgId: string;
  orgName: string;
  sector: KonaChatSector;
  userMessage: string;
  reportPath: string;
}): Promise<string | null> {
  if (params.sector === 'etablissement') {
    try {
      const metrics = await fetchSchoolQuickMetrics(params.orgId);
      const answer = answerSchoolOfflineFaq(
        params.userMessage,
        metrics,
        params.orgName,
        params.reportPath
      );
      if (answer) return answer;
    } catch (e) {
      console.error('[tryOfflineChatAnswer] school', e);
    }
  }

  return buildGenericOfflineAnswer(params);
}

function buildGenericOfflineAnswer(params: {
  orgName: string;
  userMessage: string;
  reportPath: string;
}): string {
  return [
    `**${ASSISTANT_DATA_LABEL}** — ${params.orgName}`,
    '',
    'Je n’ai pas reconnu une question fréquente pour y répondre chiffrée.',
    '',
    'Essayez par exemple :',
    '• « Combien avons-nous encaissé ce mois-ci ? »',
    '• « Combien de candidatures sont en attente ? »',
    '• « Résume la situation financière »',
    '',
    `Rapports détaillés : ${params.reportPath}`,
    '',
    `_Votre question : « ${params.userMessage.slice(0, 200)} »_`,
  ].join('\n');
}
