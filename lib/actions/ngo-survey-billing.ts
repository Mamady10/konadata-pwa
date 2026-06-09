'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { isOngDirector } from '@/lib/ong/ong-access';
import { sendSurveyCampaignPaymentEmail } from '@/lib/email/send-survey-payment';
import { sendSurveyCeoRequestEmail } from '@/lib/email/send-survey-ceo-request';
import { getResendConfig } from '@/lib/email/resend-client';
import type { SurveyChargeCeoRow } from '@/lib/ngo/survey-billing';
import { parseSurveyQuestions } from '@/lib/ngo/survey-questions';

async function resolveDirectorEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  session: Awaited<ReturnType<typeof getSession>> | null
) {
  const fromSession =
    (session?.profile?.email as string | undefined) ??
    (session?.user?.email as string | undefined);
  if (fromSession) return fromSession;

  const { data: admin } = await supabase
    .from('profiles')
    .select('email')
    .eq('organization_id', orgId)
    .in('role', ['org_admin', 'deputy_director'])
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return (admin?.email as string) ?? null;
}

async function dispatchSurveyPaymentEmail(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
  surveyTitle: string;
  directorName?: string | null;
  charge: {
    amount_gnf: unknown;
    payment_token: string;
    target_responses: unknown;
    breakdown: unknown;
    ceo_notes?: string | null;
    status: string;
  };
  isRevision?: boolean;
  previousAmountGnf?: number;
}) {
  if (params.charge.status === 'awaiting_ceo_quote') {
    return { error: 'Le tarif n\'a pas encore été fixé par KonaData' };
  }
  if (params.charge.status === 'paid' || params.charge.status === 'waived') {
    return { error: 'Cette campagne est déjà réglée ou exonérée' };
  }

  const directorEmail = await resolveDirectorEmail(params.supabase, params.orgId, null);
  if (!directorEmail) {
    return { error: 'Email du directeur introuvable' };
  }

  const { data: org } = await params.supabase
    .from('organizations')
    .select('name')
    .eq('id', params.orgId)
    .maybeSingle();

  const breakdown = (params.charge.breakdown ?? {}) as Record<string, unknown>;
  const emailResult = await sendSurveyCampaignPaymentEmail({
    to: directorEmail,
    directorName: params.directorName ?? null,
    orgName: (org?.name as string) ?? 'ONG',
    surveyTitle: params.surveyTitle,
    amountGnf: Number(params.charge.amount_gnf ?? 0),
    targetResponses: Number(params.charge.target_responses ?? breakdown.target_count ?? 0),
    paymentToken: params.charge.payment_token,
    baseFeeGnf: breakdown.base_fee_gnf != null ? Number(breakdown.base_fee_gnf) : undefined,
    perTargetGnf: breakdown.per_target_gnf != null ? Number(breakdown.per_target_gnf) : undefined,
    isRevision: params.isRevision,
    previousAmountGnf: params.previousAmountGnf,
    ceoNotes: params.charge.ceo_notes ?? null,
  });

  if (!emailResult.ok) {
    return {
      error: emailResult.error ?? 'Envoi email échoué',
      emailSkipped: emailResult.skipped,
    };
  }

  return { success: true, emailSent: true, sentTo: directorEmail };
}

/** Envoi paiement par ID charge — utilisé par le CEO (hors contexte org). */
export async function sendNgoSurveyPaymentEmailByChargeId(
  chargeId: string,
  options?: { isRevision?: boolean; previousAmountGnf?: number }
) {
  const session = await getSession();
  if (session?.profile?.role !== 'platform_admin') {
    return { error: 'Non autorisé' };
  }

  const supabase = await createClient();
  const { data: charge } = await supabase
    .from('ngo_survey_charges')
    .select(
      'amount_gnf, payment_token, target_responses, breakdown, status, ceo_notes, organization_id, survey_id'
    )
    .eq('id', chargeId)
    .maybeSingle();

  if (!charge?.payment_token) {
    return { error: 'Aucune facture campagne pour cette demande' };
  }

  const { data: survey } = await supabase
    .from('ngo_surveys')
    .select('title')
    .eq('id', charge.survey_id as string)
    .maybeSingle();

  if (!survey) return { error: 'Sondage introuvable' };

  return dispatchSurveyPaymentEmail({
    supabase,
    orgId: charge.organization_id as string,
    surveyTitle: survey.title as string,
    charge: charge as {
      amount_gnf: unknown;
      payment_token: string;
      target_responses: unknown;
      breakdown: unknown;
      ceo_notes?: string | null;
      status: string;
    },
    isRevision: options?.isRevision,
    previousAmountGnf: options?.previousAmountGnf,
  });
}

export async function sendNgoSurveyPaymentEmail(surveyId: string) {
  const session = await getSession();
  if (!isOngDirector(session?.profile?.role) && session?.profile?.role !== 'platform_admin') {
    return { error: 'Non autorisé' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: survey } = await supabase
    .from('ngo_surveys')
    .select('id, title, organization_id')
    .eq('id', surveyId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!survey) return { error: 'Sondage introuvable' };

  const { data: charge } = await supabase
    .from('ngo_survey_charges')
    .select('amount_gnf, payment_token, target_responses, breakdown, status, ceo_notes')
    .eq('survey_id', surveyId)
    .maybeSingle();

  if (!charge?.payment_token) {
    return { error: 'Aucune facture campagne pour ce sondage' };
  }

  const breakdown = (charge.breakdown ?? {}) as Record<string, unknown>;
  return dispatchSurveyPaymentEmail({
    supabase,
    orgId,
    surveyTitle: survey.title as string,
    directorName: session?.profile?.full_name ?? null,
    charge: charge as {
      amount_gnf: unknown;
      payment_token: string;
      target_responses: unknown;
      breakdown: unknown;
      ceo_notes?: string | null;
      status: string;
    },
    isRevision: Boolean(breakdown.is_revision),
    previousAmountGnf:
      breakdown.previous_amount_gnf != null ? Number(breakdown.previous_amount_gnf) : undefined,
  });
}

/** Notification CEO après soumission du sondage (ne bloque pas la création). */
export async function tryNotifyCeoSurveyQuoteRequest(params: {
  orgId: string;
  surveyId: string;
  chargeId: string;
  surveyTitle: string;
  surveyDescription?: string | null;
  surveyRegion?: string | null;
  targetResponses: number;
  collectionMode?: string | null;
  questions?: unknown;
  directorName?: string | null;
  directorEmail?: string | null;
}) {
  const questions = parseSurveyQuestions(params.questions);
  const first = questions[0];
  const emailResult = await sendSurveyCeoRequestEmail({
    orgName: await loadOrgName(params.orgId),
    directorName: params.directorName,
    directorEmail: params.directorEmail,
    surveyTitle: params.surveyTitle,
    surveyDescription: params.surveyDescription,
    surveyRegion: params.surveyRegion,
    targetResponses: params.targetResponses,
    collectionMode: params.collectionMode,
    questionText: first?.text,
    options: first?.options,
    chargeId: params.chargeId,
    surveyId: params.surveyId,
  });
  if (!emailResult.ok) {
    return { ceoNotified: false, ceoNotifyWarning: emailResult.error ?? 'Notification CEO échouée' };
  }
  return { ceoNotified: true };
}

async function loadOrgName(orgId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from('organizations').select('name').eq('id', orgId).maybeSingle();
  return (data?.name as string) ?? 'ONG';
}

/** @deprecated — paiement envoyé après validation CEO */
export async function trySendSurveyPaymentEmailAfterCreate(params: {
  orgId: string;
  surveyTitle: string;
  amountGnf: number;
  targetResponses: number;
  paymentToken: string;
  breakdown?: Record<string, unknown>;
  directorName?: string | null;
  directorEmail?: string | null;
}) {
  if (!getResendConfig().apiKey) {
    return { emailSent: false, emailWarning: 'RESEND_API_KEY non configurée' };
  }

  const email = params.directorEmail?.trim();
  if (!email) {
    return { emailSent: false, emailWarning: 'Email directeur introuvable' };
  }

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', params.orgId)
    .maybeSingle();

  const b = params.breakdown ?? {};
  const emailResult = await sendSurveyCampaignPaymentEmail({
    to: email,
    directorName: params.directorName,
    orgName: (org?.name as string) ?? 'ONG',
    surveyTitle: params.surveyTitle,
    amountGnf: params.amountGnf,
    targetResponses: params.targetResponses,
    paymentToken: params.paymentToken,
    baseFeeGnf: b.base_fee_gnf != null ? Number(b.base_fee_gnf) : undefined,
    perTargetGnf: b.per_target_gnf != null ? Number(b.per_target_gnf) : undefined,
  });

  if (!emailResult.ok) {
    return {
      emailSent: false,
      emailWarning: emailResult.error ?? 'Envoi email échoué',
    };
  }

  return { emailSent: true, sentTo: email };
}

export async function listNgoSurveysAwaitingCeoQuote(): Promise<{
  rows: SurveyChargeCeoRow[];
  error?: string;
}> {
  const out = await listNgoSurveyChargesForCeoManagement();
  if (out.error) return out;
  return {
    rows: out.rows.filter((r) => r.status === 'awaiting_ceo_quote'),
  };
}

export async function listNgoSurveyChargesForCeoManagement(): Promise<{
  rows: SurveyChargeCeoRow[];
  error?: string;
}> {
  const session = await getSession();
  if (session?.profile?.role !== 'platform_admin') {
    return { rows: [], error: 'Non autorisé' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_ngo_survey_charges_for_ceo_management');
  if (error?.message?.includes('list_ngo_survey_charges_for_ceo_management')) {
    const fallback = await supabase.rpc('list_ngo_surveys_awaiting_ceo_quote');
    if (fallback.error) {
      return { rows: [], error: 'Migration 062/063 requise' };
    }
    const rows = Array.isArray(fallback.data)
      ? (fallback.data as SurveyChargeCeoRow[]).map((r) => ({
          ...r,
          amount_gnf: 0,
          status: 'awaiting_ceo_quote' as const,
          payment_token: null,
          ceo_notes: null,
        }))
      : [];
    return { rows };
  }
  if (error) return { rows: [], error: error.message };
  const rows = Array.isArray(data) ? (data as SurveyChargeCeoRow[]) : [];
  return { rows };
}

export async function platformSetNgoSurveyCharge(
  chargeId: string,
  amountGnf: number,
  ceoNotes?: string,
  options?: { resendEmail?: boolean }
) {
  const session = await getSession();
  if (session?.profile?.role !== 'platform_admin') {
    return { error: 'Non autorisé' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('platform_admin_set_ngo_survey_charge', {
    p_charge_id: chargeId,
    p_amount_gnf: amountGnf,
    p_ceo_notes: ceoNotes?.trim() || null,
  });
  if (error) return { error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.error) return { error: String(row.error) };

  const surveyId = row.survey_id as string;
  const paymentToken = row.payment_token as string;
  const amount = Number(row.amount_gnf ?? 0);
  const isRevision = Boolean(row.is_revision);
  const previousAmountGnf =
    row.previous_amount_gnf != null ? Number(row.previous_amount_gnf) : undefined;
  const shouldSendEmail = options?.resendEmail !== false;

  let emailSent = false;
  let emailWarning: string | undefined;
  if (shouldSendEmail && paymentToken) {
    const emailOutcome = await sendNgoSurveyPaymentEmailByChargeId(chargeId, {
      isRevision,
      previousAmountGnf,
    });
    emailSent = 'success' in emailOutcome && Boolean(emailOutcome.success);
    emailWarning = 'error' in emailOutcome ? emailOutcome.error : undefined;
  }

  revalidatePath('/organisations');
  revalidatePath('/ong/sondages');
  revalidatePath(`/ong/sondages/${surveyId}`);
  return {
    success: true,
    amountGnf: amount,
    paymentToken,
    emailSent,
    emailWarning,
    isRevision,
    previousAmountGnf,
  };
}

export async function getNgoSurveyChargeByToken(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_ngo_survey_charge_by_token', {
    p_token: token,
  });
  if (error) return { charge: null, error: error.message };
  return { charge: data as Record<string, unknown> | null };
}

export async function recordNgoSurveyPayment(chargeId: string, reference?: string) {
  const session = await getSession();
  if (!isOngDirector(session?.profile?.role) && session?.profile?.role !== 'platform_admin') {
    return { error: 'Non autorisé' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_ngo_survey_payment', {
    p_charge_id: chargeId,
    p_reference: reference?.trim() || null,
  });
  if (error) return { error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.error) return { error: String(row.error) };
  revalidatePath('/ong/sondages');
  return { success: true };
}

export async function getNgoSurveyChargeForSurvey(surveyId: string) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data } = await supabase
    .from('ngo_survey_charges')
    .select('id, amount_gnf, status, payment_token, target_responses, breakdown, paid_at, ceo_notes')
    .eq('survey_id', surveyId)
    .eq('organization_id', orgId)
    .maybeSingle();
  return data;
}
