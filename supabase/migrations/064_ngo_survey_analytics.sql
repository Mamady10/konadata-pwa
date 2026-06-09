-- ============================================================
-- ONG Sondages — qualité données, dédoublonnage, analytiques
-- ============================================================

ALTER TABLE ngo_survey_responses
  ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS excluded_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS exclusion_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_ngo_survey_responses_active
  ON ngo_survey_responses(survey_id, created_at DESC)
  WHERE excluded_at IS NULL;

COMMENT ON COLUMN ngo_survey_responses.excluded_at IS 'Réponse exclue des statistiques (doublon, anomalie, nettoyage manuel)';

-- ─── Stats : exclure les réponses nettoyées ─────────────────

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
  v_valid BIGINT;
  v_excluded BIGINT;
  v_agents BIGINT;
  v_by_region JSONB;
  v_by_choice JSONB;
  v_first_qid TEXT;
BEGIN
  SELECT * INTO v_survey FROM ngo_surveys WHERE id = p_survey_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sondage introuvable');
  END IF;

  IF NOT belongs_to_org(v_survey.organization_id) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  SELECT count(*) INTO v_responses FROM ngo_survey_responses WHERE survey_id = p_survey_id;
  SELECT count(*) INTO v_valid
  FROM ngo_survey_responses WHERE survey_id = p_survey_id AND excluded_at IS NULL;
  v_excluded := v_responses - v_valid;

  SELECT count(*) INTO v_agents
  FROM ngo_survey_agent_assignments WHERE survey_id = p_survey_id;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_by_region
  FROM (
    SELECT COALESCE(NULLIF(trim(locality), ''), 'Non renseigné') AS label, count(*)::INTEGER AS count
    FROM ngo_survey_responses
    WHERE survey_id = p_survey_id AND excluded_at IS NULL
    GROUP BY COALESCE(NULLIF(trim(locality), ''), 'Non renseigné')
    ORDER BY count DESC
    LIMIT 20
  ) t;

  v_first_qid := COALESCE(
    (SELECT elem->>'id' FROM jsonb_array_elements(v_survey.questions) elem LIMIT 1),
    'q1'
  );

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.count DESC), '[]'::jsonb) INTO v_by_choice
  FROM (
    SELECT COALESCE(answers->>v_first_qid, 'Non renseigné') AS label, count(*)::INTEGER AS count
    FROM ngo_survey_responses
    WHERE survey_id = p_survey_id AND excluded_at IS NULL
    GROUP BY COALESCE(answers->>v_first_qid, 'Non renseigné')
  ) t;

  RETURN jsonb_build_object(
    'response_count', v_valid,
    'total_raw', v_responses,
    'excluded_count', v_excluded,
    'target_responses', v_survey.target_responses,
    'assigned_agents', v_agents,
    'by_region', v_by_region,
    'by_choice', v_by_choice,
    'question_id', v_first_qid,
    'progress_pct', CASE
      WHEN v_survey.target_responses IS NULL OR v_survey.target_responses <= 0 THEN null
      ELSE LEAST(100, ROUND((v_valid::NUMERIC / v_survey.target_responses) * 100))
    END
  );
END;
$$;

-- ─── Exclure / restaurer une réponse ─────────────────────────

CREATE OR REPLACE FUNCTION exclude_ngo_survey_response(
  p_response_id UUID,
  p_reason TEXT DEFAULT 'Exclu manuellement'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row ngo_survey_responses%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM ngo_survey_responses WHERE id = p_response_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Réponse introuvable');
  END IF;

  IF NOT belongs_to_org(v_row.organization_id) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE ngo_survey_responses SET
    excluded_at = now(),
    excluded_by = auth.uid(),
    exclusion_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Exclu manuellement')
  WHERE id = p_response_id;

  RETURN jsonb_build_object('success', true, 'response_id', p_response_id);
END;
$$;

CREATE OR REPLACE FUNCTION restore_ngo_survey_response(p_response_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row ngo_survey_responses%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM ngo_survey_responses WHERE id = p_response_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Réponse introuvable');
  END IF;

  IF NOT belongs_to_org(v_row.organization_id) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE ngo_survey_responses SET
    excluded_at = NULL,
    excluded_by = NULL,
    exclusion_reason = NULL
  WHERE id = p_response_id;

  RETURN jsonb_build_object('success', true, 'response_id', p_response_id);
END;
$$;

-- ─── Détection doublons ──────────────────────────────────────

CREATE OR REPLACE FUNCTION ngo_survey_detect_duplicates(p_survey_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey ngo_surveys%ROWTYPE;
  v_groups JSONB;
BEGIN
  SELECT * INTO v_survey FROM ngo_surveys WHERE id = p_survey_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Sondage introuvable'); END IF;
  IF NOT belongs_to_org(v_survey.organization_id) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(g)), '[]'::jsonb) INTO v_groups
  FROM (
    SELECT
      'phone' AS match_type,
      participant_phone_hash AS match_key,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'created_at', created_at,
          'locality', locality,
          'answers', answers
        ) ORDER BY created_at ASC
      ) AS members
    FROM ngo_survey_responses
    WHERE survey_id = p_survey_id
      AND excluded_at IS NULL
      AND participant_phone_hash IS NOT NULL
    GROUP BY participant_phone_hash
    HAVING count(*) > 1

    UNION ALL

    SELECT
      'device' AS match_type,
      device_hash AS match_key,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'created_at', created_at,
          'locality', locality,
          'answers', answers
        ) ORDER BY created_at ASC
      ) AS members
    FROM ngo_survey_responses
    WHERE survey_id = p_survey_id
      AND excluded_at IS NULL
      AND device_hash IS NOT NULL
    GROUP BY device_hash
    HAVING count(*) > 1

    UNION ALL

    SELECT
      'same_answer_locality' AS match_type,
      md5(COALESCE(answers::text, '') || '|' || COALESCE(trim(locality), '')) AS match_key,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'created_at', created_at,
          'locality', locality,
          'answers', answers
        ) ORDER BY created_at ASC
      ) AS members
    FROM ngo_survey_responses
    WHERE survey_id = p_survey_id AND excluded_at IS NULL
    GROUP BY md5(COALESCE(answers::text, '') || '|' || COALESCE(trim(locality), ''))
    HAVING count(*) > 1
  ) g;

  RETURN jsonb_build_object(
    'groups', v_groups,
    'group_count', jsonb_array_length(v_groups)
  );
END;
$$;

-- ─── Nettoyage auto : garde la plus ancienne réponse par groupe ─

CREATE OR REPLACE FUNCTION ngo_survey_auto_clean_duplicates(p_survey_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey ngo_surveys%ROWTYPE;
  v_excluded INTEGER := 0;
  v_dup JSONB;
  v_members JSONB;
  v_member JSONB;
  v_keep_id UUID;
  i INTEGER;
  j INTEGER;
BEGIN
  SELECT * INTO v_survey FROM ngo_surveys WHERE id = p_survey_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Sondage introuvable'); END IF;
  IF NOT belongs_to_org(v_survey.organization_id) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  v_dup := ngo_survey_detect_duplicates(p_survey_id);
  IF v_dup ? 'error' THEN RETURN v_dup; END IF;

  FOR i IN 0 .. COALESCE(jsonb_array_length(v_dup->'groups'), 0) - 1 LOOP
    v_members := v_dup->'groups'->i->'members';
    IF jsonb_array_length(v_members) < 2 THEN CONTINUE; END IF;
    v_keep_id := (v_members->0->>'id')::UUID;

    FOR j IN 1 .. jsonb_array_length(v_members) - 1 LOOP
      v_member := v_members->j;
      IF (v_member->>'id')::UUID = v_keep_id THEN CONTINUE; END IF;
      IF EXISTS (
        SELECT 1 FROM ngo_survey_responses
        WHERE id = (v_member->>'id')::UUID AND excluded_at IS NULL
      ) THEN
        UPDATE ngo_survey_responses SET
          excluded_at = now(),
          excluded_by = auth.uid(),
          exclusion_reason = 'Doublon automatique (' || (v_dup->'groups'->i->>'match_type') || ')'
        WHERE id = (v_member->>'id')::UUID AND excluded_at IS NULL;
        v_excluded := v_excluded + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'excluded_count', v_excluded);
END;
$$;

-- ─── Analytiques complètes ───────────────────────────────────

CREATE OR REPLACE FUNCTION ngo_survey_analytics(p_survey_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey ngo_surveys%ROWTYPE;
  v_stats JSONB;
  v_first_qid TEXT;
  v_by_day JSONB;
  v_cross_tab JSONB;
  v_map_points JSONB;
  v_quality JSONB;
  v_responses JSONB;
  v_dup JSONB;
BEGIN
  SELECT * INTO v_survey FROM ngo_surveys WHERE id = p_survey_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Sondage introuvable'); END IF;
  IF NOT belongs_to_org(v_survey.organization_id) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  v_stats := ngo_survey_stats(p_survey_id);
  v_first_qid := v_stats->>'question_id';
  v_dup := ngo_survey_detect_duplicates(p_survey_id);

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.day ASC), '[]'::jsonb) INTO v_by_day
  FROM (
    SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'Africa/Conakry'), 'YYYY-MM-DD') AS day,
           count(*)::INTEGER AS count
    FROM ngo_survey_responses
    WHERE survey_id = p_survey_id AND excluded_at IS NULL
    GROUP BY date_trunc('day', created_at AT TIME ZONE 'Africa/Conakry')
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.count DESC), '[]'::jsonb) INTO v_cross_tab
  FROM (
    SELECT
      COALESCE(answers->>v_first_qid, '—') AS choice,
      COALESCE(NULLIF(trim(locality), ''), 'Non renseigné') AS locality,
      count(*)::INTEGER AS count
    FROM ngo_survey_responses
    WHERE survey_id = p_survey_id AND excluded_at IS NULL
    GROUP BY 1, 2
    ORDER BY count DESC
    LIMIT 40
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_map_points
  FROM (
    SELECT
      id,
      latitude::FLOAT AS lat,
      longitude::FLOAT AS lng,
      COALESCE(NULLIF(trim(locality), ''), '—') AS locality,
      COALESCE(answers->>v_first_qid, '—') AS choice,
      created_at
    FROM ngo_survey_responses
    WHERE survey_id = p_survey_id
      AND excluded_at IS NULL
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 500
  ) t;

  SELECT jsonb_build_object(
    'with_gps', count(*) FILTER (WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND excluded_at IS NULL),
    'with_locality', count(*) FILTER (WHERE NULLIF(trim(locality), '') IS NOT NULL AND excluded_at IS NULL),
    'excluded', count(*) FILTER (WHERE excluded_at IS NOT NULL),
    'valid', count(*) FILTER (WHERE excluded_at IS NULL),
    'total', count(*),
    'alerts', (
      SELECT count(*)::INTEGER FROM ngo_survey_security_alerts
      WHERE survey_id = p_survey_id AND acknowledged_at IS NULL
    ),
    'duplicate_groups', COALESCE((v_dup->>'group_count')::INTEGER, 0)
  ) INTO v_quality
  FROM ngo_survey_responses WHERE survey_id = p_survey_id;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_responses
  FROM (
    SELECT
      id,
      COALESCE(NULLIF(trim(locality), ''), '—') AS locality,
      COALESCE(answers->>v_first_qid, '—') AS answer,
      created_at,
      excluded_at IS NOT NULL AS is_excluded,
      exclusion_reason,
      latitude IS NOT NULL AND longitude IS NOT NULL AS has_gps,
      participant_phone_hash IS NOT NULL AS has_phone_lock,
      device_hash IS NOT NULL AS has_device_lock
    FROM ngo_survey_responses
    WHERE survey_id = p_survey_id
    ORDER BY created_at DESC
    LIMIT 200
  ) t;

  RETURN jsonb_build_object(
    'survey_id', p_survey_id,
    'title', v_survey.title,
    'status', v_survey.status,
    'region', v_survey.region,
    'collection_mode', v_survey.collection_mode,
    'starts_at', v_survey.starts_at,
    'ends_at', v_survey.ends_at,
    'stats', v_stats,
    'by_day', v_by_day,
    'cross_tab', v_cross_tab,
    'map_points', v_map_points,
    'quality', v_quality,
    'responses', v_responses,
    'duplicate_groups', v_dup->'groups'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION exclude_ngo_survey_response(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_ngo_survey_response(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ngo_survey_detect_duplicates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ngo_survey_auto_clean_duplicates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ngo_survey_analytics(UUID) TO authenticated;
