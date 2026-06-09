-- ============================================================
-- ONG — Facturation campagne sondage (hors abonnement plateforme)
-- Tarif : frais de base + (personnes cibles × tarif unitaire)
-- ============================================================

CREATE TABLE IF NOT EXISTS ngo_survey_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id UUID NOT NULL REFERENCES ngo_surveys(id) ON DELETE CASCADE,
  target_responses INTEGER NOT NULL,
  amount_gnf NUMERIC(14,0) NOT NULL,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'waived', 'cancelled')),
  payment_token TEXT UNIQUE,
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (survey_id)
);

CREATE INDEX IF NOT EXISTS idx_ngo_survey_charges_org
  ON ngo_survey_charges(organization_id);
CREATE INDEX IF NOT EXISTS idx_ngo_survey_charges_token
  ON ngo_survey_charges(payment_token) WHERE payment_token IS NOT NULL;

ALTER TABLE ngo_survey_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ngo_survey_charges_read ON ngo_survey_charges;
CREATE POLICY ngo_survey_charges_read ON ngo_survey_charges
  FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

-- ─── Paramètres tarification sondage ─────────────────────────

CREATE OR REPLACE FUNCTION ngo_survey_settings(p_org_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'enabled', COALESCE((o.settings->'ngo_surveys'->>'enabled')::BOOLEAN, true),
    'require_gps', COALESCE((o.settings->'ngo_surveys'->>'require_gps')::BOOLEAN, true),
    'allow_offline_collection', COALESCE((o.settings->'ngo_surveys'->>'allow_offline_collection')::BOOLEAN, true),
    'default_region', NULLIF(trim(o.settings->'ngo_surveys'->>'default_region'), ''),
    'max_active_surveys', GREATEST(1, LEAST(50, COALESCE((o.settings->'ngo_surveys'->>'max_active_surveys')::INTEGER, 5))),
    'auto_close_when_target_reached', COALESCE((o.settings->'ngo_surveys'->>'auto_close_when_target_reached')::BOOLEAN, false),
    'one_per_device', COALESCE((o.settings->'ngo_surveys'->>'one_per_device')::BOOLEAN, true),
    'device_lock_days', GREATEST(1, LEAST(365, COALESCE((o.settings->'ngo_surveys'->>'device_lock_days')::INTEGER, 30))),
    'require_phone_otp', COALESCE((o.settings->'ngo_surveys'->>'require_phone_otp')::BOOLEAN, true),
    'otp_channel', CASE
      WHEN lower(COALESCE(o.settings->'ngo_surveys'->>'otp_channel', 'sms')) = 'whatsapp' THEN 'whatsapp'
      ELSE 'sms'
    END,
    'rate_limit_otp_per_ip_hour', GREATEST(1, LEAST(100, COALESCE((o.settings->'ngo_surveys'->>'rate_limit_otp_per_ip_hour')::INTEGER, 5))),
    'rate_limit_submit_per_ip_hour', GREATEST(1, LEAST(500, COALESCE((o.settings->'ngo_surveys'->>'rate_limit_submit_per_ip_hour')::INTEGER, 30))),
    'anomaly_responses_per_minute', GREATEST(5, LEAST(500, COALESCE((o.settings->'ngo_surveys'->>'anomaly_responses_per_minute')::INTEGER, 20))),
    'anomaly_same_choice_zone_count', GREATEST(3, LEAST(200, COALESCE((o.settings->'ngo_surveys'->>'anomaly_same_choice_zone_count')::INTEGER, 15))),
    'anomaly_same_choice_zone_minutes', GREATEST(1, LEAST(60, COALESCE((o.settings->'ngo_surveys'->>'anomaly_same_choice_zone_minutes')::INTEGER, 5))),
    'survey_base_fee_gnf', GREATEST(0, COALESCE((o.settings->'ngo_surveys'->>'survey_base_fee_gnf')::NUMERIC, 25000)),
    'survey_per_target_gnf', GREATEST(0, COALESCE((o.settings->'ngo_surveys'->>'survey_per_target_gnf')::NUMERIC, 100)),
    'survey_min_billable_targets', GREATEST(1, LEAST(100000, COALESCE((o.settings->'ngo_surveys'->>'survey_min_billable_targets')::INTEGER, 50))),
    'survey_min_fee_gnf', GREATEST(0, COALESCE((o.settings->'ngo_surveys'->>'survey_min_fee_gnf')::NUMERIC, 25000)),
    'survey_max_fee_gnf', GREATEST(0, COALESCE((o.settings->'ngo_surveys'->>'survey_max_fee_gnf')::NUMERIC, 5000000)),
    'require_survey_payment', COALESCE((o.settings->'ngo_surveys'->>'require_survey_payment')::BOOLEAN, true)
  )
  FROM organizations o
  WHERE o.id = p_org_id;
$$;

CREATE OR REPLACE FUNCTION update_ngo_survey_settings(p_org_id UUID, p_settings JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    (is_org_admin() AND belongs_to_org(p_org_id))
    OR is_platform_admin()
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE organizations SET
    settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{ngo_surveys}',
      jsonb_build_object(
        'enabled', COALESCE((p_settings->>'enabled')::BOOLEAN, true),
        'require_gps', COALESCE((p_settings->>'require_gps')::BOOLEAN, true),
        'allow_offline_collection', COALESCE((p_settings->>'allow_offline_collection')::BOOLEAN, true),
        'default_region', NULLIF(trim(p_settings->>'default_region'), ''),
        'max_active_surveys', GREATEST(1, LEAST(50, COALESCE((p_settings->>'max_active_surveys')::INTEGER, 5))),
        'auto_close_when_target_reached', COALESCE((p_settings->>'auto_close_when_target_reached')::BOOLEAN, false),
        'one_per_device', COALESCE((p_settings->>'one_per_device')::BOOLEAN, true),
        'device_lock_days', GREATEST(1, LEAST(365, COALESCE((p_settings->>'device_lock_days')::INTEGER, 30))),
        'require_phone_otp', COALESCE((p_settings->>'require_phone_otp')::BOOLEAN, true),
        'otp_channel', CASE
          WHEN lower(COALESCE(p_settings->>'otp_channel', 'sms')) = 'whatsapp' THEN 'whatsapp'
          ELSE 'sms'
        END,
        'rate_limit_otp_per_ip_hour', GREATEST(1, LEAST(100, COALESCE((p_settings->>'rate_limit_otp_per_ip_hour')::INTEGER, 5))),
        'rate_limit_submit_per_ip_hour', GREATEST(1, LEAST(500, COALESCE((p_settings->>'rate_limit_submit_per_ip_hour')::INTEGER, 30))),
        'anomaly_responses_per_minute', GREATEST(5, LEAST(500, COALESCE((p_settings->>'anomaly_responses_per_minute')::INTEGER, 20))),
        'anomaly_same_choice_zone_count', GREATEST(3, LEAST(200, COALESCE((p_settings->>'anomaly_same_choice_zone_count')::INTEGER, 15))),
        'anomaly_same_choice_zone_minutes', GREATEST(1, LEAST(60, COALESCE((p_settings->>'anomaly_same_choice_zone_minutes')::INTEGER, 5))),
        'survey_base_fee_gnf', GREATEST(0, COALESCE((p_settings->>'survey_base_fee_gnf')::NUMERIC, 25000)),
        'survey_per_target_gnf', GREATEST(0, COALESCE((p_settings->>'survey_per_target_gnf')::NUMERIC, 100)),
        'survey_min_billable_targets', GREATEST(1, LEAST(100000, COALESCE((p_settings->>'survey_min_billable_targets')::INTEGER, 50))),
        'survey_min_fee_gnf', GREATEST(0, COALESCE((p_settings->>'survey_min_fee_gnf')::NUMERIC, 25000)),
        'survey_max_fee_gnf', GREATEST(0, COALESCE((p_settings->>'survey_max_fee_gnf')::NUMERIC, 5000000)),
        'require_survey_payment', COALESCE((p_settings->>'require_survey_payment')::BOOLEAN, true)
      ),
      true
    )
  WHERE id = p_org_id AND type = 'ngo';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organisation ONG introuvable';
  END IF;

  RETURN ngo_survey_settings(p_org_id);
END;
$$;

-- ─── Calcul du tarif campagne ────────────────────────────────

CREATE OR REPLACE FUNCTION compute_ngo_survey_fee(p_org_id UUID, p_target_responses INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
  v_base NUMERIC;
  v_per NUMERIC;
  v_min_targets INTEGER;
  v_min_fee NUMERIC;
  v_max_fee NUMERIC;
  v_targets INTEGER;
  v_participant_line NUMERIC;
  v_raw NUMERIC;
  v_amount NUMERIC;
BEGIN
  v_settings := ngo_survey_settings(p_org_id);
  v_base := COALESCE((v_settings->>'survey_base_fee_gnf')::NUMERIC, 25000);
  v_per := COALESCE((v_settings->>'survey_per_target_gnf')::NUMERIC, 100);
  v_min_targets := GREATEST(1, COALESCE((v_settings->>'survey_min_billable_targets')::INTEGER, 50));
  v_min_fee := COALESCE((v_settings->>'survey_min_fee_gnf')::NUMERIC, 25000);
  v_max_fee := COALESCE((v_settings->>'survey_max_fee_gnf')::NUMERIC, 5000000);

  v_targets := GREATEST(v_min_targets, COALESCE(NULLIF(p_target_responses, 0), v_min_targets));
  v_participant_line := v_targets * v_per;
  v_raw := v_base + v_participant_line;
  v_amount := LEAST(v_max_fee, GREATEST(v_min_fee, v_raw));

  RETURN jsonb_build_object(
    'target_count', v_targets,
    'base_fee_gnf', v_base,
    'per_target_gnf', v_per,
    'participant_line_gnf', v_participant_line,
    'amount_gnf', v_amount,
    'require_payment', COALESCE((v_settings->>'require_survey_payment')::BOOLEAN, true)
  );
END;
$$;

-- ─── Paiement campagne OK ? ──────────────────────────────────

CREATE OR REPLACE FUNCTION ngo_survey_payment_ok(p_survey_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey ngo_surveys%ROWTYPE;
  v_settings JSONB;
  v_charge ngo_survey_charges%ROWTYPE;
BEGIN
  SELECT * INTO v_survey FROM ngo_surveys WHERE id = p_survey_id;
  IF NOT FOUND THEN RETURN false; END IF;

  v_settings := ngo_survey_settings(v_survey.organization_id);
  IF COALESCE((v_settings->>'require_survey_payment')::BOOLEAN, true) = false THEN
    RETURN true;
  END IF;

  SELECT * INTO v_charge FROM ngo_survey_charges WHERE survey_id = p_survey_id;
  IF NOT FOUND THEN RETURN false; END IF;

  RETURN v_charge.status IN ('paid', 'waived');
END;
$$;

-- ─── Créer facture campagne ──────────────────────────────────

CREATE OR REPLACE FUNCTION create_ngo_survey_charge(p_survey_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey ngo_surveys%ROWTYPE;
  v_fee JSONB;
  v_token TEXT;
  v_charge ngo_survey_charges%ROWTYPE;
BEGIN
  SELECT * INTO v_survey FROM ngo_surveys WHERE id = p_survey_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sondage introuvable');
  END IF;

  IF NOT belongs_to_org(v_survey.organization_id) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  SELECT * INTO v_charge FROM ngo_survey_charges WHERE survey_id = p_survey_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'charge_id', v_charge.id,
      'amount_gnf', v_charge.amount_gnf,
      'status', v_charge.status,
      'payment_token', v_charge.payment_token,
      'breakdown', v_charge.breakdown
    );
  END IF;

  v_fee := compute_ngo_survey_fee(v_survey.organization_id, v_survey.target_responses);

  IF COALESCE((v_fee->>'require_payment')::BOOLEAN, true) = false THEN
    RETURN jsonb_build_object('skipped', true, 'amount_gnf', 0);
  END IF;

  v_token := 'srvpay_' || encode(gen_random_bytes(14), 'hex');

  INSERT INTO ngo_survey_charges (
    organization_id, survey_id, target_responses, amount_gnf, breakdown, payment_token
  ) VALUES (
    v_survey.organization_id,
    p_survey_id,
    (v_fee->>'target_count')::INTEGER,
    (v_fee->>'amount_gnf')::NUMERIC,
    v_fee,
    v_token
  )
  RETURNING * INTO v_charge;

  RETURN jsonb_build_object(
    'charge_id', v_charge.id,
    'amount_gnf', v_charge.amount_gnf,
    'status', v_charge.status,
    'payment_token', v_charge.payment_token,
    'breakdown', v_charge.breakdown
  );
END;
$$;

-- ─── Lecture paiement par token ──────────────────────────────

CREATE OR REPLACE FUNCTION get_ngo_survey_charge_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge ngo_survey_charges%ROWTYPE;
  v_survey ngo_surveys%ROWTYPE;
  v_org organizations%ROWTYPE;
BEGIN
  SELECT * INTO v_charge FROM ngo_survey_charges WHERE payment_token = trim(p_token);
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_survey FROM ngo_surveys WHERE id = v_charge.survey_id;
  SELECT * INTO v_org FROM organizations WHERE id = v_charge.organization_id;

  RETURN jsonb_build_object(
    'charge_id', v_charge.id,
    'survey_id', v_charge.survey_id,
    'survey_title', v_survey.title,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'target_responses', v_charge.target_responses,
    'amount_gnf', v_charge.amount_gnf,
    'breakdown', v_charge.breakdown,
    'status', v_charge.status,
    'payment_token', v_charge.payment_token
  );
END;
$$;

-- ─── Enregistrer paiement ─────────────────────────────────────

CREATE OR REPLACE FUNCTION record_ngo_survey_payment(
  p_charge_id UUID,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge ngo_survey_charges%ROWTYPE;
BEGIN
  SELECT * INTO v_charge FROM ngo_survey_charges WHERE id = p_charge_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Facture introuvable');
  END IF;

  IF NOT (
    (is_org_admin() AND belongs_to_org(v_charge.organization_id))
    OR is_platform_admin()
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  IF v_charge.status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'already_paid', true);
  END IF;

  UPDATE ngo_survey_charges SET
    status = 'paid',
    payment_reference = NULLIF(trim(p_reference), ''),
    paid_at = now(),
    updated_at = now()
  WHERE id = p_charge_id;

  RETURN jsonb_build_object('success', true, 'charge_id', p_charge_id);
END;
$$;

CREATE OR REPLACE FUNCTION platform_waive_ngo_survey_charge(p_charge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE ngo_survey_charges SET
    status = 'waived',
    updated_at = now()
  WHERE id = p_charge_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Facture introuvable');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION compute_ngo_survey_fee(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION create_ngo_survey_charge(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ngo_survey_payment_ok(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ngo_survey_charge_by_token(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION record_ngo_survey_payment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_waive_ngo_survey_charge(UUID) TO authenticated;
