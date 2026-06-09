'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import { isOngDirector } from '@/lib/ong/ong-access';

export type SurveyAnalyticsPayload = {
  surveyId: string;
  title: string;
  status: string;
  region: string | null;
  collectionMode: string;
  startsAt: string | null;
  endsAt: string | null;
  stats: {
    responseCount: number;
    totalRaw: number;
    excludedCount: number;
    targetResponses: number | null;
    progressPct: number | null;
    byRegion: { label: string; count: number }[];
    byChoice: { label: string; count: number }[];
    questionId: string;
  };
  byDay: { day: string; count: number }[];
  crossTab: { choice: string; locality: string; count: number }[];
  mapPoints: {
    id: string;
    lat: number;
    lng: number;
    locality: string;
    choice: string;
    createdAt: string;
  }[];
  quality: {
    withGps: number;
    withLocality: number;
    excluded: number;
    valid: number;
    total: number;
    alerts: number;
    duplicateGroups: number;
  };
  responses: {
    id: string;
    locality: string;
    answer: string;
    createdAt: string;
    isExcluded: boolean;
    exclusionReason: string | null;
    hasGps: boolean;
    hasPhoneLock: boolean;
    hasDeviceLock: boolean;
  }[];
  duplicateGroups: {
    matchType: string;
    members: { id: string; createdAt: string; locality: string | null }[];
  }[];
};

function mapAnalytics(data: Record<string, unknown>): SurveyAnalyticsPayload {
  const stats = (data.stats ?? {}) as Record<string, unknown>;
  const quality = (data.quality ?? {}) as Record<string, unknown>;

  return {
    surveyId: String(data.survey_id ?? ''),
    title: String(data.title ?? ''),
    status: String(data.status ?? ''),
    region: (data.region as string) ?? null,
    collectionMode: String(data.collection_mode ?? ''),
    startsAt: (data.starts_at as string) ?? null,
    endsAt: (data.ends_at as string) ?? null,
    stats: {
      responseCount: Number(stats.response_count ?? 0),
      totalRaw: Number(stats.total_raw ?? stats.response_count ?? 0),
      excludedCount: Number(stats.excluded_count ?? 0),
      targetResponses:
        stats.target_responses != null ? Number(stats.target_responses) : null,
      progressPct: stats.progress_pct != null ? Number(stats.progress_pct) : null,
      byRegion: Array.isArray(stats.by_region)
        ? (stats.by_region as { label: string; count: number }[])
        : [],
      byChoice: Array.isArray(stats.by_choice)
        ? (stats.by_choice as { label: string; count: number }[])
        : [],
      questionId: String(stats.question_id ?? 'q1'),
    },
    byDay: Array.isArray(data.by_day)
      ? (data.by_day as { day: string; count: number }[])
      : [],
    crossTab: Array.isArray(data.cross_tab)
      ? (data.cross_tab as { choice: string; locality: string; count: number }[])
      : [],
    mapPoints: Array.isArray(data.map_points)
      ? (data.map_points as SurveyAnalyticsPayload['mapPoints'])
      : [],
    quality: {
      withGps: Number(quality.with_gps ?? 0),
      withLocality: Number(quality.with_locality ?? 0),
      excluded: Number(quality.excluded ?? 0),
      valid: Number(quality.valid ?? 0),
      total: Number(quality.total ?? 0),
      alerts: Number(quality.alerts ?? 0),
      duplicateGroups: Number(quality.duplicate_groups ?? 0),
    },
    responses: Array.isArray(data.responses)
      ? (data.responses as Record<string, unknown>[]).map((r) => ({
          id: String(r.id),
          locality: String(r.locality ?? '—'),
          answer: String(r.answer ?? '—'),
          createdAt: String(r.created_at ?? ''),
          isExcluded: Boolean(r.is_excluded),
          exclusionReason: (r.exclusion_reason as string) ?? null,
          hasGps: Boolean(r.has_gps),
          hasPhoneLock: Boolean(r.has_phone_lock),
          hasDeviceLock: Boolean(r.has_device_lock),
        }))
      : [],
    duplicateGroups: Array.isArray(data.duplicate_groups)
      ? (data.duplicate_groups as Record<string, unknown>[]).map((g) => ({
          matchType: String(g.match_type ?? ''),
          members: Array.isArray(g.members)
            ? (g.members as Record<string, unknown>[]).map((m) => ({
                id: String(m.id),
                createdAt: String(m.created_at ?? ''),
                locality: (m.locality as string) ?? null,
              }))
            : [],
        }))
      : [],
  };
}

export async function getNgoSurveyAnalytics(surveyId: string): Promise<{
  analytics: SurveyAnalyticsPayload | null;
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { analytics: null, error: 'Non connecté' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('ngo_survey_analytics', {
    p_survey_id: surveyId,
  });

  if (error?.message?.includes('ngo_survey_analytics')) {
    return { analytics: null, error: 'Migration 064 requise pour les analytiques sondage' };
  }
  if (error) return { analytics: null, error: error.message };

  const row = (data ?? {}) as Record<string, unknown>;
  if (row.error) return { analytics: null, error: String(row.error) };

  return { analytics: mapAnalytics(row) };
}

async function requireSurveyDirector() {
  const session = await getSession();
  if (!isOngDirector(session?.profile?.role)) {
    return { error: 'Réservé à la direction ONG' };
  }
  return { ok: true as const };
}

export async function excludeSurveyResponse(responseId: string, reason?: string) {
  const guard = await requireSurveyDirector();
  if ('error' in guard) return guard;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('exclude_ngo_survey_response', {
    p_response_id: responseId,
    p_reason: reason?.trim() || null,
  });
  if (error) return { error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.error) return { error: String(row.error) };

  revalidatePath('/ong/sondages');
  revalidatePath('/ong/sondages', 'layout');
  return { success: true };
}

export async function restoreSurveyResponse(responseId: string) {
  const guard = await requireSurveyDirector();
  if ('error' in guard) return guard;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('restore_ngo_survey_response', {
    p_response_id: responseId,
  });
  if (error) return { error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.error) return { error: String(row.error) };

  revalidatePath('/ong/sondages');
  return { success: true };
}

export async function autoCleanSurveyDuplicates(surveyId: string) {
  const guard = await requireSurveyDirector();
  if ('error' in guard) return guard;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('ngo_survey_auto_clean_duplicates', {
    p_survey_id: surveyId,
  });
  if (error?.message?.includes('ngo_survey_auto_clean')) {
    return { error: 'Migration 064 requise' };
  }
  if (error) return { error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.error) return { error: String(row.error) };

  revalidatePath(`/ong/sondages/${surveyId}/analytiques`);
  revalidatePath(`/ong/sondages/${surveyId}`);
  return { success: true, excludedCount: Number(row.excluded_count ?? 0) };
}

export async function generateNgoSurveyAiReport(surveyId: string) {
  const guard = await requireSurveyDirector();
  if ('error' in guard) return guard;

  const { gatherNgoSurveyReport } = await import('@/lib/ai/reports/gather-ngo-survey');
  const { finalizeNgoSurveyReport } = await import('@/lib/ai/reports/finalize-ngo-survey-report');
  const { saveAiGeneratedReport } = await import('@/lib/actions/ai-report-archive');

  try {
    const orgId = await requireOrgId();
    const gathered = await gatherNgoSurveyReport(orgId, surveyId);
    const finalized = await finalizeNgoSurveyReport({
      orgId,
      title: gathered.title,
      subtitle: gathered.subtitle,
      contextText: gathered.contextText,
      offlineSections: gathered.sections,
      scopeLabel: gathered.scopeLabel,
    });

    const saved = await saveAiGeneratedReport({
      sector: 'ngo',
      scopeId: surveyId,
      scopeLabel: gathered.scopeLabel,
      reportType: 'survey',
      reportTypeLabel: finalized.templateUsed
        ? 'Rapport sondage (modèle org.)'
        : 'Rapport sondage',
      title: finalized.title,
      subtitle: finalized.subtitle,
      content: finalized.report,
      usedLlm: finalized.usedLlm,
    });
    if ('error' in saved) return { error: saved.error };

    const { markSurveyFinalReport } = await import('@/lib/actions/survey-only-org');
    const lifecycle = await markSurveyFinalReport(surveyId);

    revalidatePath(`/ong/sondages/${surveyId}/analytiques`);
    revalidatePath(`/ong/sondages/${surveyId}`);
    revalidatePath('/ong/sondages');
    return {
      report: finalized.report,
      usedLlm: finalized.usedLlm,
      templateUsed: finalized.templateUsed,
      templateFileName: finalized.templateFileName,
      title: finalized.title,
      archiveId: saved.id,
      campaignEndsAt:
        'campaignEndsAt' in lifecycle ? lifecycle.campaignEndsAt : undefined,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur génération rapport' };
  }
}

export async function askNgoSurveyAi(surveyId: string, question: string) {
  const guard = await requireSurveyDirector();
  if ('error' in guard) return guard;

  const q = question.trim();
  if (!q || q.length > 2000) return { error: 'Question invalide (max 2000 caractères)' };

  const { gatherNgoSurveyChatContext } = await import('@/lib/ai/reports/gather-ngo-survey');
  const { hasActiveLlmApi, queryKonaAI } = await import('@/lib/integrations/openai');

  try {
    const orgId = await requireOrgId();
    const context = await gatherNgoSurveyChatContext(orgId, surveyId);

    if (!hasActiveLlmApi()) {
      return {
        content:
          'KonaAI est indisponible (clé OpenAI ou quota). Consultez les graphiques et tableaux ci-dessus pour les faits bruts.',
        usedLlm: false,
      };
    }

    const content = await queryKonaAI(
      `Question du directeur sur ce sondage : ${q}\n\nRépondez en français, citez les chiffres du contexte, n'inventez rien. Proposez une lecture territoriale si pertinent.`,
      context,
      { organizationId: orgId, operation: 'chat' }
    );

    return { content, usedLlm: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur KonaAI' };
  }
}
