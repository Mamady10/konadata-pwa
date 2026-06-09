export type PhoneOtpPurpose = 'login' | 'signup';
export type PhoneOtpChannel = 'sms' | 'whatsapp';

export interface RequestPhoneOtpResult {
  success?: boolean;
  challengeId?: string;
  channel?: PhoneOtpChannel;
  maskedPhone?: string;
  devCode?: string;
  error?: string;
}

export interface VerifyPhoneOtpResult {
  success?: boolean;
  isNewUser?: boolean;
  phoneE164?: string;
  error?: string;
}

export async function requestPhoneOtp(params: {
  phone: string;
  purpose: PhoneOtpPurpose;
  channel?: PhoneOtpChannel;
}): Promise<RequestPhoneOtpResult> {
  const res = await fetch('/api/auth/phone/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error ?? 'Envoi impossible' };
  return data as RequestPhoneOtpResult;
}

export async function verifyPhoneOtp(params: {
  challengeId: string;
  code: string;
  fullName?: string;
  accountIntent?: string;
  signupIntent?: string;
}): Promise<VerifyPhoneOtpResult> {
  const res = await fetch('/api/auth/phone/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error ?? 'Vérification impossible' };
  return data as VerifyPhoneOtpResult;
}
