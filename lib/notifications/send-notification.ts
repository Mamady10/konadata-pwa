import { sendWhatsAppNotification, isWhatsAppConfigured } from '@/lib/integrations/whatsapp';
import { sendTransactionalSms } from '@/lib/auth/send-auth-otp';
import { sendResendEmail } from '@/lib/email/resend-client';
import { konaEmailLayout } from '@/lib/email/layout';
import { normalizeGuineaPhone } from '@/lib/survey/phone';

export type NotificationChannel = 'whatsapp' | 'sms' | 'email';

export interface NotificationRecipient {
  /** Numéro (brut ou E.164) ; normalisé automatiquement. */
  phone?: string | null;
  email?: string | null;
  name?: string | null;
}

export interface NotificationContent {
  /** Texte court utilisé pour WhatsApp et SMS. */
  text: string;
  /** Sujet de l'email (si le canal email est utilisé). */
  emailSubject?: string;
  /** Corps HTML email complet ; sinon on enveloppe `text`. */
  emailHtml?: string;
  /** Titre affiché dans l'entête de l'email par défaut. */
  emailTitle?: string;
}

export interface SendNotificationOptions {
  recipient: NotificationRecipient;
  content: NotificationContent;
  /** Ordre de préférence des canaux. Défaut : WhatsApp → SMS → Email. */
  channels?: NotificationChannel[];
  /** true = diffuser sur tous les canaux disponibles au lieu de s'arrêter au 1er succès. */
  broadcast?: boolean;
}

export interface NotificationAttempt {
  channel: NotificationChannel;
  ok: boolean;
  error?: string;
  skipped?: boolean;
}

export interface SendNotificationResult {
  ok: boolean;
  delivered: NotificationChannel[];
  attempts: NotificationAttempt[];
}

const DEFAULT_ORDER: NotificationChannel[] = ['whatsapp', 'sms', 'email'];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function textToHtml(text: string): string {
  return escapeHtml(text)
    .split('\n')
    .map((line) => `<p style="margin:0 0 10px;">${line || '&nbsp;'}</p>`)
    .join('');
}

/**
 * Envoi unifié d'une notification. Par défaut, tente WhatsApp en priorité (canal
 * le plus fiable en Guinée), puis repli SMS, puis email — et s'arrête au premier
 * canal réussi. Passer `broadcast: true` pour diffuser sur tous les canaux.
 */
export async function sendNotification(
  options: SendNotificationOptions
): Promise<SendNotificationResult> {
  const order = options.channels ?? DEFAULT_ORDER;
  const phoneE164 = options.recipient.phone
    ? normalizeGuineaPhone(options.recipient.phone)
    : null;
  const email = options.recipient.email?.trim() || null;

  const attempts: NotificationAttempt[] = [];
  const delivered: NotificationChannel[] = [];

  for (const channel of order) {
    if (channel === 'whatsapp') {
      if (!phoneE164) continue;
      if (!isWhatsAppConfigured() && process.env.NODE_ENV !== 'development') continue;
      const res = await sendWhatsAppNotification(phoneE164, options.content.text);
      attempts.push({ channel, ok: res.ok, error: res.error, skipped: res.skipped });
      if (res.ok) {
        delivered.push(channel);
        if (!options.broadcast) return { ok: true, delivered, attempts };
      }
      continue;
    }

    if (channel === 'sms') {
      if (!phoneE164) continue;
      const res = await sendTransactionalSms(phoneE164, options.content.text);
      attempts.push({ channel, ok: res.ok, error: res.error, skipped: res.skipped });
      if (res.ok) {
        delivered.push(channel);
        if (!options.broadcast) return { ok: true, delivered, attempts };
      }
      continue;
    }

    if (channel === 'email') {
      if (!email) continue;
      const subject = options.content.emailSubject ?? 'KonaData';
      const html =
        options.content.emailHtml ??
        konaEmailLayout(
          options.content.emailTitle ?? subject,
          textToHtml(options.content.text)
        );
      const res = await sendResendEmail({ to: email, subject, html });
      attempts.push({ channel, ok: res.ok, error: res.error, skipped: res.skipped });
      if (res.ok) {
        delivered.push(channel);
        if (!options.broadcast) return { ok: true, delivered, attempts };
      }
      continue;
    }
  }

  return { ok: delivered.length > 0, delivered, attempts };
}
