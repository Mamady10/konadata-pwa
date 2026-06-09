import { createClient } from '@/lib/supabase/client';

export interface RedeemCodeResult {
  success?: boolean;
  error?: string;
  organizationName?: string;
  organizationType?: string;
  role?: string;
}

export async function redeemAccessCodeClient(code: string): Promise<RedeemCodeResult> {
  const supabase = createClient();
  const normalized = code.trim().toUpperCase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Connectez-vous ou créez un compte avant de valider le code.' };
  }

  const { data, error } = await supabase.rpc('redeem_access_code', { p_code: normalized });

  if (error) {
    return { error: error.message };
  }

  const payload = data as {
    organization_name?: string;
    organization_type?: string;
    role?: string;
  } | null;

  return {
    success: true,
    organizationName: payload?.organization_name,
    organizationType: payload?.organization_type,
    role: payload?.role,
  };
}
