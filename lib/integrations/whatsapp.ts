import type { SendOtpResult } from '@/lib/survey/send-otp';

export const whatsappConfig = {
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  apiVersion: 'v21.0',
  otpTemplateName: process.env.WHATSAPP_OTP_TEMPLATE_NAME?.trim() || '',
  otpTemplateLanguage: process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE?.trim() || 'fr',
  /** false pour hello_world (sans variable {{1}}) */
  otpTemplateHasParams: process.env.WHATSAPP_OTP_TEMPLATE_HAS_PARAMS !== 'false',
  /**
   * Template utilitaire (approuvé Meta) à un paramètre {{1}} servant à envoyer
   * n'importe quel texte de notification hors fenêtre 24 h (liens de paiement,
   * invitations, rappels, inscriptions...). Sans lui, on tente le texte libre
   * (valide uniquement dans la fenêtre de service 24 h).
   */
  notifyTemplateName: process.env.WHATSAPP_NOTIFY_TEMPLATE_NAME?.trim() || '',
  notifyTemplateLanguage:
    process.env.WHATSAPP_NOTIFY_TEMPLATE_LANGUAGE?.trim() || 'fr',
};

/** WhatsApp Cloud API (Meta) est-il configuré ? */
export function isWhatsAppConfigured(): boolean {
  return Boolean(
    whatsappConfig.phoneNumberId?.trim() && whatsappConfig.accessToken?.trim()
  );
}

function isDevMode(): boolean {
  return (
    process.env.SURVEY_OTP_DEV_MODE === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}

/** Appel bas niveau à l'API Graph de Meta, factorisé pour tous les types d'envoi. */
async function postWhatsAppPayload(
  payload: Record<string, unknown>,
  logTarget: string,
  logBody: string
): Promise<SendOtpResult> {
  const { phoneNumberId, accessToken, apiVersion } = whatsappConfig;

  if (!phoneNumberId || !accessToken) {
    if (isDevMode()) {
      console.log(`[KonaData WhatsApp DEV] ${logTarget}: ${logBody}`);
      return { ok: true, skipped: true };
    }
    return {
      ok: false,
      error: 'WhatsApp non configuré (WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN)',
    };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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
        console.log(`[KonaData WhatsApp DEV fallback] ${logTarget}: ${logBody}`);
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

/** Envoi texte libre (valide seulement dans la fenêtre de service 24 h). */
export async function sendWhatsAppText(
  toE164: string,
  body: string
): Promise<SendOtpResult> {
  const to = toE164.replace(/\D/g, '');
  return postWhatsAppPayload(
    { messaging_product: 'whatsapp', to, type: 'text', text: { body } },
    toE164,
    body
  );
}

/**
 * Envoi d'une notification transactionnelle (lien de paiement, invitation,
 * inscription, rappel...). Utilise le template utilitaire à un paramètre s'il est
 * configuré (recommandé, fonctionne hors fenêtre 24 h), sinon repli en texte libre.
 */
export async function sendWhatsAppNotification(
  toE164: string,
  body: string
): Promise<SendOtpResult> {
  const { notifyTemplateName, notifyTemplateLanguage } = whatsappConfig;
  const to = toE164.replace(/\D/g, '');

  if (notifyTemplateName) {
    return postWhatsAppPayload(
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: notifyTemplateName,
          language: { code: notifyTemplateLanguage },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: body }] },
          ],
        },
      },
      toE164,
      body
    );
  }

  return sendWhatsAppText(toE164, body);
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
  const { otpTemplateName } = whatsappConfig;

  if (code?.trim() && !otpTemplateName && !isDevMode()) {
    return {
      ok: false,
      error:
        'WhatsApp OTP : configurez WHATSAPP_OTP_TEMPLATE_NAME (template Authentication approuvé Meta)',
    };
  }

  const to = toE164.replace(/\D/g, '');
  return postWhatsAppPayload(buildOtpPayload(to, message, code), toE164, message);
}

/** @deprecated — utiliser sendWhatsAppNotification (transactionnel) ou sendWhatsAppOtpMessage (OTP) */
export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  const result = await sendWhatsAppNotification(to, message);
  return result.ok;
}
