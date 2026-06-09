-- ============================================================
-- ONG — Sondages publics : token participant, QCM, stats par choix
-- ============================================================

ALTER TABLE ngo_surveys
  ADD COLUMN IF NOT EXISTS public_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ngo_surveys_public_token
  ON ngo_surveys(public_token)
  WHERE public_token IS NOT NULL;

UPDATE ngo_surveys
SET public_token = 'srv_' || encode(gen_random_bytes(12), 'hex')
WHERE public_token IS NULL;

COMMENT ON COLUMN ngo_surveys.public_token IS 'Lien public de participation (/participation-ong/{token})';

-- ─── Lecture publique d'un sondage ───────────────────────────

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
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_survey FROM ngo_surveys WHERE public_token = trim(p_token);
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_settings := ngo_survey_settings(v_survey.organization_id);
  IF COALESCE((v_settings->>'enabled')::BOOLEAN, true) = false THEN
    RETURN jsonb_build_object('error', 'module_disabled');
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
    'ends_at', v_survey.ends_at
  );
END;
$$;

-- ─── Soumission publique ─────────────────────────────────────

CREATE OR REPLACE FUNCTION submit_ngo_public_survey_response(
  p_token TEXT,
  p_answers JSONB,
  p_locality TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey ngo_surveys%ROWTYPE;
  v_settings JSONB;
  v_questions JSONB;
  v_q JSONB;
  v_qid TEXT;
  v_answer TEXT;
  v_options JSONB;
  v_count BIGINT;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN jsonb_build_object('error', 'Token invalide');
  END IF;

  SELECT * INTO v_survey FROM ngo_surveys WHERE public_token = trim(p_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sondage introuvable');
  END IF;

  v_settings := ngo_survey_settings(v_survey.organization_id);
  IF COALESCE((v_settings->>'enabled')::BOOLEAN, true) = false THEN
    RETURN jsonb_build_object('error', 'Module sondages désactivé');
  END IF;

  IF v_survey.status NOT IN ('active', 'scheduled') THEN
    RETURN jsonb_build_object('error', 'Ce sondage n''accepte plus de réponses');
  END IF;

  IF v_survey.starts_at IS NOT NULL AND v_survey.starts_at > now() THEN
    RETURN jsonb_build_object('error', 'Le sondage n''a pas encore commencé');
  END IF;

  IF v_survey.ends_at IS NOT NULL AND v_survey.ends_at < now() THEN
    RETURN jsonb_build_object('error', 'Le sondage est terminé');
  END IF;

  IF v_survey.collection_mode = 'field_agent' THEN
    RETURN jsonb_build_object('error', 'Participation en ligne non autorisée pour ce sondage');
  END IF;

  v_questions := COALESCE(v_survey.questions, '[]'::jsonb);
  IF jsonb_array_length(v_questions) = 0 THEN
    RETURN jsonb_build_object('error', 'Sondage sans questions');
  END IF;

  FOR v_q IN SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_qid := COALESCE(v_q->>'id', 'q1');
    v_answer := NULLIF(trim(p_answers->>v_qid), '');

    IF COALESCE((v_q->>'required')::BOOLEAN, true) AND v_answer IS NULL THEN
      RETURN jsonb_build_object('error', 'Réponse manquante : ' || COALESCE(v_q->>'text', v_qid));
    END IF;

    IF v_q->>'type' = 'single_choice' AND v_answer IS NOT NULL THEN
      v_options := COALESCE(v_q->'options', '[]'::jsonb);
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(v_options) opt WHERE opt = v_answer
      ) THEN
        RETURN jsonb_build_object('error', 'Réponse invalide pour : ' || COALESCE(v_q->>'text', v_qid));
      END IF;
    END IF;
  END LOOP;

  INSERT INTO ngo_survey_responses (
    organization_id, survey_id, agent_id, answers, locality, synced_at, is_offline
  ) VALUES (
    v_survey.organization_id,
    v_survey.id,
    NULL,
    COALESCE(p_answers, '{}'::jsonb),
    NULLIF(trim(p_locality), ''),
    now(),
    false
  );

  IF COALESCE((v_settings->>'auto_close_when_target_reached')::BOOLEAN, false)
     AND v_survey.target_responses IS NOT NULL
     AND v_survey.status = 'active'
  THEN
    SELECT count(*) INTO v_count FROM ngo_survey_responses WHERE survey_id = v_survey.id;
    IF v_count >= v_survey.target_responses THEN
      UPDATE ngo_surveys SET status = 'closed', updated_at = now() WHERE id = v_survey.id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─── Stats enrichies (répartition par choix QCM) ─────────────

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

  v_first_qid := COALESCE(
    (SELECT elem->>'id' FROM jsonb_array_elements(v_survey.questions) elem LIMIT 1),
    'q1'
  );

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.count DESC), '[]'::jsonb) INTO v_by_choice
  FROM (
    SELECT COALESCE(answers->>v_first_qid, 'Non renseigné') AS label, count(*)::INTEGER AS count
    FROM ngo_survey_responses
    WHERE survey_id = p_survey_id
    GROUP BY COALESCE(answers->>v_first_qid, 'Non renseigné')
  ) t;

  RETURN jsonb_build_object(
    'response_count', v_responses,
    'target_responses', v_survey.target_responses,
    'assigned_agents', v_agents,
    'by_region', v_by_region,
    'by_choice', v_by_choice,
    'question_id', v_first_qid,
    'progress_pct', CASE
      WHEN v_survey.target_responses IS NULL OR v_survey.target_responses <= 0 THEN null
      ELSE LEAST(100, ROUND((v_responses::NUMERIC / v_survey.target_responses) * 100))
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_ngo_survey_by_public_token(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION submit_ngo_public_survey_response(TEXT, JSONB, TEXT) TO authenticated, anon;
