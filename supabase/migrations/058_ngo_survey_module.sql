-- ============================================================
-- ONG — Module sondages : paramètres org, programmation, agents
-- ============================================================

ALTER TYPE survey_status ADD VALUE IF NOT EXISTS 'scheduled';

ALTER TABLE ngo_surveys
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS target_responses INTEGER,
  ADD COLUMN IF NOT EXISTS collection_mode TEXT NOT NULL DEFAULT 'field_agent',
  ADD COLUMN IF NOT EXISTS assigned_zones JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ngo_surveys_collection_mode_check'
  ) THEN
    ALTER TABLE ngo_surveys ADD CONSTRAINT ngo_surveys_collection_mode_check
      CHECK (collection_mode IN ('field_agent', 'self_service', 'mixed'));
  END IF;
END $$;

COMMENT ON COLUMN ngo_surveys.starts_at IS 'Début programmé de la collecte';
COMMENT ON COLUMN ngo_surveys.ends_at IS 'Fin programmée de la collecte';
COMMENT ON COLUMN ngo_surveys.target_responses IS 'Objectif de réponses';

CREATE TABLE IF NOT EXISTS ngo_survey_agent_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id UUID NOT NULL REFERENCES ngo_surveys(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (survey_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_ngo_survey_agent_assignments_survey
  ON ngo_survey_agent_assignments(survey_id);
CREATE INDEX IF NOT EXISTS idx_ngo_survey_agent_assignments_profile
  ON ngo_survey_agent_assignments(profile_id);

ALTER TABLE ngo_survey_agent_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ngo_survey_agent_assignments_all ON ngo_survey_agent_assignments;
CREATE POLICY ngo_survey_agent_assignments_all ON ngo_survey_agent_assignments
  FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

-- ─── Paramètres organisation (organizations.settings.ngo_surveys) ───

CREATE OR REPLACE FUNCTION ngo_survey_settings(p_org_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT settings->'ngo_surveys' FROM organizations WHERE id = p_org_id),
    jsonb_build_object(
      'enabled', true,
      'require_gps', true,
      'allow_offline_collection', true,
      'default_region', null,
      'max_active_surveys', 5,
      'auto_close_when_target_reached', false
    )
  );
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
        'auto_close_when_target_reached', COALESCE((p_settings->>'auto_close_when_target_reached')::BOOLEAN, false)
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

-- ─── Statistiques d'un sondage ─────────────────────────────────

CREATE OR REPLACE FUNCTION ngo_survey_stats(p_survey_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey ngo_surveys%ROWTYPE;
  v_responses BIGINT;
  v_agents BIGINT;
  v_by_region JSONB;
BEGIN
  SELECT * INTO v_survey FROM ngo_surveys WHERE id = p_survey_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sondage introuvable');
  END IF;

  IF NOT belongs_to_org(v_survey.organization_id) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  SELECT count(*) INTO v_responses
  FROM ngo_survey_responses WHERE survey_id = p_survey_id;

  SELECT count(*) INTO v_agents
  FROM ngo_survey_agent_assignments WHERE survey_id = p_survey_id;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_by_region
  FROM (
    SELECT COALESCE(locality, 'Non renseigné') AS label, count(*)::INTEGER AS count
    FROM ngo_survey_responses
    WHERE survey_id = p_survey_id
    GROUP BY COALESCE(locality, 'Non renseigné')
    ORDER BY count DESC
    LIMIT 12
  ) t;

  RETURN jsonb_build_object(
    'response_count', v_responses,
    'target_responses', v_survey.target_responses,
    'assigned_agents', v_agents,
    'by_region', v_by_region,
    'progress_pct', CASE
      WHEN v_survey.target_responses IS NULL OR v_survey.target_responses <= 0 THEN null
      ELSE LEAST(100, ROUND((v_responses::NUMERIC / v_survey.target_responses) * 100))
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION ngo_user_can_collect_survey(p_survey_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey ngo_surveys%ROWTYPE;
  v_settings JSONB;
BEGIN
  SELECT * INTO v_survey FROM ngo_surveys WHERE id = p_survey_id;
  IF NOT FOUND THEN RETURN false; END IF;

  v_settings := ngo_survey_settings(v_survey.organization_id);
  IF COALESCE((v_settings->>'enabled')::BOOLEAN, true) = false THEN
    RETURN false;
  END IF;

  IF v_survey.status NOT IN ('active', 'scheduled') THEN
    RETURN false;
  END IF;

  IF v_survey.starts_at IS NOT NULL AND v_survey.starts_at > now() THEN
    RETURN false;
  END IF;

  IF v_survey.ends_at IS NOT NULL AND v_survey.ends_at < now() THEN
    RETURN false;
  END IF;

  IF NOT belongs_to_org(v_survey.organization_id) AND NOT is_platform_admin() THEN
    RETURN false;
  END IF;

  IF is_org_admin() OR is_platform_admin() THEN
    RETURN true;
  END IF;

  IF has_role('ngo_staff') THEN
    RETURN EXISTS (
      SELECT 1 FROM ngo_survey_agent_assignments a
      WHERE a.survey_id = p_survey_id AND a.profile_id = auth.uid()
    );
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION ngo_survey_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_ngo_survey_settings(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION ngo_survey_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ngo_user_can_collect_survey(UUID) TO authenticated;
