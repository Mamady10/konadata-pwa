import type { SendOtpResult } from '@/lib/survey/send-otp';

export const whatsappConfig = {
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  apiVersion: 'v21.0',
};

function isDevMode(): boolean {
  return (
    process.env.SURVEY_OTP_DEV_MODE === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}

/** Envoie un message texte via WhatsApp Business Cloud API. */
export async function sendWhatsAppOtpMessage(
  toE164: string,
  message: string
): Promise<SendOtpResult> {
  const { phoneNumberId, accessToken, apiVersion } = whatsappConfig;

  if (!phoneNumberId || !accessToken) {
    if (isDevMode()) {
      console.log(`[KonaData WhatsApp DEV] ${toE164}: ${message}`);
      return { ok: true, skipped: true };
    }
    return {
      ok: false,
      error: 'WhatsApp non configuré (WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN)',
    };
  }

  const to = toE164.replace(/\D/g, '');

  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      if (isDevMode()) {
        console.log(`[KonaData WhatsApp DEV fallback] ${toE164}: ${message}`);
        return { ok: true, skipped: true };
      }
      return { ok: false, error: `WhatsApp API (${res.status}): ${body.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur WhatsApp' };
  }
}

/** @deprecated — utiliser sendWhatsAppOtpMessage */
export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  const result = await sendWhatsAppOtpMessage(to, message);
  return result.ok;
}
