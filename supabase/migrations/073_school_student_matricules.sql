-- Codes élève KonaData : génération atomique, paramètres établissement, cohérence import

-- ─── Slug classe pour préfixe matricule ───────────────────────
CREATE OR REPLACE FUNCTION school_class_matricule_slug(p_class_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v TEXT;
  v_digits TEXT;
  v_letter TEXT;
BEGIN
  v := upper(trim(regexp_replace(coalesce(p_class_name, ''), '\s+', ' ', 'g')));
  v := translate(v, 'ÉÈÊËÀÂÄÙÛÜÔÖÎÏÇ', 'EEEEAAAUUUOOIIC');
  v := regexp_replace(v, '^(CLASSE|CLASS|SALLE)\s+', '', 'i');

  IF v ~* 'TERMINALE?\s+([A-Z])' THEN
    RETURN 'T' || (regexp_match(v, 'TERMINALE?\s+([A-Z])', 'i'))[1];
  END IF;

  v_digits := (regexp_match(v, '(\d{1,2})'))[1];
  v_letter := (regexp_match(v, '\d{1,2}\s*(?:EME|E)?\s*([A-Z])', 'i'))[1];
  IF v_digits IS NOT NULL AND v_letter IS NOT NULL THEN
    RETURN v_digits || v_letter;
  END IF;

  v := regexp_replace(v, '[^A-Z0-9]', '', 'g');
  IF length(v) = 0 THEN
    RETURN 'CL';
  END IF;
  RETURN left(v, 8);
END;
$$;

-- ─── Année scolaire courte (26 pour 2025-2026) ────────────────
CREATE OR REPLACE FUNCTION school_matricule_year_short()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lpad((EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER % 100)::TEXT, 2, '0');
$$;

-- ─── Paramètres codes élève ───────────────────────────────────
CREATE OR REPLACE FUNCTION school_student_matricule_settings(p_org_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT settings->'student_matricules' FROM organizations WHERE id = p_org_id),
    '{}'::jsonb
  )
  || jsonb_build_object(
    'auto_generate_on_import', COALESCE(
      ((SELECT settings->'student_matricules' FROM organizations WHERE id = p_org_id)->>'auto_generate_on_import')::BOOLEAN,
      true
    ),
    'format', COALESCE(
      (SELECT settings->'student_matricules'->>'format' FROM organizations WHERE id = p_org_id),
      'class_year_seq'
    ),
    'org_prefix', (SELECT settings->'student_matricules'->>'org_prefix' FROM organizations WHERE id = p_org_id),
    'seq_pad', GREATEST(2, LEAST(5, COALESCE(
      ((SELECT settings->'student_matricules' FROM organizations WHERE id = p_org_id)->>'seq_pad')::INT,
      3
    ))),
    'display_label', COALESCE(
      nullif(trim((SELECT settings->'student_matricules'->>'display_label' FROM organizations WHERE id = p_org_id)), ''),
      'Code élève KonaData'
    ),
    'counters', COALESCE(
      (SELECT settings->'student_matricules'->'counters' FROM organizations WHERE id = p_org_id),
      '{}'::jsonb
    )
  );
$$;

CREATE OR REPLACE FUNCTION update_school_student_matricule_settings(
  p_org_id UUID,
  p_settings JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing JSONB;
  v_counters JSONB;
  v_format TEXT;
BEGIN
  IF NOT (
    (is_org_admin() AND belongs_to_org(p_org_id))
    OR is_platform_admin()
    OR (has_role('deputy_director', 'registrar') AND belongs_to_org(p_org_id))
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  v_existing := school_student_matricule_settings(p_org_id);
  v_counters := COALESCE(v_existing->'counters', '{}'::jsonb);

  v_format := COALESCE(nullif(trim(p_settings->>'format'), ''), 'class_year_seq');
  IF v_format NOT IN ('class_year_seq', 'org_year_seq') THEN
    v_format := 'class_year_seq';
  END IF;

  UPDATE organizations SET
    settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{student_matricules}',
      jsonb_build_object(
        'auto_generate_on_import', COALESCE((p_settings->>'auto_generate_on_import')::BOOLEAN, true),
        'format', v_format,
        'org_prefix', nullif(trim(p_settings->>'org_prefix'), ''),
        'seq_pad', GREATEST(2, LEAST(5, COALESCE((p_settings->>'seq_pad')::INT, 3))),
        'display_label', COALESCE(nullif(trim(p_settings->>'display_label'), ''), 'Code élève KonaData'),
        'counters', v_counters
      ),
      true
    )
  WHERE id = p_org_id AND type = 'school';

  RETURN school_student_matricule_settings(p_org_id);
END;
$$;

-- ─── Préfixe compteur (clé stable par classe/format) ───────────
CREATE OR REPLACE FUNCTION school_matricule_counter_key(
  p_org_id UUID,
  p_class_id UUID,
  p_settings JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
  v_class_name TEXT;
  v_year TEXT;
  v_slug TEXT;
  v_org_prefix TEXT;
BEGIN
  v_settings := COALESCE(p_settings, school_student_matricule_settings(p_org_id));
  v_year := school_matricule_year_short();

  IF COALESCE(v_settings->>'format', 'class_year_seq') = 'org_year_seq' THEN
    v_org_prefix := upper(regexp_replace(coalesce(v_settings->>'org_prefix', ''), '[^A-Za-z0-9\-]', '', 'g'));
    IF v_org_prefix IS NULL OR length(v_org_prefix) = 0 THEN
      SELECT upper(left(regexp_replace(coalesce(name, 'ORG'), '[^A-Za-z0-9]', '', 'g'), 6))
      INTO v_org_prefix
      FROM organizations WHERE id = p_org_id;
    END IF;
    RETURN v_org_prefix || '-' || v_year;
  END IF;

  SELECT name INTO v_class_name FROM school_classes WHERE id = p_class_id AND organization_id = p_org_id;
  v_slug := school_class_matricule_slug(v_class_name);
  RETURN v_slug || '-' || v_year;
END;
$$;

-- ─── Séquence max depuis matricules existants (rattrapage) ─────
CREATE OR REPLACE FUNCTION school_matricule_max_seq_for_key(
  p_org_id UUID,
  p_counter_key TEXT,
  p_seq_pad INT
)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INT := 0;
  v_row RECORD;
  v_suffix TEXT;
  v_num INT;
  v_pattern TEXT;
BEGIN
  v_pattern := '^' || regexp_replace(p_counter_key, '([.^$|*+?(){}\[\]\\])', '\\\1', 'g') || '-([0-9]+)$';

  FOR v_row IN
    SELECT matricule FROM school_students
    WHERE organization_id = p_org_id
      AND matricule IS NOT NULL
      AND trim(matricule) <> ''
  LOOP
    v_suffix := (regexp_match(upper(trim(v_row.matricule)), v_pattern, 'i'))[1];
    IF v_suffix IS NOT NULL THEN
      v_num := v_suffix::INT;
      IF v_num > v_max THEN v_max := v_num; END IF;
    END IF;
  END LOOP;

  RETURN v_max;
END;
$$;

-- ─── Allocation atomique (source de vérité) ────────────────────
CREATE OR REPLACE FUNCTION allocate_school_student_matricule(
  p_org_id UUID,
  p_class_id UUID,
  p_commit BOOLEAN DEFAULT true
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
  v_counter_key TEXT;
  v_seq_pad INT;
  v_counter INT;
  v_db_max INT;
  v_next INT;
  v_matricule TEXT;
  v_attempt INT := 0;
BEGIN
  IF NOT (belongs_to_org(p_org_id) OR is_platform_admin()) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  IF p_commit THEN
    PERFORM 1 FROM organizations WHERE id = p_org_id FOR UPDATE;
  END IF;

  v_settings := school_student_matricule_settings(p_org_id);
  v_counter_key := school_matricule_counter_key(p_org_id, p_class_id, v_settings);
  v_seq_pad := GREATEST(2, LEAST(5, COALESCE((v_settings->>'seq_pad')::INT, 3)));

  v_counter := COALESCE((v_settings->'counters'->>v_counter_key)::INT, 0);
  v_db_max := school_matricule_max_seq_for_key(p_org_id, v_counter_key, v_seq_pad);
  v_next := GREATEST(v_counter, v_db_max) + 1;

  LOOP
    v_matricule := v_counter_key || '-' || lpad(v_next::TEXT, v_seq_pad, '0');

    IF NOT EXISTS (
      SELECT 1 FROM school_students
      WHERE organization_id = p_org_id
        AND upper(trim(matricule)) = upper(trim(v_matricule))
    ) THEN
      EXIT;
    END IF;

    v_next := v_next + 1;
    v_attempt := v_attempt + 1;
    IF v_attempt > 500 THEN
      RAISE EXCEPTION 'Impossible d''allouer un matricule unique pour %', v_counter_key;
    END IF;
  END LOOP;

  IF p_commit THEN
    UPDATE organizations SET
      settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        ARRAY['student_matricules', 'counters', v_counter_key],
        to_jsonb(v_next)::jsonb,
        true
      )
    WHERE id = p_org_id;
  END IF;

  RETURN v_matricule;
END;
$$;

-- ─── Aperçu import (sans persister les compteurs) ─────────────
CREATE OR REPLACE FUNCTION preview_school_student_matricules(
  p_org_id UUID,
  p_class_id UUID,
  p_count INT
)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
  v_counter_key TEXT;
  v_seq_pad INT;
  v_counter INT;
  v_db_max INT;
  v_next INT;
  v_i INT;
  v_result TEXT[] := ARRAY[]::TEXT[];
  v_matricule TEXT;
  v_attempt INT;
BEGIN
  IF NOT (belongs_to_org(p_org_id) OR is_platform_admin()) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  IF p_count <= 0 THEN
    RETURN v_result;
  END IF;
  IF p_count > 500 THEN
    RAISE EXCEPTION 'Maximum 500 matricules par aperçu';
  END IF;

  v_settings := school_student_matricule_settings(p_org_id);
  v_counter_key := school_matricule_counter_key(p_org_id, p_class_id, v_settings);
  v_seq_pad := GREATEST(2, LEAST(5, COALESCE((v_settings->>'seq_pad')::INT, 3)));
  v_counter := COALESCE((v_settings->'counters'->>v_counter_key)::INT, 0);
  v_db_max := school_matricule_max_seq_for_key(p_org_id, v_counter_key, v_seq_pad);
  v_next := GREATEST(v_counter, v_db_max) + 1;

  FOR v_i IN 1..p_count LOOP
    v_attempt := 0;
    LOOP
      v_matricule := v_counter_key || '-' || lpad(v_next::TEXT, v_seq_pad, '0');
      IF NOT EXISTS (
        SELECT 1 FROM school_students
        WHERE organization_id = p_org_id
          AND upper(trim(matricule)) = upper(trim(v_matricule))
      ) AND NOT (v_matricule = ANY (v_result)) THEN
        v_result := array_append(v_result, v_matricule);
        v_next := v_next + 1;
        EXIT;
      END IF;
      v_next := v_next + 1;
      v_attempt := v_attempt + 1;
      IF v_attempt > 500 THEN
        RAISE EXCEPTION 'Impossible de prévisualiser les matricules pour %', v_counter_key;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_result;
END;
$$;

-- ─── Normalisation nom (rapprochement import sans matricule) ──
CREATE OR REPLACE FUNCTION school_normalize_person_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(trim(regexp_replace(
    translate(coalesce(p_name, ''), 'ÉÈÊËÀÂÄÙÛÜÔÖÎÏÇ', 'EEEEAAAUUUOOIIC'),
    '\s+', ' ', 'g'
  )));
$$;

GRANT EXECUTE ON FUNCTION school_student_matricule_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_school_student_matricule_settings(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION preview_school_student_matricules(UUID, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION allocate_school_student_matricule(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION school_matricule_counter_key(UUID, UUID, JSONB) TO authenticated;
