-- P0 établissement : bulletins provisoires/définitifs, portail tuteur, paramètres scolarité

ALTER TABLE school_report_cards
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS appreciation TEXT,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_report_cards_publication_status_check'
  ) THEN
    ALTER TABLE school_report_cards
      ADD CONSTRAINT school_report_cards_publication_status_check
      CHECK (publication_status IN ('draft', 'final'));
  END IF;
END $$;

COMMENT ON COLUMN school_report_cards.publication_status IS 'draft = provisoire, final = définitif verrouillé';
COMMENT ON COLUMN school_report_cards.locked_at IS 'Horodatage verrouillage bulletin définitif';

CREATE INDEX IF NOT EXISTS idx_school_report_cards_class_period
  ON school_report_cards (organization_id, class_id, semester, academic_year);

-- ─── Portail tuteur /suivi-scolarite ───────────────────────────
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
DECLARE
  v_student school_students%ROWTYPE;
  v_person core_persons%ROWTYPE;
  v_enrollment school_enrollments%ROWTYPE;
  v_balance JSONB;
  v_bulletin JSONB;
  v_phone_norm TEXT;
  v_class_name TEXT;
  v_status_label TEXT;
BEGIN
  v_phone_norm := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');

  SELECT ss.* INTO v_student
  FROM school_students ss
  WHERE ss.organization_id = p_org_id
    AND upper(trim(ss.matricule)) = upper(trim(p_matricule))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Matricule introuvable pour cet établissement');
  END IF;

  SELECT * INTO v_person FROM core_persons WHERE id = v_student.person_id;

  SELECT e.* INTO v_enrollment
  FROM school_enrollments e
  WHERE e.student_id = v_student.id
  ORDER BY e.created_at DESC
  LIMIT 1;

  IF v_enrollment.id IS NOT NULL THEN
    IF NOT (
      (v_enrollment.guardian_phone IS NOT NULL AND regexp_replace(v_enrollment.guardian_phone, '[^0-9+]', '', 'g') = v_phone_norm)
      OR (v_enrollment.applicant_phone IS NOT NULL AND regexp_replace(v_enrollment.applicant_phone, '[^0-9+]', '', 'g') = v_phone_norm)
      OR (v_person.phone IS NOT NULL AND regexp_replace(v_person.phone, '[^0-9+]', '', 'g') = v_phone_norm)
    ) THEN
      RETURN jsonb_build_object('error', 'Numéro de téléphone non reconnu pour ce dossier');
    END IF;
  ELSIF v_person.phone IS NULL OR regexp_replace(v_person.phone, '[^0-9+]', '', 'g') <> v_phone_norm THEN
    RETURN jsonb_build_object('error', 'Numéro de téléphone non reconnu');
  END IF;

  SELECT name INTO v_class_name FROM school_classes WHERE id = v_student.class_id;

  v_status_label := CASE v_student.enrollment_status
    WHEN 'enrolled' THEN 'Inscrit'
    WHEN 'admitted' THEN 'Admis'
    WHEN 'pending' THEN 'En attente'
    WHEN 'rejected' THEN 'Refusé'
    ELSE coalesce(v_student.enrollment_status, '—')
  END;

  v_balance := school_tuition_balance(
    v_student.id,
    v_enrollment.id,
    NULL
  );

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

GRANT EXECUTE ON FUNCTION lookup_guardian_school_portal(UUID, TEXT, TEXT) TO authenticated, anon;
