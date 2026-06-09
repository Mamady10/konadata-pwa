'use server';

import { createClient } from '@/lib/supabase/server';
import { isSurveyOnlyOrg } from '@/lib/org/survey-only-access';

export type SurveyOnlyCreateGate = {
  isSurveyOnly: boolean;
  canCreate: boolean;
  message?: string;
  reason?: string;
};

export async function getSurveyOnlyCreateGate(orgId: string): Promise<SurveyOnlyCreateGate> {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle();

  if (!isSurveyOnlyOrg(org?.settings)) {
    return { isSurveyOnly: false, canCreate: true };
  }

  await supabase.rpc('process_expired_ngo_survey_campaigns', { p_org_id: orgId });

  const { data, error } = await supabase.rpc('survey_only_can_create_survey', {
    p_org_id: orgId,
  });

  if (error?.message?.includes('survey_only_can_create_survey')) {
    return {
      isSurveyOnly: true,
      canCreate: true,
      message: 'Migration 066 requise pour les règles campagne.',
    };
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    isSurveyOnly: true,
    canCreate: Boolean(row.allowed),
    message: row.message as string | undefined,
    reason: row.reason as string | undefined,
  };
}

export async function markSurveyFinalReport(surveyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('mark_ngo_survey_final_report', {
    p_survey_id: surveyId,
  });
  if (error) return { error: error.message };
  const row = (data ?? {}) as Record<string, unknown>;
  if (row.error) return { error: String(row.error) };
  return {
    success: true,
    campaignEndsAt: row.campaign_ends_at as string | undefined,
    alreadyMarked: Boolean(row.already_marked),
  };
}
