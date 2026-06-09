import type { SupabaseClient } from '@supabase/supabase-js';

export type SurveySecuritySettings = {
  require_phone_otp: boolean;
  otp_channel: 'sms' | 'whatsapp';
  one_per_device: boolean;
  device_lock_days: number;
  rate_limit_otp_per_ip_hour: number;
  rate_limit_submit_per_ip_hour: number;
};

export async function getSurveyByPublicToken(
  supabase: SupabaseClient,
  token: string
): Promise<{ survey: Record<string, unknown> | null; error?: string }> {
  const { data, error } = await supabase.rpc('get_ngo_survey_by_public_token', {
    p_token: token,
  });
  if (error) return { survey: null, error: error.message };
  if (!data || typeof data !== 'object') return { survey: null, error: 'Lien invalide' };
  const row = data as Record<string, unknown>;
  if (row.error) return { survey: null, error: String(row.error) };
  return { survey: row };
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  bucketKey: string,
  limit: number
): Promise<{ allowed: boolean; error?: string; retryAfterMinutes?: number }> {
  const { data, error } = await supabase.rpc('ngo_survey_rate_limit_check', {
    p_bucket_key: bucketKey,
    p_limit: limit,
  });
  if (error?.message?.includes('ngo_survey_rate_limit_check')) {
    return { allowed: true };
  }
  if (error) return { allowed: false, error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.allowed === false) {
    return {
      allowed: false,
      error: `Trop de tentatives. Réessayez dans ${row.retry_after_minutes ?? 60} minutes.`,
      retryAfterMinutes: Number(row.retry_after_minutes ?? 60),
    };
  }
  return { allowed: true };
}

export async function isParticipationLocked(
  supabase: SupabaseClient,
  surveyId: string,
  lockType: 'device' | 'phone',
  lockHash: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('ngo_survey_participation_locked', {
    p_survey_id: surveyId,
    p_lock_type: lockType,
    p_lock_hash: lockHash,
  });
  if (error) return false;
  return Boolean(data);
}

export function parseSecuritySettings(raw: unknown): SurveySecuritySettings {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    require_phone_otp: s.require_phone_otp !== false,
    otp_channel: s.otp_channel === 'whatsapp' ? 'whatsapp' : 'sms',
    one_per_device: s.one_per_device !== false,
    device_lock_days: Number(s.device_lock_days ?? 30),
    rate_limit_otp_per_ip_hour: Number(s.rate_limit_otp_per_ip_hour ?? 5),
    rate_limit_submit_per_ip_hour: Number(s.rate_limit_submit_per_ip_hour ?? 30),
  };
}
