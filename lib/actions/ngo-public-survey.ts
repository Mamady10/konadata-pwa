'use server';

import { createClient } from '@/lib/supabase/server';
import { parseSurveyQuestions } from '@/lib/ngo/survey-questions';

export type PublicSurveySecurity = {
  requirePhoneOtp: boolean;
  otpChannel: 'sms' | 'whatsapp';
  onePerDevice: boolean;
  deviceLockDays: number;
};

export type PublicNgoSurvey = {
  id: string;
  title: string;
  description: string | null;
  region: string | null;
  organizationName: string;
  questions: ReturnType<typeof parseSurveyQuestions>;
  security: PublicSurveySecurity;
};

const ERROR_MESSAGES: Record<string, string> = {
  module_disabled: 'Les sondages ne sont pas disponibles pour cette organisation.',
  not_open: 'Ce sondage n\'est pas ouvert aux participants.',
  not_started: 'Ce sondage n\'a pas encore commencé.',
  ended: 'Ce sondage est terminé.',
  field_agent_only: 'Ce sondage est réservé à la collecte terrain (pas de participation en ligne).',
};

export async function getNgoSurveyByPublicToken(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_ngo_survey_by_public_token', {
    p_token: token,
  });

  if (error?.message?.includes('get_ngo_survey_by_public_token')) {
    return { survey: null, error: 'Migration 059 requise pour la participation en ligne' };
  }
  if (error) return { survey: null, error: error.message };
  if (!data || typeof data !== 'object') {
    return { survey: null, error: 'Lien de participation invalide' };
  }

  const row = data as Record<string, unknown>;
  const errKey = row.error as string | undefined;
  if (errKey) {
    return { survey: null, error: ERROR_MESSAGES[errKey] ?? 'Sondage indisponible' };
  }

  const sec = (row.security ?? {}) as Record<string, unknown>;

  return {
    survey: {
      id: String(row.id),
      title: String(row.title ?? ''),
      description: (row.description as string) ?? null,
      region: (row.region as string) ?? null,
      organizationName: String(row.organization_name ?? 'ONG'),
      questions: parseSurveyQuestions(row.questions),
      security: {
        requirePhoneOtp: sec.require_phone_otp !== false,
        otpChannel: sec.otp_channel === 'whatsapp' ? 'whatsapp' : 'sms',
        onePerDevice: sec.one_per_device !== false,
        deviceLockDays: Number(sec.device_lock_days ?? 30),
      },
    } satisfies PublicNgoSurvey,
    error: undefined,
  };
}
