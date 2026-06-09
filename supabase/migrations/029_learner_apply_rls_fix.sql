-- Permet l'enregistrement candidat même si le RPC ou les inserts directs sont utilisés.

-- Colonne optionnelle (si 027 pas appliquée en entier)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS accepts_student_applications BOOLEAN NOT NULL DEFAULT true;

-- RLS : le candidat peut créer sa fiche personne / élève
DROP POLICY IF EXISTS core_persons_insert_own_profile ON core_persons;
CREATE POLICY core_persons_insert_own_profile ON core_persons FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS school_students_insert_own ON school_students;
CREATE POLICY school_students_insert_own ON school_students FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM core_persons cp
      WHERE cp.id = person_id AND cp.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS school_students_update_own ON school_students;
CREATE POLICY school_students_update_own ON school_students FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM core_persons cp
      WHERE cp.id = person_id AND cp.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM core_persons cp
      WHERE cp.id = person_id AND cp.profile_id = auth.uid()
    )
  );

-- RPC plus tolérant (colonnes 027 optionnelles)
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
  v_has_extended BOOLEAN;
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
  ) THEN
    RETURN jsonb_build_object('error', 'Établissement introuvable ou inactif');
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
    BEGIN
      SELECT id INTO v_code_id
      FROM school_reenrollment_codes
      WHERE organization_id = p_org_id
        AND upper(trim(code)) = v_norm_code
        AND is_active = true
        AND used_at IS NULL;
      IF v_code_id IS NOT NULL THEN
        v_verified := true;
      END IF;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END IF;

  v_applicant_name := COALESCE(NULLIF(trim(v_profile.full_name), ''), split_part(v_profile.email, '@', 1));

  UPDATE profiles
  SET organization_id = p_org_id,
      role = 'candidate',
      onboarding_path = COALESCE(onboarding_path, 'learner')
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

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_enrollments'
      AND column_name = 'request_type'
  ) INTO v_has_extended;

  IF v_has_extended THEN
    INSERT INTO school_enrollments (
      organization_id, student_id, class_id, academic_year, status,
      applicant_name, applicant_email, request_type, study_level, department, program,
      reenrollment_verification_code, reenrollment_code_verified, notes
    ) VALUES (
      p_org_id, v_student_id, p_class_id,
      COALESCE(NULLIF(trim(p_academic_year), ''), '2025-2026'),
      'pending', v_applicant_name, v_profile.email, p_request_type,
      NULLIF(trim(p_study_level), ''), NULLIF(trim(p_department), ''),
      NULLIF(trim(p_program), ''),
      CASE WHEN p_request_type = 'reenrollment' THEN upper(trim(p_reenrollment_code)) ELSE NULL END,
      v_verified,
      CASE WHEN p_request_type = 'reenrollment' THEN 'Réinscription' ELSE 'Nouvelle inscription' END
    )
    RETURNING id INTO v_enrollment_id;
  ELSE
    INSERT INTO school_enrollments (
      organization_id, student_id, class_id, academic_year, status,
      applicant_name, applicant_email, notes
    ) VALUES (
      p_org_id, v_student_id, p_class_id,
      COALESCE(NULLIF(trim(p_academic_year), ''), '2025-2026'),
      'pending', v_applicant_name, v_profile.email,
      CASE WHEN p_request_type = 'reenrollment' THEN 'Réinscription' ELSE 'Nouvelle inscription' END
    )
    RETURNING id INTO v_enrollment_id;
  END IF;

  IF v_code_id IS NOT NULL THEN
    UPDATE school_reenrollment_codes
    SET used_at = now(), used_by_enrollment_id = v_enrollment_id, is_active = false
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
