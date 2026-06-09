-- ============================================================
-- Comptes « sondage uniquement » : abonnement par campagne
-- Paiement → collecte → rapport final → +15 jours → fin
-- ============================================================

ALTER TABLE ngo_survey_charges
  ADD COLUMN IF NOT EXISTS final_report_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS campaign_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN ngo_survey_charges.final_report_at IS 'Date de production du rapport final KonaAI';
COMMENT ON COLUMN ngo_survey_charges.campaign_ends_at IS 'Fin d''accès campagne (rapport final + 15 jours)';

ALTER TABLE ngo_survey_charges DROP CONSTRAINT IF EXISTS ngo_survey_charges_status_check;
ALTER TABLE ngo_survey_charges ADD CONSTRAINT ngo_survey_charges_status_check
  CHECK (status IN (
    'awaiting_ceo_quote',
    'awaiting_payment',
    'pending_payment',
    'paid',
    'waived',
    'cancelled',
    'expired'
  ));

-- ─── Expiration automatique des campagnes ────────────────────

CREATE OR REPLACE FUNCTION process_expired_ngo_survey_campaigns(p_org_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE ngo_survey_charges SET
    status = 'expired',
    updated_at = now()
  WHERE status IN ('paid', 'waived')
    AND campaign_ends_at IS NOT NULL
    AND campaign_ends_at <= now()
    AND (p_org_id IS NULL OR organization_id = p_org_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE ngo_surveys s SET
    status = 'closed',
    updated_at = now()
  FROM ngo_survey_charges c
  WHERE c.survey_id = s.id
    AND c.status = 'expired'
    AND s.status IN ('active', 'scheduled')
    AND (p_org_id IS NULL OR s.organization_id = p_org_id);

  RETURN v_count;
END;
$$;

-- ─── Accès campagne (collecte + dashboard) ───────────────────

CREATE OR REPLACE FUNCTION ngo_survey_campaign_access_ok(p_survey_id UUID)
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

  IF v_charge.status = 'expired' THEN RETURN false; END IF;
  IF v_charge.status NOT IN ('paid', 'waived') THEN RETURN false; END IF;
  IF v_charge.campaign_ends_at IS NOT NULL AND v_charge.campaign_ends_at <= now() THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- ─── Création nouveau sondage (compte survey_only) ───────────

CREATE OR REPLACE FUNCTION survey_only_can_create_survey(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT organization_is_survey_only(p_org_id) THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  PERFORM process_expired_ngo_survey_campaigns(p_org_id);

  -- Création libre : chaque sondage a son propre cycle payant à l'activation.
  -- (Une campagne précédente peut rester active pendant la préparation d'une nouvelle.)
  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- ─── Rapport final → fin dans 15 jours ───────────────────────

CREATE OR REPLACE FUNCTION mark_ngo_survey_final_report(p_survey_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey ngo_surveys%ROWTYPE;
  v_charge ngo_survey_charges%ROWTYPE;
BEGIN
  SELECT * INTO v_survey FROM ngo_surveys WHERE id = p_survey_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Sondage introuvable'); END IF;

  IF NOT belongs_to_org(v_survey.organization_id) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  SELECT * INTO v_charge FROM ngo_survey_charges WHERE survey_id = p_survey_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Aucune facture campagne'); END IF;

  IF v_charge.final_report_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_marked', true,
      'campaign_ends_at', v_charge.campaign_ends_at
    );
  END IF;

  UPDATE ngo_survey_charges SET
    final_report_at = now(),
    campaign_ends_at = now() + interval '15 days',
    updated_at = now()
  WHERE id = v_charge.id
  RETURNING * INTO v_charge;

  UPDATE ngo_surveys SET
    status = 'closed',
    updated_at = now()
  WHERE id = p_survey_id
    AND status IN ('active', 'scheduled');

  RETURN jsonb_build_object(
    'success', true,
    'final_report_at', v_charge.final_report_at,
    'campaign_ends_at', v_charge.campaign_ends_at
  );
END;
$$;

-- ─── Participation publique : campagne active ─────────────────

CREATE OR REPLACE FUNCTION get_ngo_survey_by_public_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey ngo_surveys%ROWTYPE;
  v_org organizations%ROWTYPE;
  v_settings JSONB;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN RETURN NULL; END IF;

  SELECT * INTO v_survey FROM ngo_surveys WHERE public_token = trim(p_token);
  IF NOT FOUND THEN RETURN NULL; END IF;

  PERFORM process_expired_ngo_survey_campaigns(v_survey.organization_id);

  v_settings := ngo_survey_settings(v_survey.organization_id);
  IF COALESCE((v_settings->>'enabled')::BOOLEAN, true) = false THEN
    RETURN jsonb_build_object('error', 'module_disabled');
  END IF;

  IF NOT ngo_survey_campaign_access_ok(v_survey.id) THEN
    RETURN jsonb_build_object('error', 'campaign_expired', 'message', 'Cette campagne sondage est terminée.');
  END IF;

  IF v_survey.status NOT IN ('active', 'scheduled') THEN
    RETURN jsonb_build_object('error', 'not_open', 'status', v_survey.status);
  END IF;

  IF v_survey.starts_at IS NOT NULL AND v_survey.starts_at > now() THEN
    RETURN jsonb_build_object('error', 'not_started', 'starts_at', v_survey.starts_at);
  END IF;

  IF v_survey.ends_at IS NOT NULL AND v_survey.ends_at < now() THEN
    RETURN jsonb_build_object('error', 'ended', 'ends_at', v_survey.ends_at);
  END IF;

  IF v_survey.collection_mode = 'field_agent' THEN
    RETURN jsonb_build_object('error', 'field_agent_only');
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = v_survey.organization_id;

  RETURN jsonb_build_object(
    'id', v_survey.id,
    'title', v_survey.title,
    'description', v_survey.description,
    'status', v_survey.status,
    'region', v_survey.region,
    'questions', v_survey.questions,
    'organization_name', v_org.name,
    'starts_at', v_survey.starts_at,
    'ends_at', v_survey.ends_at,
    'security', jsonb_build_object(
      'require_phone_otp', COALESCE((v_settings->>'require_phone_otp')::BOOLEAN, true),
      'otp_channel', COALESCE(NULLIF(v_settings->>'otp_channel', ''), 'sms'),
      'one_per_device', COALESCE((v_settings->>'one_per_device')::BOOLEAN, true),
      'device_lock_days', COALESCE((v_settings->>'device_lock_days')::INTEGER, 30)
    )
  );
END;
$$;

-- Comptes survey_only : plusieurs sondages possibles (1 paiement par activation)
UPDATE organizations SET
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{ngo_surveys}',
    COALESCE(settings->'ngo_surveys', '{}'::jsonb) || jsonb_build_object('max_active_surveys', 5)
  )
WHERE settings->'onboarding'->>'intent' = 'survey_only';

GRANT EXECUTE ON FUNCTION process_expired_ngo_survey_campaigns(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ngo_survey_campaign_access_ok(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION survey_only_can_create_survey(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_ngo_survey_final_report(UUID) TO authenticated;
