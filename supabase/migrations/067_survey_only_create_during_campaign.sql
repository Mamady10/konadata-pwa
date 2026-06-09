-- Création sondage autorisée pendant une campagne active (paiement requis à l'activation)

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

  RETURN jsonb_build_object('allowed', true);
END;
$$;

UPDATE organizations SET
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{ngo_surveys}',
    COALESCE(settings->'ngo_surveys', '{}'::jsonb) || jsonb_build_object('max_active_surveys', 5)
  )
WHERE settings->'onboarding'->>'intent' = 'survey_only';
