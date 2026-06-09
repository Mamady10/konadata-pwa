import type { NgoSurveySettings } from '@/lib/ngo/survey-settings';

export interface SurveyFeeBreakdown {
  targetCount: number;
  baseFeeGnf: number;
  perTargetGnf: number;
  participantLineGnf: number;
  amountGnf: number;
  requirePayment: boolean;
}

export type SurveyBillingSettings = Pick<
  NgoSurveySettings,
  | 'survey_base_fee_gnf'
  | 'survey_per_target_gnf'
  | 'survey_min_billable_targets'
  | 'survey_min_fee_gnf'
  | 'survey_max_fee_gnf'
  | 'require_survey_payment'
>;

export function computeSurveyFee(
  settings: SurveyBillingSettings,
  targetResponses: number | null | undefined
): SurveyFeeBreakdown {
  const targetCount = Math.max(
    settings.survey_min_billable_targets,
    targetResponses ?? settings.survey_min_billable_targets
  );
  const participantLineGnf = targetCount * settings.survey_per_target_gnf;
  const raw = settings.survey_base_fee_gnf + participantLineGnf;
  const amountGnf = Math.min(
    settings.survey_max_fee_gnf,
    Math.max(settings.survey_min_fee_gnf, raw)
  );

  return {
    targetCount,
    baseFeeGnf: settings.survey_base_fee_gnf,
    perTargetGnf: settings.survey_per_target_gnf,
    participantLineGnf,
    amountGnf,
    requirePayment: settings.require_survey_payment,
  };
}

export const SURVEY_CHARGE_STATUS_LABELS: Record<string, string> = {
  awaiting_ceo_quote: 'En attente tarif KonaData',
  awaiting_payment: 'Paiement en attente',
  pending_payment: 'Paiement en attente',
  paid: 'Payé',
  waived: 'Exonéré',
  cancelled: 'Annulé',
  expired: 'Campagne terminée',
};

export type SurveyChargeCeoRow = {
  charge_id: string;
  survey_id: string;
  organization_id: string;
  organization_name: string;
  survey_title: string;
  survey_description: string | null;
  survey_region: string | null;
  target_responses: number;
  amount_gnf: number;
  status: 'awaiting_ceo_quote' | 'awaiting_payment' | string;
  payment_token: string | null;
  ceo_notes: string | null;
  collection_mode: string;
  submitted_at: string;
  updated_at?: string;
};

/** @deprecated alias */
export type SurveyChargeAwaitingCeoRow = SurveyChargeCeoRow;
