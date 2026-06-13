import { sendWhatsAppOtpMessage } from '@/lib/integrations/whatsapp';
import type { OtpChannel } from '@/lib/survey/send-otp';

export interface SendAuthOtpResult {
  ok: boolean;
  error?: string;
  devCode?: string;
  skipped?: boolean;
}

function isDevAuthOtpMode(): boolean {
  return (
    process.env.AUTH_OTP_DEV_MODE === 'true' ||
    process.env.SURVEY_OTP_DEV_MODE === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}

async function sendTwilioSms(to: string, body: string): Promise<SendAuthOtpResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_SMS_FROM?.trim();

  if (!sid || !token || !from) {
    if (isDevAuthOtpMode()) {
      console.log(`[Auth OTP DEV SMS] ${to}: ${body}`);
      return { ok: true, skipped: true };
    }
    return {
      ok: false,
      error: 'SMS non configuré (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM)',
    };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Twilio (${res.status}): ${text.slice(0, 200)}` };
  }
  return { ok: true };
}

/** SMS libre (rappels, notifications) — pas un code OTP formaté. */
export async function sendTransactionalSms(
  phoneE164: string,
  body: string
): Promise<SendAuthOtpResult> {
  const sms = await sendTwilioSms(phoneE164, body);
  if (!sms.ok && isDevAuthOtpMode()) {
    console.log(`[Transactional SMS DEV] ${phoneE164}: ${body}`);
    return { ok: true, skipped: true };
  }
  return sms;
}

export async function sendAuthOtp(
  phoneE164: string,
  code: string,
  channel: OtpChannel,
  purpose: 'login' | 'signup' | 'recovery'
): Promise<SendAuthOtpResult> {
  const action =
    purpose === 'recovery'
      ? 'réinitialisation mot de passe'
      : purpose === 'login'
        ? 'connexion'
        : 'inscription';
  const message = `KonaData — Code ${action} : ${code}. Valide 10 minutes. Ne partagez pas ce code.`;

  if (channel === 'whatsapp') {
    const wa = await sendWhatsAppOtpMessage(phoneE164, message, code);
    if (!wa.ok && isDevAuthOtpMode()) {
      console.log(`[Auth OTP DEV WhatsApp] ${phoneE164}: ${code}`);
      return { ok: true, skipped: true, devCode: code };
    }
    if (!wa.ok) return wa;
    return { ok: true };
  }

  const sms = await sendTwilioSms(phoneE164, message);
  if (!sms.ok && isDevAuthOtpMode()) {
    console.log(`[Auth OTP DEV] ${phoneE164}: ${code}`);
    return { ok: true, skipped: true, devCode: code };
  }
  if (sms.skipped && isDevAuthOtpMode()) {
    return { ...sms, devCode: code };
  }
  return sms;
}
