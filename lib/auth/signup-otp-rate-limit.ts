import type { createServiceClient } from '@/lib/supabase/server';

const MAX_OTP_PER_IP_HOUR = 8;

export async function checkSignupOtpRateLimit(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  ipHash: string,
  table: 'auth_phone_otp_challenges' | 'auth_email_otp_challenges'
): Promise<{ allowed: boolean; error?: string }> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);

  if (error?.message?.includes(table)) {
    return { allowed: false, error: `Migration requise pour ${table}.` };
  }
  if (error) return { allowed: false, error: error.message };
  if ((count ?? 0) >= MAX_OTP_PER_IP_HOUR) {
    return { allowed: false, error: 'Trop de demandes. Réessayez dans une heure.' };
  }
  return { allowed: true };
}
