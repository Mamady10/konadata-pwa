import { ROLE_LABELS } from '@/types/database';
import type { AppRole, OrganizationType } from '@/types/database';
import { ORG_TYPE_LABELS } from '@/types/database';
import { konaEmailLayout } from '@/lib/email/layout';
import { getResendConfig, sendResendEmail, type ResendSendResult } from '@/lib/email/resend-client';

interface SendAccessCodeParams {
  to: string;
  code: string;
  role: AppRole;
  orgName: string;
  orgType: OrganizationType;
  expiresAt?: string | null;
  inviterName?: string;
}

export async function sendAccessCodeEmail(params: SendAccessCodeParams): Promise<ResendSendResult> {
  const { appUrl } = getResendConfig();
  const roleLabel = ROLE_LABELS[params.role] ?? params.role;
  const orgTypeLabel = ORG_TYPE_LABELS[params.orgType] ?? params.orgType;
  const expiryLine = params.expiresAt
    ? `<p style="color:#64748b;font-size:14px;">Valide jusqu'au ${new Date(params.expiresAt).toLocaleDateString('fr-FR')}</p>`
    : '';

  const body = `
    <p>Bonjour,</p>
    <p>
      ${params.inviterName ? `<strong>${params.inviterName}</strong> vous invite à rejoindre` : 'Vous êtes invité(e) à rejoindre'}
      <strong>${params.orgName}</strong> (${orgTypeLabel}) en tant que <strong>${roleLabel}</strong>.
    </p>
    <div style="background:#F1F5F9;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Votre code d'accès</p>
      <p style="margin:0;font-size:28px;font-weight:bold;letter-spacing:4px;font-family:monospace;">${params.code}</p>
    </div>
    <p><strong>Étapes :</strong></p>
    <ol style="line-height:1.8;">
      <li>Créez un compte sur <a href="${appUrl}/register">${appUrl}/register</a> (onglet « J'ai un code »)</li>
      <li>Ou connectez-vous puis ouvrez <a href="${appUrl}/rejoindre">${appUrl}/rejoindre</a></li>
      <li>Saisissez le code ci-dessus pour accéder aux données de votre organisation</li>
    </ol>
    ${expiryLine}
  `;

  return sendResendEmail({
    to: params.to,
    subject: `Code d'accès KonaData — ${params.orgName}`,
    html: konaEmailLayout('Invitation KonaData', body),
  });
}
