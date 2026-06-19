import type { SupabaseClient } from '@supabase/supabase-js';
import { hashOtpCode } from '@/lib/survey/security-hash';

const MAX_ATTEMPTS = 5;

export interface VerifiedOtpChallenge {
  id: string;
  purpose: string;
  phoneE164?: string;
  email?: string;
}

export async function verifyPhoneOtpChallenge(
  supabase: SupabaseClient,
  challengeId: string,
  code: string,
  expectedPurpose: 'signup' | 'login' | 'recovery'
): Promise<{ ok: true; challenge: VerifiedOtpChallenge } | { error: string; status: number }> {
  const { data: challenge, error: fetchErr } = await supabase
    .from('auth_phone_otp_challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();

  if (fetchErr?.message?.includes('auth_phone_otp')) {
    return { error: 'Migration 068 requise (authentification téléphone).', status: 503 };
  }
  if (fetchErr || !challenge) {
    return { error: 'Session OTP introuvable. Demandez un nouveau code.', status: 404 };
  }

  if ((challenge.purpose as string) !== expectedPurpose) {
    return { error: 'Session OTP invalide.', status: 400 };
  }

  if (challenge.verified_at) {
    return { error: 'Code déjà utilisé.', status: 400 };
  }

  if (new Date(challenge.expires_at as string).getTime() < Date.now()) {
    return { error: 'Code expiré. Demandez un nouveau code.', status: 400 };
  }

  const attempts = Number(challenge.attempts ?? 0);
  if (attempts >= MAX_ATTEMPTS) {
    return { error: 'Trop de tentatives. Demandez un nouveau code.', status: 429 };
  }

  if (hashOtpCode(code) !== challenge.code_hash) {
    await supabase
      .from('auth_phone_otp_challenges')
      .update({ attempts: attempts + 1 })
      .eq('id', challengeId);
    return { error: 'Code incorrect.', status: 401 };
  }

  return {
    ok: true,
    challenge: {
      id: challenge.id as string,
      purpose: challenge.purpose as string,
      phoneE164: challenge.phone_e164 as string,
    },
  };
}

export async function verifyEmailOtpChallenge(
  supabase: SupabaseClient,
  challengeId: string,
  code: string
): Promise<{ ok: true; challenge: VerifiedOtpChallenge } | { error: string; status: number }> {
  const { data: challenge, error: fetchErr } = await supabase
    .from('auth_email_otp_challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();

  if (fetchErr?.message?.includes('auth_email_otp')) {
    return { error: 'Migration 104 requise (OTP email inscription).', status: 503 };
  }
  if (fetchErr || !challenge) {
    return { error: 'Session OTP introuvable. Demandez un nouveau code.', status: 404 };
  }

  if ((challenge.purpose as string) !== 'signup') {
    return { error: 'Session OTP invalide.', status: 400 };
  }

  if (challenge.verified_at) {
    return { error: 'Code déjà utilisé.', status: 400 };
  }

  if (new Date(challenge.expires_at as string).getTime() < Date.now()) {
    return { error: 'Code expiré. Demandez un nouveau code.', status: 400 };
  }

  const attempts = Number(challenge.attempts ?? 0);
  if (attempts >= MAX_ATTEMPTS) {
    return { error: 'Trop de tentatives. Demandez un nouveau code.', status: 429 };
  }

  if (hashOtpCode(code) !== challenge.code_hash) {
    await supabase
      .from('auth_email_otp_challenges')
      .update({ attempts: attempts + 1 })
      .eq('id', challengeId);
    return { error: 'Code incorrect.', status: 401 };
  }

  return {
    ok: true,
    challenge: {
      id: challenge.id as string,
      purpose: challenge.purpose as string,
      email: (challenge.email as string).toLowerCase(),
    },
  };
}

export async function markPhoneOtpVerified(supabase: SupabaseClient, challengeId: string) {
  await supabase
    .from('auth_phone_otp_challenges')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', challengeId);
}

export async function markEmailOtpVerified(supabase: SupabaseClient, challengeId: string) {
  await supabase
    .from('auth_email_otp_challenges')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', challengeId);
}
