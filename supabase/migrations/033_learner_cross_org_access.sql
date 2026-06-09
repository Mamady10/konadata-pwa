-- Candidat / élève : voir ses dossiers sur tous les établissements (pas seulement organization_id du profil).

CREATE OR REPLACE FUNCTION learner_has_enrollment_history()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM school_enrollments e
    INNER JOIN school_students ss ON ss.id = e.student_id
    INNER JOIN core_persons cp ON cp.id = ss.person_id
    WHERE cp.profile_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION learner_has_enrollment_history() TO authenticated;

DROP POLICY IF EXISTS school_enrollments_select ON school_enrollments;
CREATE POLICY school_enrollments_select ON school_enrollments FOR SELECT TO authenticated
  USING (
    is_school_org()
    AND (
      (belongs_to_org(organization_id) AND is_school_staff())
      OR (
        is_school_student_or_candidate()
        AND student_id IS NOT NULL
        AND owns_school_student(student_id)
      )
    )
  );

DROP POLICY IF EXISTS school_students_select ON school_students;
CREATE POLICY school_students_select ON school_students FOR SELECT TO authenticated
  USING (
    is_school_org()
    AND (
      (
        belongs_to_org(organization_id)
        AND (
          (is_school_staff() AND NOT has_role('teacher'))
          OR (
            has_role('teacher')
            AND class_id IS NOT NULL
            AND teacher_has_class_assignment(class_id)
          )
        )
      )
      OR (is_school_student_or_candidate() AND owns_school_student(id))
    )
  );

DROP POLICY IF EXISTS school_student_docs_learner ON school_student_documents;
CREATE POLICY school_student_docs_learner ON school_student_documents FOR ALL TO authenticated
  USING (
    is_school_org()
    AND is_school_student_or_candidate()
    AND student_id IS NOT NULL
    AND owns_school_student(student_id)
  )
  WITH CHECK (
    is_school_org()
    AND is_school_student_or_candidate()
    AND student_id IS NOT NULL
    AND owns_school_student(student_id)
  );
