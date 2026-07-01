'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOrgId } from '@/lib/actions/org';
import { getSession } from '@/lib/actions/auth';
import {
  parseNgoSurveySettings,
  type NgoSurveySettings,
} from '@/lib/ngo/survey-settings';

function canManageNgoSurveySettings(role: string | undefined): boolean {
  return role === 'org_admin' || role === 'platform_admin' || role === 'deputy_director';
}

export async function getNgoSurveySettings(): Promise<{
  settings: NgoSurveySettings;
  error?: string;
}> {
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('ngo_survey_settings', { p_org_id: orgId });
  if (error?.message?.includes('ngo_survey_settings')) {
    return {
      settings: parseNgoSurveySettings(null),
      error: 'Migration 058 requise — exécutez supabase/sql-editor/058-F-ngo-surveys-ONLY.sql',
    };
  }
  if (error) return { settings: parseNgoSurveySettings(null), error: error.message };
  return { settings: parseNgoSurveySettings(data) };
}

export async function updateNgoSurveySettings(settings: NgoSurveySettings) {
  const session = await getSession();
  if (!canManageNgoSurveySettings(session?.profile?.role)) {
    return { error: 'Non autorisé' };
  }
  const orgId = await requireOrgId();
  const supabase = await createClient();
  const { settings: current } = await getNgoSurveySettings();
  const isPlatform = session?.profile?.role === 'platform_admin';
  const payload: NgoSurveySettings = { ...settings };
  if (!isPlatform) {
    payload.enabled = current.enabled;
    payload.require_survey_payment = current.require_survey_payment;
  }
  const { error } = await supabase.rpc('update_ngo_survey_settings', {
    p_org_id: orgId,
    p_settings: payload,
  });
  if (error) return { error: error.message };
  revalidatePath('/parametres/sondages-ong');
  revalidatePath('/ong/sondages');
  return { success: true };
}
