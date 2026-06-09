import { konaEmailLayout } from '@/lib/email/layout';
import { getResendConfig, sendResendEmail, type ResendSendResult } from '@/lib/email/resend-client';

export interface ContactFormPayload {
  name: string;
  email: string;
  message: string;
  organization?: string;
}

export async function sendContactFormEmails(
  payload: ContactFormPayload
): Promise<{ inbox: ResendSendResult; confirmation: ResendSendResult }> {
  const { contactInbox } = getResendConfig();
  const inboxTo = contactInbox || payload.email;

  const orgLine = payload.organization
    ? `<p><strong>Organisation :</strong> ${payload.organization}</p>`
    : '';

  const inboxBody = `
    <p>Nouveau message depuis le site KonaData.</p>
    <p><strong>Nom :</strong> ${payload.name}</p>
    <p><strong>Email :</strong> <a href="mailto:${payload.email}">${payload.email}</a></p>
    ${orgLine}
    <div style="background:#F8FAFC;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap;">${escapeHtml(payload.message)}</div>
  `;

  const inbox = await sendResendEmail({
    to: inboxTo,
    subject: `[KonaData Contact] ${payload.name}${payload.organization ? ` — ${payload.organization}` : ''}`,
    html: konaEmailLayout('Nouveau message contact', inboxBody),
    replyTo: payload.email,
  });

  const confirmBody = `
    <p>Bonjour ${payload.name},</p>
    <p>Nous avons bien reçu votre message. L'équipe KonaData vous recontactera rapidement.</p>
    <p style="color:#64748b;font-size:14px;">Récapitulatif :</p>
    <div style="background:#F8FAFC;border-radius:8px;padding:16px;white-space:pre-wrap;">${escapeHtml(payload.message)}</div>
  `;

  const confirmation = await sendResendEmail({
    to: payload.email,
    subject: 'KonaData — Message bien reçu',
    html: konaEmailLayout('Merci pour votre message', confirmBody),
  });

  return { inbox, confirmation };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
