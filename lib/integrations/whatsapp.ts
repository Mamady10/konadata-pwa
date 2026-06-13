import type { SendOtpResult } from '@/lib/survey/send-otp';

export const whatsappConfig = {
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  apiVersion: 'v21.0',
  otpTemplateName: process.env.WHATSAPP_OTP_TEMPLATE_NAME?.trim() || '',
  otpTemplateLanguage: process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE?.trim() || 'fr',
  /** false pour hello_world (sans variable {{1}}) */
  otpTemplateHasParams: process.env.WHATSAPP_OTP_TEMPLATE_HAS_PARAMS !== 'false',
};

function isDevMode(): boolean {
  return (
    process.env.SURVEY_OTP_DEV_MODE === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}

function buildOtpPayload(to: string, message: string, code?: string): Record<string, unknown> {
  const { otpTemplateName, otpTemplateLanguage, otpTemplateHasParams } = whatsappConfig;
  const otp = code?.trim();

  if (otpTemplateName) {
    const template: Record<string, unknown> = {
      name: otpTemplateName,
      language: { code: otpTemplateLanguage },
    };

    if (otpTemplateHasParams && otp) {
      template.components = [
        {
          type: 'body',
          parameters: [{ type: 'text', text: otp }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: otp }],
        },
      ];
    }

    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template,
    };
  }

  return {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: message },
  };
}

/** Envoie un OTP via template Authentication Meta (recommandé) ou texte libre (fallback). */
export async function sendWhatsAppOtpMessage(
  toE164: string,
  message: string,
  code?: string
): Promise<SendOtpResult> {
  const { phoneNumberId, accessToken, apiVersion, otpTemplateName } = whatsappConfig;

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

  if (code?.trim() && !otpTemplateName && !isDevMode()) {
    return {
      ok: false,
      error:
        'WhatsApp OTP : configurez WHATSAPP_OTP_TEMPLATE_NAME (template Authentication approuvé Meta)',
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
        body: JSON.stringify(buildOtpPayload(to, message, code)),
      }
    );

    const bodyText = await res.text();
    let data: { error?: { message?: string; code?: number }; messages?: { id?: string }[] } = {};
    try {
      data = JSON.parse(bodyText) as typeof data;
    } catch {
      /* corps non-JSON */
    }

    if (!res.ok || data.error) {
      const detail = data.error?.message ?? bodyText.slice(0, 240);
      if (isDevMode()) {
        console.log(`[KonaData WhatsApp DEV fallback] ${toE164}: ${message}`);
        return { ok: true, skipped: true };
      }
      return { ok: false, error: `WhatsApp API (${res.status}): ${detail}` };
    }

    if (!data.messages?.[0]?.id) {
      return {
        ok: false,
        error: 'WhatsApp : Meta a accepté la requête sans identifiant de message',
      };
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
