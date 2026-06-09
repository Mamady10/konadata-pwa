import { konaEmailLayout } from '@/lib/email/layout';
import { getResendConfig, sendResendEmail, type ResendSendResult } from '@/lib/email/resend-client';
import { COLLECTION_MODE_LABELS } from '@/lib/ngo/survey-settings';
import type { NgoSurveyCollectionMode } from '@/lib/ngo/survey-settings';

export interface SurveyCeoRequestEmailParams {
  orgName: string;
  directorName?: string | null;
  directorEmail?: string | null;
  surveyTitle: string;
  surveyDescription?: string | null;
  surveyRegion?: string | null;
  targetResponses: number;
  collectionMode?: string | null;
  questionText?: string | null;
  options?: string[];
  chargeId: string;
  surveyId: string;
}

export async function sendSurveyCeoRequestEmail(
  params: SurveyCeoRequestEmailParams
): Promise<ResendSendResult> {
  const { appUrl, contactInbox } = getResendConfig();
  const to = contactInbox;
  if (!to) {
    return {
      ok: false,
      skipped: true,
      error: 'KONA_CONTACT_INBOX non configuré — notification CEO ignorée.',
    };
  }

  const modeLabel =
    COLLECTION_MODE_LABELS[params.collectionMode as NgoSurveyCollectionMode] ??
    params.collectionMode ??
    '—';

  const optionsHtml =
    params.options?.length ?
      `<ul style="margin:4px 0 0;padding-left:18px;font-size:14px;">
        ${params.options.map((o) => `<li>${o}</li>`).join('')}
      </ul>`
    : '';

  const body = `
    <p>Nouvelle demande de campagne sondage ONG — <strong>tarif à fixer par le CEO</strong>.</p>
    <table style="width:100%;font-size:14px;line-height:1.7;margin:16px 0;">
      <tr><td style="color:#64748b;width:40%;">Organisation</td><td><strong>${params.orgName}</strong></td></tr>
      <tr><td style="color:#64748b;">Directeur</td><td>${params.directorName ?? '—'} (${params.directorEmail ?? '—'})</td></tr>
      <tr><td style="color:#64748b;">Sondage</td><td><strong>${params.surveyTitle}</strong></td></tr>
      ${params.surveyDescription ? `<tr><td style="color:#64748b;">Description</td><td>${params.surveyDescription}</td></tr>` : ''}
      <tr><td style="color:#64748b;">Région</td><td>${params.surveyRegion ?? '—'}</td></tr>
      <tr><td style="color:#64748b;">Personnes cibles</td><td><strong>${params.targetResponses}</strong></td></tr>
      <tr><td style="color:#64748b;">Mode collecte</td><td>${modeLabel}</td></tr>
      ${
        params.questionText
          ? `<tr><td style="color:#64748b;vertical-align:top;">Question QCM</td><td>${params.questionText}${optionsHtml}</td></tr>`
          : ''
      }
    </table>
    <p style="font-size:14px;color:#64748b;">
      Ouvrez le tableau CEO, fixez le montant selon l'organisation, les cibles et le contexte, puis envoyez le lien de paiement au directeur.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${appUrl}/organisations" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">
        Tableau CEO — Organisations
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;">Réf. charge ${params.chargeId} · sondage ${params.surveyId}</p>
  `;

  return sendResendEmail({
    to,
    subject: `[KonaData] Sondage ONG à tarifer — ${params.orgName}`,
    html: konaEmailLayout('Demande de tarif campagne sondage', body),
    replyTo: params.directorEmail ?? undefined,
  });
}
