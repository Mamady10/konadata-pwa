-- ============================================================
-- CEO peut modifier le tarif campagne (négociation) avant paiement
-- Exécuter après 062-F-ngo-survey-ceo-pricing-ONLY.sql
-- ============================================================

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
  v_is_revision BOOLEAN;
  v_revision_count INTEGER;
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
    RETURN jsonb_build_object('error', 'Tarif modifiable uniquement avant paiement');
  END IF;

  v_is_revision := v_charge.status = 'awaiting_payment'
    AND v_charge.amount_gnf IS NOT NULL
    AND v_charge.amount_gnf <> p_amount_gnf;

  v_revision_count := COALESCE((v_charge.breakdown->>'revision_count')::INTEGER, 0);
  IF v_is_revision THEN
    v_revision_count := v_revision_count + 1;
  END IF;

  v_token := COALESCE(
    v_charge.payment_token,
    'srvpay_' || encode(gen_random_bytes(14), 'hex')
  );

  UPDATE ngo_survey_charges SET
    amount_gnf = p_amount_gnf,
    status = 'awaiting_payment',
    payment_token = v_token,
    ceo_notes = COALESCE(NULLIF(trim(p_ceo_notes), ''), ceo_notes),
    breakdown = COALESCE(breakdown, '{}'::jsonb) || jsonb_build_object(
      'pricing_mode', 'ceo_set',
      'amount_gnf', p_amount_gnf,
      'set_at', now(),
      'previous_amount_gnf', CASE WHEN v_is_revision THEN v_charge.amount_gnf ELSE breakdown->'previous_amount_gnf' END,
      'revision_count', v_revision_count,
      'is_revision', v_is_revision
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
    'survey_id', v_charge.survey_id,
    'is_revision', v_is_revision,
    'previous_amount_gnf', CASE WHEN v_is_revision THEN (v_charge.breakdown->>'previous_amount_gnf')::NUMERIC ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION list_ngo_survey_charges_for_ceo_management()
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
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.sort_order, t.submitted_at ASC)
    FROM (
      SELECT
        c.id AS charge_id,
        c.survey_id,
        c.organization_id,
        c.target_responses,
        c.amount_gnf,
        c.status,
        c.payment_token,
        c.ceo_notes,
        c.submitted_at,
        c.updated_at,
        c.breakdown,
        s.title AS survey_title,
        s.description AS survey_description,
        s.region AS survey_region,
        s.collection_mode,
        s.status AS survey_status,
        o.name AS organization_name,
        o.type AS organization_type,
        CASE c.status WHEN 'awaiting_ceo_quote' THEN 0 ELSE 1 END AS sort_order
      FROM ngo_survey_charges c
      JOIN ngo_surveys s ON s.id = c.survey_id
      JOIN organizations o ON o.id = c.organization_id
      WHERE c.status IN ('awaiting_ceo_quote', 'awaiting_payment')
      ORDER BY sort_order, c.submitted_at ASC
      LIMIT 80
    ) t
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION list_ngo_survey_charges_for_ceo_management() TO authenticated;
