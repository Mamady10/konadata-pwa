import { konaEmailLayout } from '@/lib/email/layout';
import { getResendConfig, sendResendEmail, type ResendSendResult } from '@/lib/email/resend-client';

export type RenewalReminderKind = 'j30' | 'j7';

interface Params {
  to: string;
  directorName: string;
  orgName: string;
  validUntil: string;
  kind: RenewalReminderKind;
  accessMode: string;
}

export async function sendBillingRenewalReminderEmail(params: Params): Promise<ResendSendResult> {
  const { appUrl } = getResendConfig();
  const untilLabel = new Date(params.validUntil).toLocaleDateString('fr-FR', {
    dateStyle: 'long',
  });
  const daysLabel = params.kind === 'j7' ? '7 jours' : '30 jours';
  const isTrial = params.accessMode === 'trial_30d';
  const subject = isTrial
    ? `KonaData — Fin de votre essai dans ${daysLabel} (${params.orgName})`
    : `KonaData — Renouvellement abonnement dans ${daysLabel} (${params.orgName})`;

  const body = `
    <p>Bonjour ${params.directorName},</p>
    <p>
      L'accès plateforme de <strong>${params.orgName}</strong>
      ${isTrial ? ' (période d\'essai)' : ''} se termine le <strong>${untilLabel}</strong>
      — soit dans environ <strong>${daysLabel}</strong>.
    </p>
    <p>
      Pour éviter la suspension du module (hors Paramètres), connectez-vous à
      <a href="${appUrl}/parametres/facturation">Facturation</a>
      ou utilisez le lien de paiement envoyé par KonaData après validation du montant annuel.
    </p>
    ${
      isTrial
        ? `<p style="color:#64748b;font-size:14px;">Après l'essai, l'abonnement annuel KonaData (forfait + élèves inscrits) s'appliquera.</p>`
        : ''
    }
  `;

  return sendResendEmail({
    to: params.to,
    subject,
    html: konaEmailLayout('Rappel KonaData', body),
  });
}

export function reminderKindLabel(kind: RenewalReminderKind): string {
  return kind === 'j7' ? 'J-7' : 'J-30';
}
