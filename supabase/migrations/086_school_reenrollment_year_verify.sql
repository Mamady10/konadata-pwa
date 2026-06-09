-- Vérification codes / matricules de réinscription pour l'année cible

CREATE OR REPLACE FUNCTION apply_to_school_as_learner(
  p_org_id UUID,
  p_study_level TEXT,
  p_department TEXT,
  p_program TEXT,
  p_class_id UUID DEFAULT NULL,
  p_request_type TEXT DEFAULT 'new',
  p_reenrollment_code TEXT DEFAULT NULL,
  p_academic_year TEXT DEFAULT '2025-2026',
  p_guardian_name TEXT DEFAULT NULL,
  p_guardian_phone TEXT DEFAULT NULL,
  p_guardian_relation TEXT DEFAULT NULL,
  p_guardian_sms_consent BOOLEAN DEFAULT false
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
  v_has_guardian BOOLEAN;
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

  IF p_request_type = 'reenrollment' THEN
    v_norm_code := upper(trim(COALESCE(p_reenrollment_code, '')));
    IF length(v_norm_code) < 4 THEN
      RETURN jsonb_build_object('error', 'Code ou matricule requis (min. 4 caractères)');
    END IF;

    SELECT id INTO v_code_id
    FROM school_reenrollment_codes
    WHERE organization_id = p_org_id
      AND upper(trim(code)) = v_norm_code
      AND is_active = true
      AND used_at IS NULL
      AND (academic_year IS NULL OR academic_year = p_academic_year);

    IF v_code_id IS NULL THEN
      SELECT id INTO v_code_id
      FROM school_reenrollment_codes
      WHERE organization_id = p_org_id
        AND upper(trim(COALESCE(matricule, ''))) = v_norm_code
        AND is_active = true
        AND used_at IS NULL
        AND (academic_year IS NULL OR academic_year = p_academic_year);
    END IF;

    IF v_code_id IS NOT NULL THEN
      v_verified := true;
    END IF;
  END IF;

  v_applicant_name := COALESCE(NULLIF(trim(v_profile.full_name), ''), split_part(v_profile.email, '@', 1));

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
  ELSIF p_class_id IS NOT NULL THEN
    UPDATE school_students
    SET class_id = p_class_id
    WHERE id = v_student_id;
  END IF;

  UPDATE profiles
  SET organization_id = p_org_id,
      role = CASE WHEN v_profile.role = 'student' THEN 'student' ELSE 'candidate' END,
      onboarding_path = 'learner'
  WHERE id = v_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_enrollments'
      AND column_name = 'request_type'
  ) INTO v_has_extended;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'school_enrollments'
      AND column_name = 'guardian_phone'
  ) INTO v_has_guardian;

  IF v_has_extended AND v_has_guardian THEN
    INSERT INTO school_enrollments (
      organization_id, student_id, class_id, academic_year, status,
      applicant_name, applicant_email, request_type, study_level, department, program,
      reenrollment_verification_code, reenrollment_code_verified, notes,
      guardian_name, guardian_phone, guardian_relation, guardian_sms_consent
    ) VALUES (
      p_org_id, v_student_id, p_class_id, p_academic_year, 'pending',
      v_applicant_name, v_profile.email, p_request_type, p_study_level, p_department, p_program,
      CASE WHEN p_request_type = 'reenrollment' THEN v_norm_code ELSE NULL END,
      v_verified,
      CASE WHEN p_request_type = 'reenrollment' THEN 'Réinscription' ELSE 'Nouvelle inscription' END,
      NULLIF(trim(p_guardian_name), ''),
      NULLIF(trim(p_guardian_phone), ''),
      NULLIF(trim(p_guardian_relation), ''),
      COALESCE(p_guardian_sms_consent, false)
    )
    RETURNING id INTO v_enrollment_id;
  ELSIF v_has_extended THEN
    INSERT INTO school_enrollments (
      organization_id, student_id, class_id, academic_year, status,
      applicant_name, applicant_email, request_type, study_level, department, program,
      reenrollment_verification_code, reenrollment_code_verified, notes
    ) VALUES (
      p_org_id, v_student_id, p_class_id, p_academic_year, 'pending',
      v_applicant_name, v_profile.email, p_request_type, p_study_level, p_department, p_program,
      CASE WHEN p_request_type = 'reenrollment' THEN v_norm_code ELSE NULL END,
      v_verified,
      CASE WHEN p_request_type = 'reenrollment' THEN 'Réinscription' ELSE 'Nouvelle inscription' END
    )
    RETURNING id INTO v_enrollment_id;
  ELSE
    INSERT INTO school_enrollments (
      organization_id, student_id, class_id, academic_year, status,
      applicant_name, applicant_email, notes
    ) VALUES (
      p_org_id, v_student_id, p_class_id, p_academic_year, 'pending',
      v_applicant_name, v_profile.email,
      CASE WHEN p_request_type = 'reenrollment' THEN 'Réinscription' ELSE 'Nouvelle inscription' END
    )
    RETURNING id INTO v_enrollment_id;
  END IF;

  IF v_code_id IS NOT NULL AND v_enrollment_id IS NOT NULL THEN
    UPDATE school_reenrollment_codes
    SET used_at = now(), used_by_enrollment_id = v_enrollment_id, is_active = false
    WHERE id = v_code_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'reenrollment_verified', v_verified
  );
END;
$$;

GRANT EXECUTE ON FUNCTION apply_to_school_as_learner(
  UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
) TO authenticated;
