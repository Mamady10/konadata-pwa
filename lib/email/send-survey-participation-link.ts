import { buildParticipationUrl, getAppBaseUrlFromEnv } from '@/lib/http/app-base-url';
import { konaEmailLayout } from '@/lib/email/layout';
import { sendResendEmail, type ResendSendResult } from '@/lib/email/resend-client';

export interface SurveyParticipationEmailParams {
  to: string | string[];
  orgName: string;
  surveyTitle: string;
  surveyDescription?: string | null;
  questionText?: string | null;
  options?: string[];
  publicToken: string;
  directorName?: string | null;
  customMessage?: string | null;
}

/** Message court (WhatsApp/SMS) invitant à participer au sondage. */
export function buildSurveyParticipationText(params: {
  orgName: string;
  surveyTitle: string;
  publicToken: string;
  customMessage?: string | null;
}): string {
  const participationUrl = buildParticipationUrl(params.publicToken, getAppBaseUrlFromEnv());
  const custom = params.customMessage?.trim() ? `${params.customMessage.trim()}\n` : '';
  return (
    `${params.orgName} vous invite à participer au sondage « ${params.surveyTitle} » sur KonaData.\n` +
    custom +
    `Répondez ici : ${participationUrl}`
  );
}

export async function sendSurveyParticipationLinkEmail(
  params: SurveyParticipationEmailParams
): Promise<ResendSendResult> {
  const participationUrl = buildParticipationUrl(params.publicToken, getAppBaseUrlFromEnv());

  const optionsHtml =
    params.options?.length ?
      `<ul style="margin:8px 0 16px;padding-left:20px;color:#475569;font-size:14px;">
        ${params.options.map((o) => `<li>${o}</li>`).join('')}
      </ul>`
    : '';

  const questionBlock =
    params.questionText ?
      `<p style="font-size:15px;"><strong>Question :</strong> ${params.questionText}</p>${optionsHtml}`
    : '';

  const descBlock = params.surveyDescription?.trim()
    ? `<p style="color:#64748b;font-size:14px;">${params.surveyDescription.trim()}</p>`
    : '';

  const customBlock = params.customMessage?.trim()
    ? `<p style="background:#f1f5f9;border-radius:8px;padding:12px;font-size:14px;color:#334155;">${params.customMessage.trim()}</p>`
    : '';

  const body = `
    <p>Bonjour,</p>
    <p>
      <strong>${params.orgName}</strong> vous invite à participer au sondage
      <strong>« ${params.surveyTitle} »</strong> sur KonaData.
    </p>
    ${customBlock}
    ${descBlock}
    ${questionBlock}
    <p>Cliquez sur le bouton ci-dessous pour répondre au questionnaire (choix unique) :</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${participationUrl}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">
        Participer au sondage
      </a>
    </div>
    <p style="font-size:13px;color:#64748b;word-break:break-all;">${participationUrl}</p>
    <p style="font-size:14px;color:#64748b;">
      Vous pouvez aussi scanner le QR code partagé par l'organisation pour accéder directement au formulaire.
    </p>
  `;

  return sendResendEmail({
    to: params.to,
    subject: `${params.orgName} — Participez : ${params.surveyTitle}`,
    html: konaEmailLayout('Invitation au sondage', body),
  });
}
