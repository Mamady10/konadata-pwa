-- Complétude notes + archivage PDF bulletin + historique tuteur

ALTER TABLE school_report_cards
  ADD COLUMN IF NOT EXISTS grades_completeness_pct SMALLINT,
  ADD COLUMN IF NOT EXISTS archived_pdf_at TIMESTAMPTZ;

COMMENT ON COLUMN school_report_cards.grades_completeness_pct IS
  'Pourcentage de cases notes remplies (évaluations attendues × élève).';
COMMENT ON COLUMN school_report_cards.archived_pdf_at IS
  'Horodatage archivage PDF définitif (file_path).';

CREATE OR REPLACE FUNCTION school_guardian_portal_payload(p_org_id UUID, p_student_id UUID)
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
  v_class_name TEXT;
  v_status_label TEXT;
  v_balance JSONB;
  v_bulletin JSONB;
  v_bulletin_history JSONB;
BEGIN
  SELECT * INTO v_student
  FROM school_students
  WHERE id = p_student_id AND organization_id = p_org_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Élève introuvable');
  END IF;

  SELECT * INTO v_person FROM core_persons WHERE id = v_student.person_id;

  SELECT * INTO v_enrollment
  FROM school_enrollments
  WHERE student_id = v_student.id
    AND status IN ('admitted', 'enrolled', 'pending')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Aucune inscription active');
  END IF;

  SELECT name INTO v_class_name
  FROM school_classes
  WHERE id = v_student.class_id;

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
    'generated_at', rc.generated_at,
    'has_archived_pdf', rc.file_path IS NOT NULL
  ) INTO v_bulletin
  FROM school_report_cards rc
  WHERE rc.student_id = v_student.id
    AND rc.organization_id = p_org_id
    AND rc.publication_status = 'final'
  ORDER BY rc.generated_at DESC
  LIMIT 1;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.generated_at DESC), '[]'::jsonb)
  INTO v_bulletin_history
  FROM (
    SELECT
      rc.id,
      rc.semester,
      rc.academic_year,
      rc.average_score,
      rc.rank,
      rc.publication_status,
      rc.generated_at,
      (rc.file_path IS NOT NULL) AS has_archived_pdf
    FROM school_report_cards rc
    WHERE rc.student_id = v_student.id
      AND rc.organization_id = p_org_id
      AND rc.publication_status = 'final'
    ORDER BY rc.generated_at DESC
    LIMIT 12
  ) t;

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
    'bulletin_history', v_bulletin_history,
    'payment_url', '/payer-scolarite',
    'portal_url', '/suivi-scolarite'
  );
END;
$$;
