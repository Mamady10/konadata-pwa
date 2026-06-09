-- OTP SMS pour le portail tuteur /suivi-scolarite

CREATE TABLE IF NOT EXISTS school_guardian_portal_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  ip_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_guardian_portal_otp_student
  ON school_guardian_portal_otp_challenges(student_id, created_at DESC);

CREATE OR REPLACE FUNCTION resolve_school_student_by_matricule(
  p_org_id UUID,
  p_matricule TEXT
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT ss.id INTO v_id
  FROM school_students ss
  WHERE ss.organization_id = p_org_id
    AND upper(trim(ss.matricule)) = upper(trim(p_matricule))
  LIMIT 1;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION school_guardian_portal_payload(
  p_org_id UUID,
  p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student school_students%ROWTYPE;
  v_person core_persons%ROWTYPE;
  v_enrollment school_enrollments%ROWTYPE;
  v_balance JSONB;
  v_bulletin JSONB;
  v_class_name TEXT;
  v_status_label TEXT;
BEGIN
  SELECT * INTO v_student
  FROM school_students
  WHERE id = p_student_id AND organization_id = p_org_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Élève introuvable');
  END IF;

  SELECT * INTO v_person FROM core_persons WHERE id = v_student.person_id;

  SELECT e.* INTO v_enrollment
  FROM school_enrollments e
  WHERE e.student_id = v_student.id
  ORDER BY e.created_at DESC
  LIMIT 1;

  SELECT name INTO v_class_name FROM school_classes WHERE id = v_student.class_id;

  v_status_label := CASE v_student.enrollment_status
    WHEN 'enrolled' THEN 'Inscrit'
    WHEN 'admitted' THEN 'Admis'
    WHEN 'pending' THEN 'En attente'
    WHEN 'rejected' THEN 'Refusé'
    ELSE coalesce(v_student.enrollment_status::TEXT, '—')
  END;

  v_balance := school_tuition_balance(v_student.id, v_enrollment.id, NULL);

  SELECT jsonb_build_object(
    'id', rc.id,
    'semester', rc.semester,
    'academic_year', rc.academic_year,
    'average_score', rc.average_score,
    'rank', rc.rank,
    'publication_status', rc.publication_status,
    'generated_at', rc.generated_at
  ) INTO v_bulletin
  FROM school_report_cards rc
  WHERE rc.student_id = v_student.id
    AND rc.organization_id = p_org_id
  ORDER BY
    CASE WHEN rc.publication_status = 'final' THEN 0 ELSE 1 END,
    rc.generated_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'student_id', v_student.id,
    'enrollment_id', v_enrollment.id,
    'student_name', coalesce(v_person.full_name, v_enrollment.applicant_name, 'Élève'),
    'matricule', v_student.matricule,
    'class_name', v_class_name,
    'enrollment_status', v_student.enrollment_status,
    'enrollment_status_label', v_status_label,
    'enrollment_request_status', v_enrollment.status,
    'academic_year', coalesce(v_enrollment.academic_year, '2025-2026'),
    'balance', v_balance,
    'latest_bulletin', v_bulletin,
    'payment_url', '/payer-scolarite',
    'portal_url', '/suivi-scolarite'
  );
END;
$$;

CREATE OR REPLACE FUNCTION lookup_guardian_school_portal_by_challenge(p_challenge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge school_guardian_portal_otp_challenges%ROWTYPE;
  v_payload JSONB;
BEGIN
  SELECT * INTO v_challenge
  FROM school_guardian_portal_otp_challenges
  WHERE id = p_challenge_id;

  IF NOT FOUND OR v_challenge.verified_at IS NULL THEN
    RETURN jsonb_build_object('error', 'Vérification par SMS requise');
  END IF;

  IF v_challenge.verified_at < now() - interval '30 minutes' THEN
    RETURN jsonb_build_object('error', 'Session expirée — demandez un nouveau code SMS');
  END IF;

  v_payload := school_guardian_portal_payload(v_challenge.organization_id, v_challenge.student_id);
  IF v_payload ? 'error' THEN
    RETURN v_payload;
  END IF;

  RETURN v_payload || jsonb_build_object('challenge_id', p_challenge_id);
END;
$$;

CREATE OR REPLACE FUNCTION assert_guardian_portal_challenge(
  p_challenge_id UUID,
  p_student_id UUID DEFAULT NULL,
  p_report_card_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge school_guardian_portal_otp_challenges%ROWTYPE;
BEGIN
  SELECT * INTO v_challenge
  FROM school_guardian_portal_otp_challenges
  WHERE id = p_challenge_id;

  IF NOT FOUND OR v_challenge.verified_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vérification par SMS requise');
  END IF;

  IF v_challenge.verified_at < now() - interval '30 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Session expirée — demandez un nouveau code SMS');
  END IF;

  IF p_student_id IS NOT NULL AND v_challenge.student_id <> p_student_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Accès refusé');
  END IF;

  IF p_report_card_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM school_report_cards
      WHERE id = p_report_card_id
        AND student_id = v_challenge.student_id
        AND organization_id = v_challenge.organization_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Bulletin non accessible');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'organization_id', v_challenge.organization_id,
    'student_id', v_challenge.student_id
  );
END;
$$;

-- Ancienne entrée directe : OTP obligatoire
CREATE OR REPLACE FUNCTION lookup_guardian_school_portal(
  p_org_id UUID,
  p_matricule TEXT,
  p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'error',
    'Confirmez votre accès par code SMS sur la page Suivi scolarité'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_school_student_by_matricule(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION school_guardian_portal_payload(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION lookup_guardian_school_portal_by_challenge(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION assert_guardian_portal_challenge(UUID, UUID, UUID) TO authenticated, anon;
