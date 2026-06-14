import { sendAuthOtp, type SendAuthOtpResult } from '@/lib/auth/send-auth-otp';
import { whatsappConfig } from '@/lib/integrations/whatsapp';
import type { OtpChannel } from '@/lib/survey/send-otp';

export type GuardianOtpChannel = OtpChannel;

export type SendGuardianOtpResult = SendAuthOtpResult & {
  channel?: GuardianOtpChannel;
};

function isWhatsAppConfigured(): boolean {
  return Boolean(
    whatsappConfig.phoneNumberId?.trim() && whatsappConfig.accessToken?.trim()
  );
}

/** Canal OTP portails parents (suivi / paiement). auto = WhatsApp si Meta configuré, sinon SMS. */
export function resolveGuardianOtpChannel(): GuardianOtpChannel {
  const raw = process.env.GUARDIAN_OTP_CHANNEL?.trim().toLowerCase();
  if (raw === 'sms') return 'sms';
  if (raw === 'whatsapp') return 'whatsapp';
  return isWhatsAppConfigured() ? 'whatsapp' : 'sms';
}

/** OTP tuteur : WhatsApp prioritaire (Meta), repli SMS Twilio si échec. */
export async function sendGuardianPortalOtp(
  phoneE164: string,
  code: string
): Promise<SendGuardianOtpResult> {
  const preferred = resolveGuardianOtpChannel();

  if (preferred === 'whatsapp') {
    const wa = await sendAuthOtp(phoneE164, code, 'whatsapp', 'login');
    if (wa.ok) return { ...wa, channel: 'whatsapp' };
    const sms = await sendAuthOtp(phoneE164, code, 'sms', 'login');
    if (sms.ok) return { ...sms, channel: 'sms' };
    return { ...wa, channel: 'whatsapp' };
  }

  const sms = await sendAuthOtp(phoneE164, code, 'sms', 'login');
  if (sms.ok) return { ...sms, channel: 'sms' };
  if (isWhatsAppConfigured()) {
    const wa = await sendAuthOtp(phoneE164, code, 'whatsapp', 'login');
    if (wa.ok) return { ...wa, channel: 'whatsapp' };
  }
  return { ...sms, channel: 'sms' };
}
