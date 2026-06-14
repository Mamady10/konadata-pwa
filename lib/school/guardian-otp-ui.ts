import type { GuardianOtpChannel } from '@/lib/auth/guardian-otp';

export function guardianOtpChannelLabel(channel: GuardianOtpChannel): string {
  return channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
}

export const GUARDIAN_OTP_INTRO =
  'Matricule + téléphone tuteur, puis code de confirmation par WhatsApp ou SMS.';
