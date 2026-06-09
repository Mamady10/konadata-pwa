export type NgoSurveyCollectionMode = 'field_agent' | 'self_service' | 'mixed';

export type NgoSurveyOtpChannel = 'sms' | 'whatsapp';

export interface NgoSurveySettings {
  enabled: boolean;
  require_gps: boolean;
  allow_offline_collection: boolean;
  default_region: string | null;
  max_active_surveys: number;
  auto_close_when_target_reached: boolean;
  one_per_device: boolean;
  device_lock_days: number;
  require_phone_otp: boolean;
  otp_channel: NgoSurveyOtpChannel;
  rate_limit_otp_per_ip_hour: number;
  rate_limit_submit_per_ip_hour: number;
  anomaly_responses_per_minute: number;
  anomaly_same_choice_zone_count: number;
  anomaly_same_choice_zone_minutes: number;
  /** Frais fixe par campagne de sondage (hors abonnement). */
  survey_base_fee_gnf: number;
  /** Coût par personne cible (objectif de réponses). */
  survey_per_target_gnf: number;
  survey_min_billable_targets: number;
  survey_min_fee_gnf: number;
  survey_max_fee_gnf: number;
  require_survey_payment: boolean;
}

export const DEFAULT_NGO_SURVEY_SETTINGS: NgoSurveySettings = {
  enabled: true,
  require_gps: true,
  allow_offline_collection: true,
  default_region: null,
  max_active_surveys: 5,
  auto_close_when_target_reached: false,
  one_per_device: true,
  device_lock_days: 30,
  require_phone_otp: true,
  otp_channel: 'sms',
  rate_limit_otp_per_ip_hour: 5,
  rate_limit_submit_per_ip_hour: 30,
  anomaly_responses_per_minute: 20,
  anomaly_same_choice_zone_count: 15,
  anomaly_same_choice_zone_minutes: 5,
  survey_base_fee_gnf: 25_000,
  survey_per_target_gnf: 100,
  survey_min_billable_targets: 50,
  survey_min_fee_gnf: 25_000,
  survey_max_fee_gnf: 5_000_000,
  require_survey_payment: true,
};

export const COLLECTION_MODE_LABELS: Record<NgoSurveyCollectionMode, string> = {
  field_agent: 'Agents terrain',
  self_service: 'Auto-déclaration',
  mixed: 'Mixte',
};

export function parseNgoSurveySettings(raw: unknown): NgoSurveySettings {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    enabled: o.enabled !== false,
    require_gps: o.require_gps !== false,
    allow_offline_collection: o.allow_offline_collection !== false,
    default_region:
      typeof o.default_region === 'string' && o.default_region.trim()
        ? o.default_region.trim()
        : null,
    max_active_surveys: Math.min(
      50,
      Math.max(1, Number(o.max_active_surveys ?? DEFAULT_NGO_SURVEY_SETTINGS.max_active_surveys))
    ),
    auto_close_when_target_reached: Boolean(o.auto_close_when_target_reached),
    one_per_device: o.one_per_device !== false,
    device_lock_days: Math.min(365, Math.max(1, Number(o.device_lock_days ?? 30))),
    require_phone_otp: o.require_phone_otp !== false,
    otp_channel: o.otp_channel === 'whatsapp' ? 'whatsapp' : 'sms',
    rate_limit_otp_per_ip_hour: Math.min(100, Math.max(1, Number(o.rate_limit_otp_per_ip_hour ?? 5))),
    rate_limit_submit_per_ip_hour: Math.min(
      500,
      Math.max(1, Number(o.rate_limit_submit_per_ip_hour ?? 30))
    ),
    anomaly_responses_per_minute: Math.min(
      500,
      Math.max(5, Number(o.anomaly_responses_per_minute ?? 20))
    ),
    anomaly_same_choice_zone_count: Math.min(
      200,
      Math.max(3, Number(o.anomaly_same_choice_zone_count ?? 15))
    ),
    anomaly_same_choice_zone_minutes: Math.min(
      60,
      Math.max(1, Number(o.anomaly_same_choice_zone_minutes ?? 5))
    ),
    survey_base_fee_gnf: Math.max(0, Number(o.survey_base_fee_gnf ?? 25_000)),
    survey_per_target_gnf: Math.max(0, Number(o.survey_per_target_gnf ?? 100)),
    survey_min_billable_targets: Math.min(
      100_000,
      Math.max(1, Number(o.survey_min_billable_targets ?? 50))
    ),
    survey_min_fee_gnf: Math.max(0, Number(o.survey_min_fee_gnf ?? 25_000)),
    survey_max_fee_gnf: Math.min(
      50_000_000,
      Math.max(0, Number(o.survey_max_fee_gnf ?? 5_000_000))
    ),
    require_survey_payment: o.require_survey_payment !== false,
  };
}
