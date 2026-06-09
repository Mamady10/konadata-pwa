-- Inscription candidat/élève sans code d'invitation : choix établissement, filière, réinscription.

-- ─── Organisations : candidatures en ligne ─────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS accepts_student_applications BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN organizations.accepts_student_applications IS
  'Si true, l''établissement apparaît dans la liste publique d''inscription élève/candidat.';

-- ─── Classes : département & filière ─────────────────────────────
ALTER TABLE school_classes
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS program TEXT;

COMMENT ON COLUMN school_classes.department IS 'Département / pôle (ex. Sciences)';
COMMENT ON COLUMN school_classes.program IS 'Filière / spécialité (ex. Informatique)';

-- ─── Dossiers d''inscription enrichis ─────────────────────────────
ALTER TABLE school_enrollments
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'new'
    CHECK (request_type IN ('new', 'reenrollment')),
  ADD COLUMN IF NOT EXISTS study_level TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS program TEXT,
  ADD COLUMN IF NOT EXISTS reenrollment_verification_code TEXT,
  ADD COLUMN IF NOT EXISTS reenrollment_code_verified BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN school_enrollments.reenrollment_verification_code IS
  'Code fourni par l''établissement (ancienne base) pour réinscription.';
COMMENT ON COLUMN school_enrollments.reenrollment_code_verified IS
  'True si le code correspond à un code actif pré-enregistré par la scolarité.';

-- ─── Codes de réinscription (générés par l''établissement) ───────
CREATE TABLE IF NOT EXISTS school_reenrollment_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  legacy_reference TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  used_at         TIMESTAMPTZ,
  used_by_enrollment_id UUID REFERENCES school_enrollments(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_reenrollment_codes_org_code UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_school_reenrollment_codes_org
  ON school_reenrollment_codes(organization_id);

ALTER TABLE school_reenrollment_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_reenrollment_codes_staff ON school_reenrollment_codes;
CREATE POLICY school_reenrollment_codes_staff ON school_reenrollment_codes
  FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND is_school_staff())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND is_school_staff());

-- ─── RLS : candidat gère son dossier ───────────────────────────
DROP POLICY IF EXISTS school_enrollments_select ON school_enrollments;
CREATE POLICY school_enrollments_select ON school_enrollments FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (
      is_school_staff()
      OR (is_school_student_or_candidate() AND owns_school_student(student_id))
    )
  );

DROP POLICY IF EXISTS school_enrollments_write ON school_enrollments;
CREATE POLICY school_enrollments_insert_staff ON school_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic()
  );

CREATE POLICY school_enrollments_insert_learner ON school_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id) AND is_school_org()
    AND is_school_student_or_candidate()
    AND owns_school_student(student_id)
  );

CREATE POLICY school_enrollments_update_staff ON school_enrollments FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

CREATE POLICY school_enrollments_update_learner ON school_enrollments FOR UPDATE TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND is_school_student_or_candidate() AND owns_school_student(student_id)
  )
  WITH CHECK (
    belongs_to_org(organization_id) AND is_school_org()
    AND is_school_student_or_candidate() AND owns_school_student(student_id)
  );

DROP POLICY IF EXISTS school_student_docs_all ON school_student_documents;
CREATE POLICY school_student_docs_staff ON school_student_documents FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND is_school_staff())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND is_school_staff());

CREATE POLICY school_student_docs_learner ON school_student_documents FOR ALL TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND is_school_student_or_candidate() AND owns_school_student(student_id)
  )
  WITH CHECK (
    belongs_to_org(organization_id) AND is_school_org()
    AND is_school_student_or_candidate() AND owns_school_student(student_id)
  );

-- ─── Liste publique des établissements ───────────────────────────
CREATE OR REPLACE FUNCTION list_public_schools()
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  city TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.email,
    COALESCE(o.settings->>'city', '')::TEXT AS city
  FROM organizations o
  WHERE o.type = 'school'
    AND o.is_active = true
    AND o.accepts_student_applications = true
  ORDER BY o.name;
$$;

GRANT EXECUTE ON FUNCTION list_public_schools() TO anon, authenticated;

-- ─── Catalogue niveau / département / filière / classes ──────────
CREATE OR REPLACE FUNCTION get_school_application_catalog(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok BOOLEAN;
  v_result JSONB;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = p_org_id
      AND o.type = 'school'
      AND o.is_active = true
      AND o.accepts_student_applications = true
  ) INTO v_ok;

  IF NOT v_ok THEN
    RETURN jsonb_build_object('error', 'Établissement introuvable ou non ouvert aux candidatures');
  END IF;

  SELECT jsonb_build_object(
    'levels', COALESCE((
      SELECT jsonb_agg(DISTINCT trim(level) ORDER BY trim(level))
      FROM school_classes
      WHERE organization_id = p_org_id AND is_active = true AND level IS NOT NULL AND trim(level) <> ''
    ), '[]'::jsonb),
    'departments', COALESCE((
      SELECT jsonb_agg(DISTINCT trim(department) ORDER BY trim(department))
      FROM school_classes
      WHERE organization_id = p_org_id AND is_active = true AND department IS NOT NULL AND trim(department) <> ''
    ), '[]'::jsonb),
    'programs', COALESCE((
      SELECT jsonb_agg(DISTINCT trim(program) ORDER BY trim(program))
      FROM school_classes
      WHERE organization_id = p_org_id AND is_active = true AND program IS NOT NULL AND trim(program) <> ''
    ), '[]'::jsonb),
    'classes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'level', c.level,
        'department', c.department,
        'program', c.program,
        'academic_year', c.academic_year
      ) ORDER BY c.name)
      FROM school_classes c
      WHERE c.organization_id = p_org_id AND c.is_active = true
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_school_application_catalog(UUID) TO anon, authenticated;

-- ─── Rattachement candidat → établissement + dossier ─────────────
CREATE OR REPLACE FUNCTION apply_to_school_as_learner(
  p_org_id UUID,
  p_study_level TEXT,
  p_department TEXT,
  p_program TEXT,
  p_class_id UUID DEFAULT NULL,
  p_request_type TEXT DEFAULT 'new',
  p_reenrollment_code TEXT DEFAULT NULL,
  p_academic_year TEXT DEFAULT '2025-2026'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_person_id UUID;
  v_student_id UUID;
  v_enrollment_id UUID;
  v_code_id UUID;
  v_verified BOOLEAN := false;
  v_norm_code TEXT;
  v_applicant_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Non authentifié');
  END IF;

  IF p_request_type NOT IN ('new', 'reenrollment') THEN
    RETURN jsonb_build_object('error', 'Type de demande invalide');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = p_org_id AND o.type = 'school' AND o.is_active = true
      AND o.accepts_student_applications = true
  ) THEN
    RETURN jsonb_build_object('error', 'Établissement non disponible pour les candidatures');
  END IF;

  SELECT id, full_name, email, organization_id, role
  INTO v_profile
  FROM profiles
  WHERE id = v_user_id;

  IF v_profile.organization_id IS NOT NULL AND v_profile.organization_id <> p_org_id THEN
    RETURN jsonb_build_object('error', 'Vous êtes déjà rattaché à un autre établissement');
  END IF;

  IF p_request_type = 'reenrollment' THEN
    v_norm_code := upper(trim(COALESCE(p_reenrollment_code, '')));
    IF length(v_norm_code) < 4 THEN
      RETURN jsonb_build_object('error', 'Code de réinscription requis (min. 4 caractères)');
    END IF;
    SELECT id INTO v_code_id
    FROM school_reenrollment_codes
    WHERE organization_id = p_org_id
      AND upper(trim(code)) = v_norm_code
      AND is_active = true
      AND used_at IS NULL;
    IF v_code_id IS NOT NULL THEN
      v_verified := true;
    END IF;
  END IF;

  v_applicant_name := COALESCE(NULLIF(trim(v_profile.full_name), ''), split_part(v_profile.email, '@', 1));

  UPDATE profiles
  SET organization_id = p_org_id,
      role = 'candidate'
  WHERE id = v_user_id;

  SELECT id INTO v_person_id
  FROM core_persons
  WHERE profile_id = v_user_id AND organization_id = p_org_id
  LIMIT 1;

  IF v_person_id IS NULL THEN
    INSERT INTO core_persons (
      organization_id, profile_id, kind, full_name, email
    ) VALUES (
      p_org_id, v_user_id, 'candidate', v_applicant_name, v_profile.email
    )
    RETURNING id INTO v_person_id;
  END IF;

  SELECT id INTO v_student_id
  FROM school_students
  WHERE person_id = v_person_id AND organization_id = p_org_id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    INSERT INTO school_students (organization_id, person_id, class_id, enrollment_status)
    VALUES (p_org_id, v_person_id, p_class_id, 'pending')
    RETURNING id INTO v_student_id;
  ELSE
    UPDATE school_students
    SET class_id = COALESCE(p_class_id, class_id),
        enrollment_status = 'pending'
    WHERE id = v_student_id;
  END IF;

  INSERT INTO school_enrollments (
    organization_id,
    student_id,
    class_id,
    academic_year,
    status,
    applicant_name,
    applicant_email,
    request_type,
    study_level,
    department,
    program,
    reenrollment_verification_code,
    reenrollment_code_verified,
    notes
  ) VALUES (
    p_org_id,
    v_student_id,
    p_class_id,
    COALESCE(NULLIF(trim(p_academic_year), ''), '2025-2026'),
    'pending',
    v_applicant_name,
    v_profile.email,
    p_request_type,
    NULLIF(trim(p_study_level), ''),
    NULLIF(trim(p_department), ''),
    NULLIF(trim(p_program), ''),
    CASE WHEN p_request_type = 'reenrollment' THEN upper(trim(p_reenrollment_code)) ELSE NULL END,
    v_verified,
    CASE WHEN p_request_type = 'reenrollment' THEN 'Réinscription' ELSE 'Nouvelle inscription' END
  )
  RETURNING id INTO v_enrollment_id;

  IF v_code_id IS NOT NULL THEN
    UPDATE school_reenrollment_codes
    SET used_at = now(),
        used_by_enrollment_id = v_enrollment_id,
        is_active = false
    WHERE id = v_code_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'student_id', v_student_id,
    'reenrollment_verified', v_verified
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION apply_to_school_as_learner(
  UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT
) TO authenticated;
