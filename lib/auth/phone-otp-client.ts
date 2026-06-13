import { postPublicJson } from '@/lib/http/public-json-fetch';

export type PhoneOtpPurpose = 'login' | 'signup' | 'recovery';
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
  const result = await postPublicJson<RequestPhoneOtpResult>(
    '/api/auth/phone/request-otp',
    params
  );
  if (!result.ok) return { error: result.error };
  return result.data;
}

export async function verifyPhoneOtp(params: {
  challengeId: string;
  code: string;
  fullName?: string;
  accountIntent?: string;
  signupIntent?: string;
}): Promise<VerifyPhoneOtpResult> {
  const result = await postPublicJson<VerifyPhoneOtpResult>(
    '/api/auth/phone/verify-otp',
    params
  );
  if (!result.ok) return { error: result.error };
  return result.data;
}

export async function resetPasswordWithPhoneOtp(params: {
  challengeId: string;
  code: string;
  password: string;
}): Promise<{ success?: boolean; error?: string }> {
  const result = await postPublicJson<{ error?: string }>(
    '/api/auth/phone/reset-password',
    params
  );
  if (!result.ok) return { error: result.error };
  return { success: true };
}
