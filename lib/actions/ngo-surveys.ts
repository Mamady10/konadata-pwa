'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { isOngDirector } from '@/lib/ong/ong-access';
import { parseNgoSurveySettings } from '@/lib/ngo/survey-settings';
import {
  buildQcmQuestion,
  parseSurveyQuestions,
  type NgoSurveyQuestion,
} from '@/lib/ngo/survey-questions';
import type { NgoSurveyCollectionMode } from '@/lib/ngo/survey-settings';
import { sendSurveyParticipationLinkEmail } from '@/lib/email/send-survey-participation-link';
import { tryNotifyCeoSurveyQuoteRequest } from '@/lib/actions/ngo-survey-billing';

export type NgoSurveyRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  region: string | null;
  project_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  target_responses: number | null;
  collection_mode: string;
  questions: NgoSurveyQuestion[];
  public_token?: string | null;
  created_at: string;
  response_count?: number;
};

function generatePublicToken(): string {
  return `srv_${randomBytes(12).toString('hex')}`;
}

function parseIsoDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function getOrgSurveySettings(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string) {
  const { data } = await supabase.rpc('ngo_survey_settings', { p_org_id: orgId });
  return parseNgoSurveySettings(data);
}

async function countActiveSurveys(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
) {
  const { count } = await supabase
    .from('ngo_surveys')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .in('status', ['active', 'scheduled']);
  return count ?? 0;
}

export async function listNgoSurveysForUser(orgId: string): Promise<NgoSurveyRow[]> {
  const supabase = await createClient();
  const session = await getSession();
  const role = session?.profile?.role;
  const userId = session?.user?.id;

  let query = supabase
    .from('ngo_surveys')
    .select(
      'id, title, description, status, region, project_id, starts_at, ends_at, target_responses, collection_mode, questions, created_at'
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (!isOngDirector(role) && role === 'ngo_staff' && userId) {
    const { data: assignments } = await supabase
      .from('ngo_survey_agent_assignments')
      .select('survey_id')
      .eq('organization_id', orgId)
      .eq('profile_id', userId);
    const ids = (assignments ?? []).map((a) => a.survey_id as string);
    if (!ids.length) return [];
    query = query.in('id', ids).in('status', ['active', 'scheduled']);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const withCounts = await Promise.all(
    rows.map(async (row) => {
      const { count } = await supabase
        .from('ngo_survey_responses')
        .select('id', { count: 'exact', head: true })
        .eq('survey_id', row.id);
      return {
        ...row,
        questions: parseSurveyQuestions(row.questions),
        response_count: count ?? 0,
      } as NgoSurveyRow;
    })
  );

  return withCounts;
}

export async function getNgoSurveyDetail(surveyId: string) {
  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: survey, error } = await supabase
    .from('ngo_surveys')
    .select(
      'id, title, description, status, region, project_id, starts_at, ends_at, target_responses, collection_mode, assigned_zones, questions, public_token, created_at, ngo_projects(name)'
    )
    .eq('id', surveyId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error) return { survey: null, stats: null, error: error.message };
  if (!survey) return { survey: null, stats: null, error: 'Sondage introuvable' };

  const { data: statsData, error: statsErr } = await supabase.rpc('ngo_survey_stats', {
    p_survey_id: surveyId,
  });

  const { data: responses } = await supabase
    .from('ngo_survey_responses')
    .select('id, locality, created_at, agent_id, answers')
    .eq('survey_id', surveyId)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: agents } = await supabase
    .from('ngo_survey_agent_assignments')
    .select('profile_id, profiles(id, full_name, email)')
    .eq('survey_id', surveyId);

  const { data: staff } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('organization_id', orgId)
    .eq('role', 'ngo_staff')
    .eq('is_active', true);

  const { data: securityAlerts } = await supabase
    .from('ngo_survey_security_alerts')
    .select('id, alert_type, severity, details, created_at, acknowledged_at')
    .eq('survey_id', surveyId)
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: charge } = await supabase
    .from('ngo_survey_charges')
    .select('id, amount_gnf, status, payment_token, target_responses, breakdown, paid_at, ceo_notes')
    .eq('survey_id', surveyId)
    .maybeSingle();

  const project = survey.ngo_projects as { name?: string } | null;

  return {
    survey: {
      ...survey,
      questions: parseSurveyQuestions(survey.questions),
      project_name: project?.name ?? null,
    },
    stats: statsErr ? null : (statsData as Record<string, unknown>),
    responses: responses ?? [],
    assignedAgents: (agents ?? []).map((a) => a.profiles),
    availableStaff: staff ?? [],
    securityAlerts: securityAlerts ?? [],
    charge: charge ?? null,
    error: undefined,
  };
}

export async function createNgoSurvey(formData: FormData) {
  const session = await getSession();
  if (!isOngDirector(session?.profile?.role)) {
    return { error: 'Seuls la direction peut créer un sondage' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { getSurveyOnlyCreateGate } = await import('@/lib/actions/survey-only-org');
  const gate = await getSurveyOnlyCreateGate(orgId);
  if (gate.isSurveyOnly && !gate.canCreate) {
    return { error: gate.message ?? 'Impossible de créer un nouveau sondage pour le moment.' };
  }

  const settings = await getOrgSurveySettings(supabase, orgId);

  if (!settings.enabled) {
    return { error: 'Module sondages désactivé — activez-le dans Paramètres → Sondages ONG' };
  }

  const title = (formData.get('title') as string)?.trim();
  if (!title) return { error: 'Le titre est requis' };

  const status = (formData.get('status') as string) || 'draft';
  if (['active', 'scheduled'].includes(status)) {
    const activeCount = await countActiveSurveys(supabase, orgId);
    if (activeCount >= settings.max_active_surveys) {
      return {
        error: `Limite atteinte (${settings.max_active_surveys} sondages actifs/programmés). Clôturez un sondage ou augmentez la limite dans Paramètres.`,
      };
    }
  }

  const questionText = (formData.get('question') as string)?.trim();
  const opt1 = (formData.get('option_1') as string)?.trim();
  const opt2 = (formData.get('option_2') as string)?.trim();
  const opt3 = (formData.get('option_3') as string)?.trim();

  if (!questionText) return { error: 'La question est requise' };
  if (!opt1 || !opt2 || !opt3) {
    return { error: 'Les 3 réponses attendues (options QCM) sont requises' };
  }

  const uniqueOpts = new Set([opt1, opt2, opt3]);
  if (uniqueOpts.size < 3) {
    return { error: 'Les 3 options doivent être distinctes' };
  }

  let questions: NgoSurveyQuestion[] = buildQcmQuestion(questionText, [opt1, opt2, opt3]);
  const questionsJson = formData.get('questions_json') as string;
  if (questionsJson) {
    try {
      const parsed = parseSurveyQuestions(JSON.parse(questionsJson));
      if (parsed.length) questions = parsed;
    } catch {
      // keep QCM from form fields
    }
  }

  const projectId = (formData.get('project_id') as string)?.trim() || null;
  const targetRaw = formData.get('target_responses') as string;
  const target = targetRaw ? Math.max(1, parseInt(targetRaw, 10)) : null;

  if (settings.require_survey_payment && !target) {
    return {
      error:
        'Indiquez l\'objectif de réponses (personnes cibles) pour calculer le coût de la campagne',
    };
  }

  const initialStatus =
    settings.require_survey_payment && ['active', 'scheduled'].includes(status)
      ? 'draft'
      : status;

  const { data: inserted, error } = await supabase
    .from('ngo_surveys')
    .insert({
      organization_id: orgId,
      title,
      region: (formData.get('region') as string)?.trim() || settings.default_region,
      description: (formData.get('description') as string)?.trim() || null,
      status: initialStatus,
      project_id: projectId || null,
      starts_at: parseIsoDate(formData.get('starts_at') as string),
      ends_at: parseIsoDate(formData.get('ends_at') as string),
      target_responses: Number.isFinite(target as number) ? target : null,
      collection_mode: ((formData.get('collection_mode') as NgoSurveyCollectionMode) ||
        'mixed') as NgoSurveyCollectionMode,
      questions,
      public_token: generatePublicToken(),
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  const surveyId = inserted.id as string;
  let awaitingCeoQuote = false;
  let ceoNotified = false;
  let ceoNotifyWarning: string | undefined;

  if (settings.require_survey_payment) {
    const { data: chargeData, error: chargeErr } = await supabase.rpc('create_ngo_survey_charge', {
      p_survey_id: surveyId,
    });
    if (chargeErr?.message?.includes('create_ngo_survey_charge')) {
      return { error: 'Migration 061/062 requise pour la facturation des sondages' };
    }
    if (chargeErr) return { error: chargeErr.message };
    const charge = (chargeData ?? {}) as Record<string, unknown>;
    if (!charge.skipped) {
      awaitingCeoQuote = Boolean(charge.awaiting_ceo) || charge.status === 'awaiting_ceo_quote';
      const notifyOutcome = await tryNotifyCeoSurveyQuoteRequest({
        orgId,
        surveyId,
        chargeId: String(charge.charge_id),
        surveyTitle: title,
        surveyDescription: (formData.get('description') as string)?.trim() || null,
        surveyRegion: (formData.get('region') as string)?.trim() || settings.default_region,
        targetResponses: target ?? 1,
        collectionMode: (formData.get('collection_mode') as string) || 'mixed',
        questions,
        directorName: session?.profile?.full_name ?? null,
        directorEmail:
          (session?.profile?.email as string | undefined) ??
          (session?.user?.email as string | undefined) ??
          null,
      });
      ceoNotified = notifyOutcome.ceoNotified ?? false;
      ceoNotifyWarning = notifyOutcome.ceoNotifyWarning;
    }
  }

  revalidatePath('/ong/sondages');
  revalidatePath('/ong');
  revalidatePath('/organisations');
  return {
    success: true,
    surveyId,
    awaitingCeoQuote,
    ceoNotified,
    ceoNotifyWarning,
  };
}

export async function updateNgoSurveyStatus(id: string, status: string) {
  const session = await getSession();
  if (!isOngDirector(session?.profile?.role)) {
    return { error: 'Non autorisé' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  if (['active', 'scheduled'].includes(status)) {
    await supabase.rpc('process_expired_ngo_survey_campaigns', { p_org_id: orgId });

    const settings = await getOrgSurveySettings(supabase, orgId);
    const activeCount = await countActiveSurveys(supabase, orgId);
    const { data: current } = await supabase
      .from('ngo_surveys')
      .select('status')
      .eq('id', id)
      .maybeSingle();
    const alreadyActive = ['active', 'scheduled'].includes(current?.status ?? '');
    if (!alreadyActive && activeCount >= settings.max_active_surveys) {
      return { error: `Limite de ${settings.max_active_surveys} sondages actifs/programmés atteinte` };
    }

    if (settings.require_survey_payment) {
      const { data: paidOk, error: payErr } = await supabase.rpc('ngo_survey_payment_ok', {
        p_survey_id: id,
      });
      if (payErr?.message?.includes('ngo_survey_payment_ok')) {
        return { error: 'Migration 061 requise pour vérifier le paiement campagne' };
      }
      if (!paidOk) {
        const { data: ch } = await supabase
          .from('ngo_survey_charges')
          .select('status')
          .eq('survey_id', id)
          .maybeSingle();
        if (ch?.status === 'awaiting_ceo_quote') {
          return {
            error:
              'Tarif en attente de validation par KonaData — vous serez notifié par email pour le paiement',
          };
        }
        return {
          error:
            'Paiement campagne requis avant activation — réglez la facture du sondage (hors abonnement)',
        };
      }

      const { data: campaignOk, error: campErr } = await supabase.rpc(
        'ngo_survey_campaign_access_ok',
        { p_survey_id: id }
      );
      if (!campErr?.message?.includes('ngo_survey_campaign_access_ok') && campaignOk === false) {
        const { data: ch } = await supabase
          .from('ngo_survey_charges')
          .select('status, campaign_ends_at')
          .eq('survey_id', id)
          .maybeSingle();
        if (
          ch?.status === 'expired' ||
          (ch?.campaign_ends_at && new Date(ch.campaign_ends_at as string) <= new Date())
        ) {
          return {
            error:
              'Cette campagne sondage est terminée. Créez et payez une nouvelle campagne.',
          };
        }
      }
    }
  }

  const { error } = await supabase
    .from('ngo_surveys')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) return { error: error.message };
  revalidatePath('/ong/sondages');
  revalidatePath(`/ong/sondages/${id}`);
  return { success: true };
}

export async function setNgoSurveyAgents(surveyId: string, profileIds: string[]) {
  const session = await getSession();
  if (!isOngDirector(session?.profile?.role)) {
    return { error: 'Non autorisé' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  await supabase
    .from('ngo_survey_agent_assignments')
    .delete()
    .eq('survey_id', surveyId)
    .eq('organization_id', orgId);

  if (profileIds.length) {
    const rows = profileIds.map((profileId) => ({
      organization_id: orgId,
      survey_id: surveyId,
      profile_id: profileId,
    }));
    const { error } = await supabase.from('ngo_survey_agent_assignments').insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath(`/ong/sondages/${surveyId}`);
  return { success: true };
}

export async function submitNgoSurveyResponse(
  surveyId: string,
  answers: Record<string, unknown>,
  meta?: { locality?: string; latitude?: number; longitude?: number; respondentId?: string }
) {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const session = await getSession();

  const { data: allowed, error: allowErr } = await supabase.rpc('ngo_user_can_collect_survey', {
    p_survey_id: surveyId,
  });

  if (allowErr?.message?.includes('ngo_user_can_collect_survey')) {
    return { error: 'Migration 058 requise pour la collecte terrain' };
  }
  if (!allowed) {
    return { error: 'Collecte non autorisée (sondage inactif, hors dates ou agent non assigné)' };
  }

  const settings = await getOrgSurveySettings(supabase, orgId);
  if (settings.require_gps && (meta?.latitude == null || meta?.longitude == null)) {
    return { error: 'La position GPS est requise pour ce sondage (Paramètres ONG)' };
  }

  const { data: survey } = await supabase
    .from('ngo_surveys')
    .select('target_responses, status')
    .eq('id', surveyId)
    .eq('organization_id', orgId)
    .maybeSingle();

  const { error } = await supabase.from('ngo_survey_responses').insert({
    organization_id: orgId,
    survey_id: surveyId,
    agent_id: session?.user?.id ?? null,
    respondent_id: meta?.respondentId ?? null,
    answers,
    locality: meta?.locality?.trim() || null,
    latitude: meta?.latitude ?? null,
    longitude: meta?.longitude ?? null,
    is_offline: false,
    synced_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  if (
    settings.auto_close_when_target_reached &&
    survey?.target_responses &&
    survey.status === 'active'
  ) {
    const { count } = await supabase
      .from('ngo_survey_responses')
      .select('id', { count: 'exact', head: true })
      .eq('survey_id', surveyId);
    if ((count ?? 0) >= survey.target_responses) {
      await supabase
        .from('ngo_surveys')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', surveyId);
    }
  }

  revalidatePath(`/ong/sondages/${surveyId}`);
  revalidatePath('/ong/sondages');
  return { success: true };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendNgoSurveyParticipationLink(
  surveyId: string,
  recipientRaw: string,
  customMessage?: string
) {
  const session = await getSession();
  if (!isOngDirector(session?.profile?.role)) {
    return { error: 'Seuls la direction peut envoyer le lien de participation' };
  }

  const orgId = await requireOrgId();
  const supabase = await createClient();

  const { data: survey, error: surveyErr } = await supabase
    .from('ngo_surveys')
    .select('id, title, description, public_token, collection_mode, questions')
    .eq('id', surveyId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (surveyErr) return { error: surveyErr.message };
  if (!survey) return { error: 'Sondage introuvable' };
  if (!survey.public_token) {
    return { error: 'Token public manquant — exécutez la migration 059' };
  }
  if (survey.collection_mode === 'field_agent') {
    return {
      error: 'Participation en ligne désactivée — choisissez le mode Mixte ou Auto-déclaration',
    };
  }

  const emails = recipientRaw
    .split(/[,;]\s*/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!emails.length) return { error: 'Indiquez au moins une adresse email' };

  const invalid = emails.find((e) => !EMAIL_RE.test(e));
  if (invalid) return { error: `Adresse invalide : ${invalid}` };

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle();

  const questions = parseSurveyQuestions(survey.questions);
  const firstQuestion = questions[0];

  const emailResult = await sendSurveyParticipationLinkEmail({
    to: emails.length === 1 ? emails[0] : emails,
    orgName: (org?.name as string) ?? 'ONG',
    surveyTitle: survey.title as string,
    surveyDescription: (survey.description as string) ?? null,
    questionText: firstQuestion?.text ?? null,
    options: firstQuestion?.options,
    publicToken: survey.public_token as string,
    directorName: session?.profile?.full_name ?? null,
    customMessage: customMessage?.trim() || null,
  });

  if (!emailResult.ok) {
    return { error: emailResult.error ?? 'Échec de l\'envoi email' };
  }

  return { success: true, sent: emails.length };
}

/** @deprecated use listNgoSurveysForUser */
export async function getNgoSurveys(orgId: string) {
  return listNgoSurveysForUser(orgId);
}
