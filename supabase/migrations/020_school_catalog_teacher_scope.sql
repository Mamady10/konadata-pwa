-- ============================================================
-- KonaData — Catalogue pédagogique : pas d'écriture enseignant
-- Lecture classes filtrée par assignation ; notes par classe assignée
-- ============================================================

CREATE OR REPLACE FUNCTION can_manage_school_catalog()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director', 'registrar')
$$;

GRANT EXECUTE ON FUNCTION can_manage_school_catalog() TO authenticated;

CREATE OR REPLACE FUNCTION can_write_school_academic()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(
    'platform_admin', 'org_admin', 'deputy_director',
    'registrar'
  )
$$;

CREATE OR REPLACE FUNCTION teacher_can_grade_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_org_admin()
    OR (
      has_role('teacher')
      AND is_assigned_to_school_class(p_class_id)
    )
$$;

GRANT EXECUTE ON FUNCTION teacher_can_grade_class(UUID) TO authenticated;

-- ─── Classes : lecture filtrée pour enseignants ─────────────────

DROP POLICY IF EXISTS school_classes_select ON school_classes;
DROP POLICY IF EXISTS school_classes_write ON school_classes;

CREATE POLICY school_classes_select ON school_classes FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (
      NOT has_role('teacher')
      OR is_org_admin()
      OR is_assigned_to_school_class(id)
    )
  );

CREATE POLICY school_classes_insert ON school_classes FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id) AND is_school_org() AND can_manage_school_catalog()
  );

CREATE POLICY school_classes_update ON school_classes FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_manage_school_catalog())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_manage_school_catalog());

CREATE POLICY school_classes_delete ON school_classes FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_manage_school_catalog());

-- ─── Matières : écriture catalogue uniquement ────────────────────

DROP POLICY IF EXISTS school_subjects_select ON school_subjects;
DROP POLICY IF EXISTS school_subjects_write ON school_subjects;

CREATE POLICY school_subjects_select ON school_subjects FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org());

CREATE POLICY school_subjects_insert ON school_subjects FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id) AND is_school_org() AND can_manage_school_catalog()
  );

CREATE POLICY school_subjects_update ON school_subjects FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_manage_school_catalog())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_manage_school_catalog());

CREATE POLICY school_subjects_delete ON school_subjects FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_manage_school_catalog());

-- ─── Élèves : enseignant = classes assignées seulement ───────────

DROP POLICY IF EXISTS school_students_select ON school_students;

CREATE POLICY school_students_select ON school_students FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (
      owns_school_student(id)
      OR (
        is_school_staff()
        AND NOT has_role('teacher')
      )
      OR (
        has_role('teacher')
        AND class_id IS NOT NULL
        AND is_assigned_to_school_class(class_id)
      )
    )
  );

-- ─── Notes : saisie si classe assignée (sans exiger can_import) ───

DROP POLICY IF EXISTS school_grades_select ON school_grades;
DROP POLICY IF EXISTS school_grades_write ON school_grades;
DROP POLICY IF EXISTS school_grades_update ON school_grades;

CREATE POLICY school_grades_select ON school_grades FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (
      is_org_admin()
      OR owns_school_student(student_id)
      OR (
        has_role('teacher')
        AND class_id IS NOT NULL
        AND teacher_can_grade_class(class_id)
      )
      OR (
        has_role('registrar', 'accountant')
        AND is_school_staff()
      )
    )
  );

CREATE POLICY school_grades_write ON school_grades FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id) AND is_school_org()
    AND (
      is_org_admin()
      OR (
        has_role('teacher')
        AND class_id IS NOT NULL
        AND teacher_can_grade_class(class_id)
      )
    )
  );

CREATE POLICY school_grades_update ON school_grades FOR UPDATE TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (
      is_org_admin()
      OR (
        has_role('teacher')
        AND class_id IS NOT NULL
        AND teacher_can_grade_class(class_id)
      )
    )
  )
  WITH CHECK (
    belongs_to_org(organization_id) AND is_school_org()
    AND (
      is_org_admin()
      OR (
        has_role('teacher')
        AND class_id IS NOT NULL
        AND teacher_can_grade_class(class_id)
      )
    )
  );
