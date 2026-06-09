import { ORG_TYPE_LABELS, type OrganizationType } from '@/types/database';
import { konaEmailLayout } from '@/lib/email/layout';
import { getResendConfig, sendResendEmail, type ResendSendResult } from '@/lib/email/resend-client';

export interface OrgRegistrationNotifyParams {
  orgName: string;
  orgType: OrganizationType;
  directorName?: string | null;
  directorEmail: string;
  declaredCity?: string | null;
  declaredStudents?: number | null;
  summary?: string | null;
}

export async function sendOrgRegistrationNotifyEmail(
  params: OrgRegistrationNotifyParams
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

  const typeLabel = ORG_TYPE_LABELS[params.orgType] ?? params.orgType;
  const body = `
    <p>Nouvelle inscription organisation sur KonaData.</p>
    <table style="width:100%;font-size:14px;line-height:1.6;">
      <tr><td style="color:#64748b;">Organisation</td><td><strong>${params.orgName}</strong></td></tr>
      <tr><td style="color:#64748b;">Type</td><td>${typeLabel}</td></tr>
      <tr><td style="color:#64748b;">Responsable</td><td>${params.directorName ?? '—'} (${params.directorEmail})</td></tr>
      ${params.declaredCity ? `<tr><td style="color:#64748b;">Ville</td><td>${params.declaredCity}</td></tr>` : ''}
      ${params.declaredStudents != null ? `<tr><td style="color:#64748b;">Effectif déclaré</td><td>${params.declaredStudents}</td></tr>` : ''}
    </table>
    ${
      params.summary
        ? `<p style="margin-top:16px;"><strong>Résumé :</strong></p><div style="background:#F8FAFC;border-radius:8px;padding:12px;white-space:pre-wrap;">${params.summary}</div>`
        : ''
    }
    <p style="margin-top:20px;">
      <a href="${appUrl}/organisations">Ouvrir le tableau CEO → Organisations</a>
    </p>
  `;

  return sendResendEmail({
    to,
    subject: `[KonaData] Nouvelle org — ${params.orgName}`,
    html: konaEmailLayout('Nouvelle inscription', body),
    replyTo: params.directorEmail,
  });
}
