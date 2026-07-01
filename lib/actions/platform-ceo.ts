'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/actions/auth';
import { sendPasswordResetEmail } from '@/lib/auth/send-password-reset-email';
import { revalidatePath } from 'next/cache';

async function requirePlatformAdmin() {
  const session = await getSession();
  if (session?.profile?.role !== 'platform_admin') {
    return { error: 'Réservé à l\'admin KonaData' as const };
  }
  return { session };
}

export type OrgUsageRow = {
  org_id: string;
  org_name: string;
  org_type: string;
  billing_status: string;
  user_count: number;
  student_count: number;
  project_count: number;
  site_count: number;
  platform_payments_gnf: number;
  survey_payments_gnf: number;
  cgu_accepted: boolean;
  dpa_accepted: boolean;
};

export type BillingPaymentRow = {
  id: string;
  organization_id: string;
  org_name: string;
  kind: string;
  amount_gnf: number;
  reference: string | null;
  paid_at: string;
  payment_method: string | null;
};

export type BillingSummary = {
  platformPaymentsGnf: number;
  surveyPaymentsGnf: number;
  totalRevenueGnf: number;
  paymentCount: number;
  byMonth: { month: string; amount_gnf: number; count: number }[];
};

export async function getOrganizationsUsageStats(): Promise<
  { rows: OrgUsageRow[] } | { error: string }
> {
  const gate = await requirePlatformAdmin();
  if ('error' in gate) return gate;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_organizations_usage_stats');
  if (error) {
    return {
      error: error.message.includes('does not exist')
        ? 'Migration 108 requise. Exécutez 108-ceo-platform-governance-ONLY.sql.'
        : error.message,
    };
  }

  const rows = ((data as OrgUsageRow[]) ?? []).map((r) => ({
    ...r,
    platform_payments_gnf: Number(r.platform_payments_gnf ?? 0),
    survey_payments_gnf: Number(r.survey_payments_gnf ?? 0),
  }));
  return { rows };
}

export async function getPlatformBillingSummary(): Promise<
  BillingSummary | { error: string }
> {
  const gate = await requirePlatformAdmin();
  if ('error' in gate) return gate;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_platform_billing_summary');
  if (error) {
    return {
      error: error.message.includes('does not exist')
        ? 'Migration 108 requise.'
        : error.message,
    };
  }

  const raw = data as {
    platform_payments_gnf: number;
    survey_payments_gnf: number;
    total_revenue_gnf: number;
    payment_count: number;
    by_month: { month: string; amount_gnf: number; count: number }[];
  };

  return {
    platformPaymentsGnf: Number(raw.platform_payments_gnf ?? 0),
    surveyPaymentsGnf: Number(raw.survey_payments_gnf ?? 0),
    totalRevenueGnf: Number(raw.total_revenue_gnf ?? 0),
    paymentCount: Number(raw.payment_count ?? 0),
    byMonth: raw.by_month ?? [],
  };
}

export async function listPlatformBillingPayments(limit = 50): Promise<
  { rows: BillingPaymentRow[] } | { error: string }
> {
  const gate = await requirePlatformAdmin();
  if ('error' in gate) return gate;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_platform_billing_payments', {
    p_limit: limit,
  });
  if (error) return { error: error.message };

  const rows = ((data as BillingPaymentRow[]) ?? []).map((r) => ({
    ...r,
    amount_gnf: Number(r.amount_gnf),
  }));
  return { rows };
}

export async function platformAdminUpdateOrganizationName(
  orgId: string,
  name: string
): Promise<{ success: true; name: string } | { error: string }> {
  const gate = await requirePlatformAdmin();
  if ('error' in gate) return gate;

  const trimmed = name.trim();
  if (!trimmed) return { error: 'Le nom ne peut pas être vide' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('platform_admin_update_organization_name', {
    p_org_id: orgId,
    p_name: trimmed,
  });
  if (error) return { error: error.message };
  if (data && typeof data === 'object' && 'error' in (data as object)) {
    return { error: String((data as { error: string }).error) };
  }

  revalidatePath('/organisations');
  revalidatePath('/dashboard');
  return { success: true, name: String((data as { name?: string })?.name ?? trimmed) };
}

export async function platformAdminSendDirectorPasswordReset(
  orgId: string
): Promise<{ success: true; sentTo: string } | { error: string }> {
  const gate = await requirePlatformAdmin();
  if ('error' in gate) return gate;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_organization_directors_for_ceo', {
    p_org_id: orgId,
  });
  if (error) return { error: error.message };

  const directors = (data as { email: string; full_name: string }[]) ?? [];
  const director = directors.find((d) => d.email?.trim());
  if (!director?.email) {
    return { error: 'Aucun directeur avec email trouvé. Utilisez la récupération par téléphone.' };
  }

  const result = await sendPasswordResetEmail(director.email);
  if (!result.sent) {
    return { error: result.error ?? 'Envoi du lien de réinitialisation impossible' };
  }

  return { success: true, sentTo: director.email };
}
