-- ============================================================
-- Sondages ONG — tarif fixé par le CEO (plus d'estimation auto)
-- ============================================================

ALTER TABLE ngo_survey_charges
  ADD COLUMN IF NOT EXISTS ceo_notes TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE ngo_survey_charges DROP CONSTRAINT IF EXISTS ngo_survey_charges_status_check;
ALTER TABLE ngo_survey_charges ADD CONSTRAINT ngo_survey_charges_status_check
  CHECK (status IN (
    'awaiting_ceo_quote',
    'awaiting_payment',
    'pending_payment',
    'paid',
    'waived',
    'cancelled'
  ));

-- Rétrocompat : anciens pending_payment → awaiting_payment
UPDATE ngo_survey_charges SET status = 'awaiting_payment' WHERE status = 'pending_payment';

COMMENT ON COLUMN ngo_survey_charges.ceo_notes IS 'Note CEO lors de la validation du tarif campagne';

-- ─── Soumission directeur : demande de devis CEO ─────────────

CREATE OR REPLACE FUNCTION create_ngo_survey_charge(p_survey_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey ngo_surveys%ROWTYPE;
  v_settings JSONB;
  v_charge ngo_survey_charges%ROWTYPE;
  v_targets INTEGER;
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
      'breakdown', v_charge.breakdown,
      'awaiting_ceo', v_charge.status = 'awaiting_ceo_quote'
    );
  END IF;

  v_settings := ngo_survey_settings(v_survey.organization_id);
  IF COALESCE((v_settings->>'require_survey_payment')::BOOLEAN, true) = false THEN
    RETURN jsonb_build_object('skipped', true, 'amount_gnf', 0);
  END IF;

  v_targets := GREATEST(1, COALESCE(v_survey.target_responses, 1));

  INSERT INTO ngo_survey_charges (
    organization_id, survey_id, target_responses, amount_gnf, breakdown, status, payment_token
  ) VALUES (
    v_survey.organization_id,
    p_survey_id,
    v_targets,
    0,
    jsonb_build_object(
      'pricing_mode', 'ceo_quote',
      'target_responses', v_targets,
      'survey_title', v_survey.title,
      'survey_region', v_survey.region,
      'collection_mode', v_survey.collection_mode
    ),
    'awaiting_ceo_quote',
    NULL
  )
  RETURNING * INTO v_charge;

  RETURN jsonb_build_object(
    'charge_id', v_charge.id,
    'amount_gnf', 0,
    'status', v_charge.status,
    'payment_token', NULL,
    'breakdown', v_charge.breakdown,
    'awaiting_ceo', true
  );
END;
$$;

-- ─── CEO fixe le tarif ───────────────────────────────────────

CREATE OR REPLACE FUNCTION platform_admin_set_ngo_survey_charge(
  p_charge_id UUID,
  p_amount_gnf NUMERIC,
  p_ceo_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge ngo_survey_charges%ROWTYPE;
  v_token TEXT;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  IF p_amount_gnf IS NULL OR p_amount_gnf < 0 THEN
    RETURN jsonb_build_object('error', 'Montant invalide');
  END IF;

  SELECT * INTO v_charge FROM ngo_survey_charges WHERE id = p_charge_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Demande introuvable');
  END IF;

  IF v_charge.status NOT IN ('awaiting_ceo_quote', 'awaiting_payment') THEN
    RETURN jsonb_build_object('error', 'Cette demande ne peut plus être tarifée');
  END IF;

  v_token := COALESCE(
    v_charge.payment_token,
    'srvpay_' || encode(gen_random_bytes(14), 'hex')
  );

  UPDATE ngo_survey_charges SET
    amount_gnf = p_amount_gnf,
    status = 'awaiting_payment',
    payment_token = v_token,
    ceo_notes = NULLIF(trim(p_ceo_notes), ''),
    breakdown = COALESCE(breakdown, '{}'::jsonb) || jsonb_build_object(
      'pricing_mode', 'ceo_set',
      'amount_gnf', p_amount_gnf,
      'set_at', now()
    ),
    updated_at = now()
  WHERE id = p_charge_id
  RETURNING * INTO v_charge;

  RETURN jsonb_build_object(
    'success', true,
    'charge_id', v_charge.id,
    'amount_gnf', v_charge.amount_gnf,
    'status', v_charge.status,
    'payment_token', v_charge.payment_token,
    'survey_id', v_charge.survey_id
  );
END;
$$;

-- ─── Liste CEO ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION list_ngo_surveys_awaiting_ceo_quote()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.submitted_at ASC)
    FROM (
      SELECT
        c.id AS charge_id,
        c.survey_id,
        c.organization_id,
        c.target_responses,
        c.status,
        c.submitted_at,
        c.breakdown,
        s.title AS survey_title,
        s.description AS survey_description,
        s.region AS survey_region,
        s.collection_mode,
        s.status AS survey_status,
        o.name AS organization_name,
        o.type AS organization_type
      FROM ngo_survey_charges c
      JOIN ngo_surveys s ON s.id = c.survey_id
      JOIN organizations o ON o.id = c.organization_id
      WHERE c.status = 'awaiting_ceo_quote'
      ORDER BY c.submitted_at ASC
      LIMIT 50
    ) t
  ), '[]'::jsonb);
END;
$$;

-- ─── Paiement OK ─────────────────────────────────────────────

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

DROP POLICY IF EXISTS ngo_survey_charges_platform ON ngo_survey_charges;
CREATE POLICY ngo_survey_charges_platform ON ngo_survey_charges
  FOR SELECT TO authenticated
  USING (is_platform_admin());

GRANT EXECUTE ON FUNCTION platform_admin_set_ngo_survey_charge(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION list_ngo_surveys_awaiting_ceo_quote() TO authenticated;
