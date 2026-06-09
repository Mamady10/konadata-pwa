import { sendWhatsAppOtpMessage } from '@/lib/integrations/whatsapp';

export type OtpChannel = 'sms' | 'whatsapp';

export interface SendOtpResult {
  ok: boolean;
  error?: string;
  devCode?: string;
  skipped?: boolean;
}

function isDevOtpMode(): boolean {
  return (
    process.env.SURVEY_OTP_DEV_MODE === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}

async function sendTwilioSms(to: string, body: string): Promise<SendOtpResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_SMS_FROM?.trim();

  if (!sid || !token || !from) {
    if (isDevOtpMode()) {
      console.log(`[Survey OTP DEV SMS] ${to}: ${body}`);
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

export async function sendSurveyOtp(
  phoneE164: string,
  code: string,
  channel: OtpChannel,
  surveyTitle: string
): Promise<SendOtpResult> {
  const message = `KonaData — Code sondage « ${surveyTitle.slice(0, 40)} » : ${code}. Valide 10 minutes. Ne partagez pas ce code.`;

  if (channel === 'whatsapp') {
    const wa = await sendWhatsAppOtpMessage(phoneE164, message);
    if (!wa.ok && isDevOtpMode()) {
      console.log(`[Survey OTP DEV WhatsApp] ${phoneE164}: ${code}`);
      return { ok: true, skipped: true, devCode: code };
    }
    if (!wa.ok) return wa;
    return { ok: true };
  }

  const sms = await sendTwilioSms(phoneE164, message);
  if (!sms.ok && isDevOtpMode()) {
    console.log(`[Survey OTP DEV] ${phoneE164}: ${code}`);
    return { ok: true, skipped: true, devCode: code };
  }
  if (sms.skipped && isDevOtpMode()) {
    return { ...sms, devCode: code };
  }
  return sms;
}
