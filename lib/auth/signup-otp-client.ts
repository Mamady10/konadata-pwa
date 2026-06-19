import { postPublicJson } from '@/lib/http/public-json-fetch';
import type { PhoneOtpChannel } from '@/lib/auth/phone-otp-client';

export interface RequestSignupOtpResult {
  success?: boolean;
  challengeId?: string;
  channel?: PhoneOtpChannel | 'email';
  maskedPhone?: string;
  maskedEmail?: string;
  devCode?: string;
  error?: string;
}

export interface CompleteSignupOtpResult {
  success?: boolean;
  error?: string;
}

export async function requestSignupPhoneOtp(params: {
  phone: string;
  channel?: PhoneOtpChannel;
}): Promise<RequestSignupOtpResult> {
  const result = await postPublicJson<RequestSignupOtpResult>('/api/auth/phone/request-otp', {
    phone: params.phone,
    purpose: 'signup',
    channel: params.channel ?? 'whatsapp',
  });
  if (!result.ok) return { error: result.error };
  return result.data;
}

export async function requestSignupEmailOtp(email: string): Promise<RequestSignupOtpResult> {
  const result = await postPublicJson<RequestSignupOtpResult>('/api/auth/email/request-otp', {
    email,
  });
  if (!result.ok) return { error: result.error };
  return result.data;
}

export async function completeSignupWithPhoneOtp(params: {
  challengeId: string;
  code: string;
  password: string;
  fullName: string;
  accountIntent?: string;
  signupIntent?: string;
}): Promise<CompleteSignupOtpResult> {
  const result = await postPublicJson<CompleteSignupOtpResult>(
    '/api/auth/phone/complete-signup',
    params
  );
  if (!result.ok) return { error: result.error };
  return result.data;
}

export async function completeSignupWithEmailOtp(params: {
  challengeId: string;
  code: string;
  password: string;
  fullName: string;
  accountIntent?: string;
  signupIntent?: string;
}): Promise<CompleteSignupOtpResult> {
  const result = await postPublicJson<CompleteSignupOtpResult>(
    '/api/auth/email/complete-signup',
    params
  );
  if (!result.ok) return { error: result.error };
  return result.data;
}
