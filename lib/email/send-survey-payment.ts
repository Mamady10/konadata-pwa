import { formatCurrency } from '@/lib/utils';
import { konaEmailLayout } from '@/lib/email/layout';
import { getResendConfig, sendResendEmail, type ResendSendResult } from '@/lib/email/resend-client';

export interface SurveyCampaignPaymentEmailParams {
  to: string;
  directorName?: string | null;
  orgName: string;
  surveyTitle: string;
  amountGnf: number;
  targetResponses: number;
  paymentToken: string;
  baseFeeGnf?: number;
  perTargetGnf?: number;
  isRevision?: boolean;
  previousAmountGnf?: number;
  ceoNotes?: string | null;
}

export async function sendSurveyCampaignPaymentEmail(
  params: SurveyCampaignPaymentEmailParams
): Promise<ResendSendResult> {
  const { appUrl } = getResendConfig();
  const paymentUrl = `${appUrl.replace(/\/$/, '')}/paiement-sondage/${params.paymentToken}`;
  const greeting = params.directorName?.trim() ? `Bonjour ${params.directorName},` : 'Bonjour,';

  const breakdownLine =
    params.baseFeeGnf != null && params.perTargetGnf != null
      ? `<p style="font-size:14px;color:#64748b;">
          Détail : ${formatCurrency(params.baseFeeGnf)} (frais de campagne)
          + ${params.targetResponses} personnes cibles × ${formatCurrency(params.perTargetGnf)}
        </p>`
      : `<p style="font-size:14px;color:#64748b;">
          Campagne pour <strong>${params.targetResponses}</strong> personnes cibles.
        </p>`;

  const revisionBlock = params.isRevision
    ? `<p style="background:#FEF3C7;border-radius:8px;padding:12px;font-size:14px;color:#92400E;">
        <strong>Tarif mis à jour</strong> suite à négociation avec KonaData.
        ${
          params.previousAmountGnf != null
            ? ` Ancien montant : ${formatCurrency(params.previousAmountGnf)} → nouveau : <strong>${formatCurrency(params.amountGnf)}</strong>.`
            : ` Nouveau montant : <strong>${formatCurrency(params.amountGnf)}</strong>.`
        }
      </p>`
    : '';

  const notesBlock = params.ceoNotes?.trim()
    ? `<p style="font-size:14px;color:#64748b;"><strong>Note KonaData :</strong> ${params.ceoNotes.trim()}</p>`
    : '';

  const body = `
    <p>${greeting}</p>
    ${revisionBlock}
    <p>
      Votre sondage <strong>« ${params.surveyTitle} »</strong> (${params.orgName}) est prêt.
      La facturation de cette <strong>campagne</strong> est distincte de votre abonnement plateforme KonaData.
    </p>
    <p>Montant de la campagne : <strong>${formatCurrency(params.amountGnf)}</strong></p>
    ${notesBlock}
    ${breakdownLine}
    <div style="text-align:center;margin:28px 0;">
      <a href="${paymentUrl}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">
        Payer la campagne sondage
      </a>
    </div>
    <p style="font-size:13px;color:#64748b;word-break:break-all;">${paymentUrl}</p>
    <p style="font-size:14px;color:#64748b;">
      Après paiement (Orange Money ou référence de virement), vous pourrez activer le sondage et partager le lien de participation.
    </p>
  `;

  const title = params.isRevision ? 'Tarif campagne mis à jour' : 'Paiement campagne sondage';
  const subject = params.isRevision
    ? `KonaData — Tarif mis à jour : ${params.surveyTitle}`
    : `KonaData — Paiement campagne sondage : ${params.surveyTitle}`;

  return sendResendEmail({
    to: params.to,
    subject,
    html: konaEmailLayout(title, body),
  });
}
