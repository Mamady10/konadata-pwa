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
  profileId?: string;
}): Promise<{
  success?: boolean;
  error?: string;
  accounts?: { id: string; label: string }[];
}> {
  try {
    const res = await fetch('/api/auth/phone/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(params),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      accounts?: { id: string; label: string }[];
    };
    if (!res.ok) {
      return {
        error: data.error ?? 'Réinitialisation impossible',
        ...(data.accounts?.length ? { accounts: data.accounts } : {}),
      };
    }
    return { success: true };
  } catch {
    return { error: 'Connexion impossible. Vérifiez votre réseau.' };
  }
}
