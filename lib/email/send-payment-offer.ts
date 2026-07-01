import { getAppBaseUrlFromEnv, buildPaymentOfferUrl } from '@/lib/http/app-base-url';
import { formatCurrency } from '@/lib/utils';
import { konaEmailLayout } from '@/lib/email/layout';
import { sendResendEmail, type ResendSendResult } from '@/lib/email/resend-client';

export interface PaymentOfferEmailParams {
  to: string;
  directorName?: string | null;
  orgName: string;
  amountGnf: number;
  paymentToken: string;
  ceoNotes?: string | null;
  accessMode?: string | null;
}

export async function sendPaymentOfferEmail(
  params: PaymentOfferEmailParams
): Promise<ResendSendResult> {
  const paymentUrl = buildPaymentOfferUrl(params.paymentToken, getAppBaseUrlFromEnv());
  const greeting = params.directorName?.trim() ? `Bonjour ${params.directorName},` : 'Bonjour,';
  const isTrial = params.accessMode === 'trial_30d';
  const amountLine =
    params.amountGnf > 0
      ? `<p>Montant validé par KonaData : <strong>${formatCurrency(params.amountGnf)}</strong></p>`
      : `<p>Votre offre KonaData a été validée${isTrial ? ' (essai 30 jours)' : ''}.</p>`;

  const notesBlock = params.ceoNotes?.trim()
    ? `<p style="color:#64748b;font-size:14px;"><strong>Note KonaData :</strong> ${params.ceoNotes.trim()}</p>`
    : '';

  const body = `
    <p>${greeting}</p>
    <p>
      L'abonnement plateforme de <strong>${params.orgName}</strong> est prêt.
      ${isTrial ? 'Vous pouvez activer votre essai ou procéder au paiement annuel selon les instructions ci-dessous.' : 'Utilisez le lien sécurisé ci-dessous pour régler l\'activation.'}
    </p>
    ${amountLine}
    <div style="text-align:center;margin:28px 0;">
      <a href="${paymentUrl}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">
        Ouvrir la page de paiement
      </a>
    </div>
    <p style="font-size:13px;color:#64748b;word-break:break-all;">${paymentUrl}</p>
    ${notesBlock}
    <p style="font-size:14px;color:#64748b;">
      Après paiement (Orange Money ou validation manuelle), l'accès complet à votre module sera activé.
    </p>
  `;

  return sendResendEmail({
    to: params.to,
    subject: `KonaData — Activation ${params.orgName}`,
    html: konaEmailLayout('Votre offre KonaData', body),
  });
}
