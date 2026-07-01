'use server';

import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { revalidatePath } from 'next/cache';
import type { OrganizationBillingStatus } from '@/lib/billing/types';
import { canOrganizationDirectorPay } from '@/lib/billing/offer-payment';
import {
  sanitizeBillingOfferForDirector,
  sanitizeBillingStatusForDirector,
} from '@/lib/billing/director-billing-view';
import type { AppRole } from '@/types/database';
import { sendPaymentOfferEmail } from '@/lib/email/send-payment-offer';
import { getResendConfig } from '@/lib/email/resend-client';
import { buildPaymentOfferUrl, getAppBaseUrlFromEnv } from '@/lib/http/app-base-url';
import { formatCurrency } from '@/lib/utils';

function canManageBilling(role: AppRole | string | undefined): boolean {
  return role === 'org_admin' || role === 'platform_admin' || role === 'deputy_director';
}

export async function checkOrganizationPlatformAccess(
  organizationId: string | null | undefined
): Promise<boolean> {
  if (!organizationId) return true;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('organization_platform_access_ok', {
    p_org_id: organizationId,
  });
  if (error) {
    console.error('organization_platform_access_ok', error.message);
    return true;
  }
  return Boolean(data);
}

export async function getOrganizationBillingStatus(): Promise<{
  status: OrganizationBillingStatus | null;
  error?: string;
}> {
  const session = await getSession();
  if (!session?.profile?.organization_id) {
    return { status: null, error: 'Aucune organisation' };
  }
  if (!canManageBilling(session.profile.role)) {
    return { status: null, error: 'Réservé au directeur ou à la direction' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_organization_billing_status', {
    p_org_id: session.profile.organization_id,
  });

  if (error) return { status: null, error: error.message };

  let status = data as OrganizationBillingStatus;
  if (session.profile.role !== 'platform_admin') {
    status = sanitizeBillingStatusForDirector(status);
  }
  return { status };
}

export async function updateSchoolDefaultTuitionFee(feeGnf: number) {
  const session = await getSession();
  if (!canManageBilling(session?.profile?.role)) {
    return { error: 'Non autorisé' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('update_school_billing_settings', {
    p_org_id: orgId,
    p_default_tuition_gnf: feeGnf,
  });
  if (error) return { error: error.message };
  revalidatePath('/parametres/facturation');
  revalidatePath('/etablissement/formations');
  revalidatePath('/etablissement/paiements');
  return { success: true, status: data as OrganizationBillingStatus };
}

export async function refreshSchoolPlatformInvoice() {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { error } = await supabase.rpc('refresh_school_platform_invoice', {
    p_org_id: orgId,
  });
  if (error) return { error: error.message };
  revalidatePath('/parametres/facturation');
  return { success: true };
}

export async function recordSubscriptionRenewal(months = 1, reference?: string) {
  const session = await getSession();
  if (!canManageBilling(session?.profile?.role)) {
    return { error: 'Non autorisé' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_subscription_renewal', {
    p_org_id: orgId,
    p_months: months,
    p_reference: reference ?? null,
    p_amount_gnf: null,
  });
  if (error) return { error: error.message };
  revalidatePath('/parametres/facturation');
  revalidatePath('/btp');
  revalidatePath('/ong');
  revalidatePath('/pme');
  return { success: true, data };
}

export interface PendingOrganizationRow {
  id: string;
  name: string;
  type: string;
  email: string | null;
  billing_status: string;
  created_at: string;
  offer_status: string | null;
  activation_amount_gnf: number | null;
  monthly_base_gnf: number | null;
  per_enrolled_student_gnf: number | null;
  declared_expected_students: number | null;
  declared_city: string | null;
  payment_token: string | null;
  application_profile: Record<string, unknown> | null;
  ceo_notes: string | null;
  access_mode: string | null;
  ceo_suspend_reason: string | null;
  subscription_valid_until: string | null;
  ai_plan_tier: string | null;
  ai_monthly_credits: number | null;
  ai_max_requests_per_day: number | null;
}

export async function listOrganizationsForPlatformAdmin(): Promise<{
  rows: PendingOrganizationRow[];
  error?: string;
}> {
  const session = await getSession();
  if (session?.profile?.role !== 'platform_admin') {
    return { rows: [], error: 'Réservé à l’admin KonaData' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organizations')
    .select(
      `id, name, type, email, billing_status, settings, created_at,
       organization_billing_offers(status, activation_amount_gnf, monthly_base_gnf,
         per_enrolled_student_gnf, declared_expected_students, declared_city, payment_token,
         application_profile, ceo_notes, access_mode, ai_plan_tier, ai_monthly_credits,
         ai_max_requests_per_day)`
    )
    .order('created_at', { ascending: false });

  if (error) return { rows: [], error: error.message };

  const rows: PendingOrganizationRow[] = (data ?? []).map((o) => {
    const offer = Array.isArray(o.organization_billing_offers)
      ? o.organization_billing_offers[0]
      : o.organization_billing_offers;
    const off = offer as Record<string, unknown> | null | undefined;
    const settings = (o.settings as Record<string, unknown> | null) ?? {};
    return {
      id: o.id as string,
      name: o.name as string,
      type: o.type as string,
      email: o.email as string | null,
      billing_status: o.billing_status as string,
      created_at: o.created_at as string,
      offer_status: (off?.status as string) ?? null,
      activation_amount_gnf: off?.activation_amount_gnf != null ? Number(off.activation_amount_gnf) : null,
      monthly_base_gnf: off?.monthly_base_gnf != null ? Number(off.monthly_base_gnf) : null,
      per_enrolled_student_gnf:
        off?.per_enrolled_student_gnf != null ? Number(off.per_enrolled_student_gnf) : null,
      declared_expected_students:
        off?.declared_expected_students != null ? Number(off.declared_expected_students) : null,
      declared_city: (off?.declared_city as string) ?? null,
      payment_token: (off?.payment_token as string) ?? null,
      application_profile: (off?.application_profile as Record<string, unknown>) ?? null,
      ceo_notes: (off?.ceo_notes as string) ?? null,
      access_mode: (off?.access_mode as string) ?? null,
      ceo_suspend_reason: (settings.ceo_suspend_reason as string) ?? null,
      subscription_valid_until: (settings.platform_subscription_valid_until as string) ?? null,
      ai_plan_tier: (off?.ai_plan_tier as string) ?? null,
      ai_monthly_credits:
        off?.ai_monthly_credits != null ? Number(off.ai_monthly_credits) : null,
      ai_max_requests_per_day:
        off?.ai_max_requests_per_day != null ? Number(off.ai_max_requests_per_day) : null,
    };
  });

  return { rows };
}

export type PlatformAccessMode = 'annual' | 'trial_30d';

async function resolveOrganizationDirectorEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  fallbackOrgEmail?: string | null
) {
  const { data: director } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('organization_id', orgId)
    .eq('role', 'org_admin')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const email = director?.email?.trim() || fallbackOrgEmail?.trim() || null;
  return {
    email,
    fullName: director?.full_name ?? null,
  };
}

async function loadPaymentOfferEmailContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
) {
  const { data: org } = await supabase
    .from('organizations')
    .select('name, email')
    .eq('id', orgId)
    .single();

  const { data: offer } = await supabase
    .from('organization_billing_offers')
    .select('payment_token, activation_amount_gnf, ceo_notes, access_mode, status')
    .eq('organization_id', orgId)
    .maybeSingle();

  const director = await resolveOrganizationDirectorEmail(
    supabase,
    orgId,
    (org?.email as string) ?? null
  );

  return {
    orgName: (org?.name as string) ?? 'Organisation',
    directorEmail: director.email,
    directorName: director.fullName,
    paymentToken: (offer?.payment_token as string) ?? null,
    amountGnf: Number(offer?.activation_amount_gnf ?? 0),
    ceoNotes: (offer?.ceo_notes as string) ?? null,
    accessMode: (offer?.access_mode as string) ?? null,
    offerStatus: (offer?.status as string) ?? null,
  };
}

export async function platformSendPaymentOfferEmail(orgId: string) {
  const session = await getSession();
  if (session?.profile?.role !== 'platform_admin') {
    return { error: 'Non autorisé' };
  }

  const supabase = await createClient();
  const ctx = await loadPaymentOfferEmailContext(supabase, orgId);

  if (!ctx.paymentToken) {
    return { error: 'Aucun lien de paiement — validez d’abord le tarif.' };
  }
  if (!ctx.directorEmail) {
    return { error: 'Email du directeur introuvable (profil org_admin ou email organisation).' };
  }

  const emailResult = await sendPaymentOfferEmail({
    to: ctx.directorEmail,
    directorName: ctx.directorName,
    orgName: ctx.orgName,
    amountGnf: ctx.amountGnf,
    paymentToken: ctx.paymentToken,
    ceoNotes: ctx.ceoNotes,
    accessMode: ctx.accessMode,
  });

  if (!emailResult.ok) {
    return {
      error: emailResult.error ?? 'Envoi email échoué',
      emailSkipped: emailResult.skipped,
    };
  }

  return { success: true, emailSent: true, sentTo: ctx.directorEmail };
}

export async function platformSetBillingOffer(
  orgId: string,
  activation: number,
  monthlyBase: number,
  perStudent: number,
  notes?: string,
  accessMode: PlatformAccessMode = 'annual',
  aiPlan?: {
    tier: string;
    monthlyCredits: number;
    maxRequestsPerDay: number;
  }
) {
  const session = await getSession();
  if (session?.profile?.role !== 'platform_admin') {
    return { error: 'Non autorisé' };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('platform_admin_set_billing_offer', {
    p_org_id: orgId,
    p_activation: activation,
    p_monthly_base: monthlyBase,
    p_per_student: perStudent,
    p_notes: notes ?? null,
    p_access_mode: accessMode,
    p_ai_plan_tier: aiPlan?.tier ?? null,
    p_ai_monthly_credits: aiPlan?.monthlyCredits ?? null,
    p_ai_max_requests_per_day: aiPlan?.maxRequestsPerDay ?? null,
  });
  if (error) return { error: error.message };

  let emailSent = false;
  let emailWarning: string | undefined;

  if (getResendConfig().apiKey) {
    const ctx = await loadPaymentOfferEmailContext(supabase, orgId);
    if (ctx.paymentToken && ctx.directorEmail && ctx.offerStatus === 'awaiting_payment') {
      const emailResult = await sendPaymentOfferEmail({
        to: ctx.directorEmail,
        directorName: ctx.directorName,
        orgName: ctx.orgName,
        amountGnf: ctx.amountGnf,
        paymentToken: ctx.paymentToken,
        ceoNotes: notes ?? ctx.ceoNotes,
        accessMode: accessMode,
      });
      emailSent = emailResult.ok;
      if (!emailResult.ok) {
        emailWarning = emailResult.error ?? 'Email non envoyé';
      }
    } else if (!ctx.directorEmail) {
      emailWarning = 'Tarif enregistré — email directeur introuvable (copiez le lien manuellement).';
    }
  } else {
    emailWarning =
      'RESEND_API_KEY non configurée — utilisez « Copier lien + montant » ou configurez Resend (Vercel).';
  }

  revalidatePath('/organisations');
  revalidatePath('/parametres/facturation');
  return { success: true, emailSent, emailWarning };
}

export async function platformSuspendOrganization(orgId: string, reason: string) {
  const session = await getSession();
  if (session?.profile?.role !== 'platform_admin') {
    return { error: 'Non autorisé' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('platform_admin_suspend_organization', {
    p_org_id: orgId,
    p_reason: reason.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/organisations');
  revalidatePath('/parametres/facturation');
  return { success: true, data };
}

export async function platformRestoreOrganizationAccess(orgId: string) {
  const session = await getSession();
  if (session?.profile?.role !== 'platform_admin') {
    return { error: 'Non autorisé' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('platform_admin_restore_organization_access', {
    p_org_id: orgId,
  });
  if (error) return { error: error.message };
  revalidatePath('/organisations');
  revalidatePath('/parametres/facturation');
  return { success: true, data };
}

export async function platformActivateSchoolTrial(orgId: string, notes?: string) {
  const session = await getSession();
  if (session?.profile?.role !== 'platform_admin') {
    return { error: 'Non autorisé' };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('platform_admin_activate_school_trial', {
    p_org_id: orgId,
    p_notes: notes ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath('/organisations');
  revalidatePath('/parametres/facturation');
  return { success: true };
}

export async function prepareSchoolRenewalBilling(orgId: string) {
  const session = await getSession();
  if (session?.profile?.role !== 'platform_admin') {
    return { error: 'Réservé à l’admin KonaData' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('prepare_school_renewal_billing', {
    p_org_id: orgId,
  });
  if (error) return { error: error.message };
  revalidatePath('/organisations');
  revalidatePath('/parametres/facturation');
  return { success: true, data };
}

export async function recordOfferActivationPayment(orgId: string, reference?: string) {
  const session = await getSession();
  const role = session?.profile?.role;
  const isPlatform = role === 'platform_admin';
  const isOwner =
    role === 'org_admin' && session?.profile?.organization_id === orgId;
  if (!isPlatform && !isOwner) return { error: 'Non autorisé' };

  const supabase = await createClient();
  if (!isPlatform) {
    const { data: offerRow } = await supabase
      .from('organization_billing_offers')
      .select('status')
      .eq('organization_id', orgId)
      .maybeSingle();
    if (!canOrganizationDirectorPay(offerRow?.status as string | undefined)) {
      return {
        error:
          'Le tarif doit être validé par KonaData avant le paiement. Revenez après réception du lien officiel.',
      };
    }
  }
  const { data, error } = await supabase.rpc('record_offer_activation_payment', {
    p_org_id: orgId,
    p_reference: reference ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath('/organisations');
  revalidatePath('/parametres/facturation');
  return { success: true, data };
}

export async function getBillingOfferByToken(token: string) {
  const session = await getSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_billing_offer_by_token', {
    p_token: token,
  });
  if (error) return { offer: null, error: error.message };
  let offer = data as Record<string, unknown> | null;
  if (offer && session?.profile?.role !== 'platform_admin') {
    offer = sanitizeBillingOfferForDirector(offer);
  }
  return { offer };
}

export async function getOrgPaymentToken(orgId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_billing_offers')
    .select('payment_token')
    .eq('organization_id', orgId)
    .maybeSingle();
  return (data?.payment_token as string) ?? null;
}

/** Texte prêt à coller (WhatsApp, email manuel) avec URL canonique. */
export async function getPaymentOfferClipboardText(
  orgId: string,
  orgName: string,
  amountGnf: number,
  ceoNotes?: string | null
): Promise<{ text: string } | { error: string }> {
  const session = await getSession();
  if (session?.profile?.role !== 'platform_admin') {
    return { error: 'Non autorisé' };
  }
  const token = await getOrgPaymentToken(orgId);
  if (!token) {
    return { error: 'Aucun lien — validez d’abord le tarif (statut « À payer »).' };
  }
  const url = buildPaymentOfferUrl(token, getAppBaseUrlFromEnv());
  const lines = [
    `${orgName} — Activation KonaData`,
    `Montant validé : ${formatCurrency(amountGnf)}`,
    url,
  ];
  if (ceoNotes?.trim()) lines.push(`Note : ${ceoNotes.trim()}`);
  return { text: lines.join('\n') };
}

export async function recordSchoolInvoicePayment(invoiceId: string, reference?: string) {
  const session = await getSession();
  if (!canManageBilling(session?.profile?.role)) {
    return { error: 'Non autorisé' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_school_invoice_payment', {
    p_invoice_id: invoiceId,
    p_reference: reference ?? null,
    p_amount_gnf: null,
  });
  if (error) return { error: error.message };
  revalidatePath('/parametres/facturation');
  revalidatePath('/etablissement');
  return { success: true, data };
}
