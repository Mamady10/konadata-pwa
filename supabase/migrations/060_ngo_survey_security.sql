-- ============================================================
-- ONG — Sécurité participation publique (OTP, appareil, IP, alertes)
-- ============================================================

ALTER TABLE ngo_survey_responses
  ADD COLUMN IF NOT EXISTS participant_phone_hash TEXT,
  ADD COLUMN IF NOT EXISTS device_hash TEXT,
  ADD COLUMN IF NOT EXISTS submission_ip_hash TEXT;

CREATE TABLE IF NOT EXISTS ngo_survey_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id UUID NOT NULL REFERENCES ngo_surveys(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'whatsapp')),
  device_hash TEXT,
  ip_hash TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ngo_survey_otp_challenges_survey_phone
  ON ngo_survey_otp_challenges(survey_id, phone_hash);
CREATE INDEX IF NOT EXISTS idx_ngo_survey_otp_challenges_expires
  ON ngo_survey_otp_challenges(expires_at);

CREATE TABLE IF NOT EXISTS ngo_survey_participation_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id UUID NOT NULL REFERENCES ngo_surveys(id) ON DELETE CASCADE,
  lock_type TEXT NOT NULL CHECK (lock_type IN ('device', 'phone')),
  lock_hash TEXT NOT NULL,
  response_id UUID REFERENCES ngo_survey_responses(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (survey_id, lock_type, lock_hash)
);

CREATE INDEX IF NOT EXISTS idx_ngo_survey_participation_locks_expires
  ON ngo_survey_participation_locks(expires_at);

CREATE TABLE IF NOT EXISTS ngo_survey_rate_buckets (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ngo_survey_security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id UUID NOT NULL REFERENCES ngo_surveys(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ngo_survey_security_alerts_survey
  ON ngo_survey_security_alerts(survey_id, created_at DESC);

ALTER TABLE ngo_survey_otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_survey_participation_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_survey_rate_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_survey_security_alerts ENABLE ROW LEVEL SECURITY;

-- Lecture alertes par staff ONG de l'organisation
DROP POLICY IF EXISTS ngo_survey_security_alerts_read ON ngo_survey_security_alerts;
CREATE POLICY ngo_survey_security_alerts_read ON ngo_survey_security_alerts
  FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

-- ─── Paramètres sécurité (extension ngo_surveys settings) ───

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
    'anomaly_same_choice_zone_minutes', GREATEST(1, LEAST(60, COALESCE((o.settings->'ngo_surveys'->>'anomaly_same_choice_zone_minutes')::INTEGER, 5)))
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
        'anomaly_same_choice_zone_minutes', GREATEST(1, LEAST(60, COALESCE((p_settings->>'anomaly_same_choice_zone_minutes')::INTEGER, 5)))
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

-- ─── Rate limiting (fenêtre glissante 1 h) ───────────────────

CREATE OR REPLACE FUNCTION ngo_survey_rate_limit_check(
  p_bucket_key TEXT,
  p_limit INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row ngo_survey_rate_buckets%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_row FROM ngo_survey_rate_buckets WHERE bucket_key = p_bucket_key FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO ngo_survey_rate_buckets (bucket_key, count, window_start)
    VALUES (p_bucket_key, 1, v_now);
    RETURN jsonb_build_object('allowed', true, 'count', 1);
  END IF;

  IF v_row.window_start < v_now - interval '1 hour' THEN
    UPDATE ngo_survey_rate_buckets
    SET count = 1, window_start = v_now, updated_at = v_now
    WHERE bucket_key = p_bucket_key;
    RETURN jsonb_build_object('allowed', true, 'count', 1);
  END IF;

  IF v_row.count >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_row.count, 'retry_after_minutes',
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_row.window_start + interval '1 hour' - v_now)) / 60)::INTEGER));
  END IF;

  UPDATE ngo_survey_rate_buckets
  SET count = count + 1, updated_at = v_now
  WHERE bucket_key = p_bucket_key;

  RETURN jsonb_build_object('allowed', true, 'count', v_row.count + 1);
END;
$$;

-- ─── Verrou participation (appareil / téléphone) ─────────────

CREATE OR REPLACE FUNCTION ngo_survey_participation_locked(
  p_survey_id UUID,
  p_lock_type TEXT,
  p_lock_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ngo_survey_participation_locks
    WHERE survey_id = p_survey_id
      AND lock_type = p_lock_type
      AND lock_hash = p_lock_hash
      AND expires_at > now()
  );
$$;

-- ─── Soumission sécurisée ────────────────────────────────────

CREATE OR REPLACE FUNCTION submit_ngo_public_survey_response(
  p_token TEXT,
  p_answers JSONB,
  p_locality TEXT DEFAULT NULL,
  p_challenge_id UUID DEFAULT NULL,
  p_device_hash TEXT DEFAULT NULL,
  p_ip_hash TEXT DEFAULT NULL
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
  v_challenge ngo_survey_otp_challenges%ROWTYPE;
  v_phone_hash TEXT;
  v_phone_masked TEXT;
  v_device_lock_days INTEGER;
  v_response_id UUID;
  v_first_qid TEXT;
  v_first_answer TEXT;
  v_recent_count INTEGER;
  v_zone_count INTEGER;
  v_alert_threshold INTEGER;
  v_zone_threshold INTEGER;
  v_zone_minutes INTEGER;
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

  -- OTP obligatoire
  IF COALESCE((v_settings->>'require_phone_otp')::BOOLEAN, true) THEN
    IF p_challenge_id IS NULL THEN
      RETURN jsonb_build_object('error', 'Vérification téléphone requise');
    END IF;
    SELECT * INTO v_challenge FROM ngo_survey_otp_challenges
    WHERE id = p_challenge_id AND survey_id = v_survey.id;
    IF NOT FOUND OR v_challenge.verified_at IS NULL THEN
      RETURN jsonb_build_object('error', 'Code téléphone non vérifié ou expiré');
    END IF;
    IF v_challenge.verified_at < now() - interval '30 minutes' THEN
      RETURN jsonb_build_object('error', 'Session de vérification expirée — recommencez');
    END IF;
    IF ngo_survey_participation_locked(v_survey.id, 'phone', v_challenge.phone_hash) THEN
      RETURN jsonb_build_object('error', 'Ce numéro a déjà participé à ce sondage');
    END IF;
    v_phone_hash := v_challenge.phone_hash;
    v_phone_masked := regexp_replace(v_challenge.phone_e164, '(\d{3})\d+(\d{2})$', '\1*****\2');
  END IF;

  -- Un appareil = une participation
  IF COALESCE((v_settings->>'one_per_device')::BOOLEAN, true) AND p_device_hash IS NOT NULL AND trim(p_device_hash) <> '' THEN
    IF ngo_survey_participation_locked(v_survey.id, 'device', trim(p_device_hash)) THEN
      RETURN jsonb_build_object('error', 'Cet appareil a déjà participé à ce sondage');
    END IF;
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

  v_first_qid := COALESCE((SELECT elem->>'id' FROM jsonb_array_elements(v_questions) elem LIMIT 1), 'q1');
  v_first_answer := NULLIF(trim(p_answers->>v_first_qid), '');

  INSERT INTO ngo_survey_responses (
    organization_id, survey_id, agent_id, respondent_id, answers, locality,
    participant_phone_hash, device_hash, submission_ip_hash, synced_at, is_offline
  ) VALUES (
    v_survey.organization_id,
    v_survey.id,
    NULL,
    v_phone_masked,
    COALESCE(p_answers, '{}'::jsonb),
    NULLIF(trim(p_locality), ''),
    v_phone_hash,
    NULLIF(trim(p_device_hash), ''),
    NULLIF(trim(p_ip_hash), ''),
    now(),
    false
  )
  RETURNING id INTO v_response_id;

  v_device_lock_days := COALESCE((v_settings->>'device_lock_days')::INTEGER, 30);

  IF COALESCE((v_settings->>'one_per_device')::BOOLEAN, true) AND p_device_hash IS NOT NULL AND trim(p_device_hash) <> '' THEN
    INSERT INTO ngo_survey_participation_locks (organization_id, survey_id, lock_type, lock_hash, response_id, expires_at)
    VALUES (v_survey.organization_id, v_survey.id, 'device', trim(p_device_hash), v_response_id,
      now() + (v_device_lock_days || ' days')::interval)
    ON CONFLICT (survey_id, lock_type, lock_hash) DO NOTHING;
  END IF;

  IF v_phone_hash IS NOT NULL THEN
    INSERT INTO ngo_survey_participation_locks (organization_id, survey_id, lock_type, lock_hash, response_id, expires_at)
    VALUES (v_survey.organization_id, v_survey.id, 'phone', v_phone_hash, v_response_id,
      now() + (v_device_lock_days || ' days')::interval)
    ON CONFLICT (survey_id, lock_type, lock_hash) DO NOTHING;
  END IF;

  -- Détection d'anomalies
  v_alert_threshold := COALESCE((v_settings->>'anomaly_responses_per_minute')::INTEGER, 20);
  SELECT count(*)::INTEGER INTO v_recent_count
  FROM ngo_survey_responses
  WHERE survey_id = v_survey.id AND created_at > now() - interval '1 minute';

  IF v_recent_count > v_alert_threshold THEN
    INSERT INTO ngo_survey_security_alerts (organization_id, survey_id, alert_type, severity, details)
    VALUES (
      v_survey.organization_id, v_survey.id, 'spike_per_minute', 'critical',
      jsonb_build_object('count_last_minute', v_recent_count, 'threshold', v_alert_threshold)
    );
  END IF;

  v_zone_threshold := COALESCE((v_settings->>'anomaly_same_choice_zone_count')::INTEGER, 15);
  v_zone_minutes := COALESCE((v_settings->>'anomaly_same_choice_zone_minutes')::INTEGER, 5);

  IF v_first_answer IS NOT NULL AND NULLIF(trim(p_locality), '') IS NOT NULL THEN
    SELECT count(*)::INTEGER INTO v_zone_count
    FROM ngo_survey_responses
    WHERE survey_id = v_survey.id
      AND created_at > now() - (v_zone_minutes || ' minutes')::interval
      AND locality = trim(p_locality)
      AND answers->>v_first_qid = v_first_answer;

    IF v_zone_count > v_zone_threshold THEN
      INSERT INTO ngo_survey_security_alerts (organization_id, survey_id, alert_type, severity, details)
      VALUES (
        v_survey.organization_id, v_survey.id, 'same_choice_zone', 'warning',
        jsonb_build_object(
          'locality', trim(p_locality),
          'choice', v_first_answer,
          'count', v_zone_count,
          'window_minutes', v_zone_minutes,
          'threshold', v_zone_threshold
        )
      );
    END IF;
  END IF;

  IF COALESCE((v_settings->>'auto_close_when_target_reached')::BOOLEAN, false)
     AND v_survey.target_responses IS NOT NULL
     AND v_survey.status = 'active'
  THEN
    SELECT count(*) INTO v_count FROM ngo_survey_responses WHERE survey_id = v_survey.id;
    IF v_count >= v_survey.target_responses THEN
      UPDATE ngo_surveys SET status = 'closed', updated_at = now() WHERE id = v_survey.id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'response_id', v_response_id);
END;
$$;

-- ─── Lecture publique enrichie (paramètres sécurité) ─────────

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

-- Retire l'ancienne soumission non sécurisée (3 paramètres)
DROP FUNCTION IF EXISTS submit_ngo_public_survey_response(TEXT, JSONB, TEXT);

GRANT EXECUTE ON FUNCTION submit_ngo_public_survey_response(TEXT, JSONB, TEXT, UUID, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION ngo_survey_rate_limit_check(TEXT, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION ngo_survey_participation_locked(UUID, TEXT, TEXT) TO authenticated, anon;
