-- ============================================================
-- KonaData — Enseignement : professeur ↔ classe ↔ matière
-- ============================================================

CREATE TABLE school_teaching_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES school_subjects(id) ON DELETE CASCADE,
  assigned_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_teaching_assignments_unique
    UNIQUE (profile_id, class_id, subject_id)
);

CREATE INDEX idx_school_teaching_org ON school_teaching_assignments (organization_id);
CREATE INDEX idx_school_teaching_profile ON school_teaching_assignments (profile_id);
CREATE INDEX idx_school_teaching_class ON school_teaching_assignments (class_id, subject_id);

COMMENT ON TABLE school_teaching_assignments IS
  'Périmètre pédagogique : quelle matière un enseignant enseigne dans quelle classe.';

-- Reprise des assignations « classe seule » : une ligne par matière de l''établissement
INSERT INTO school_teaching_assignments (organization_id, profile_id, class_id, subject_id, assigned_by)
SELECT
  ca.organization_id,
  ca.profile_id,
  ca.resource_id,
  ss.id,
  ca.assigned_by
FROM collaborator_assignments ca
JOIN school_subjects ss ON ss.organization_id = ca.organization_id
WHERE ca.resource_type = 'school_class'
ON CONFLICT (profile_id, class_id, subject_id) DO NOTHING;

-- ─── Helpers ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION teacher_has_class_assignment(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_org_admin()
    OR EXISTS (
      SELECT 1 FROM school_teaching_assignments sta
      WHERE sta.profile_id = auth.uid()
        AND sta.class_id = p_class_id
        AND sta.organization_id = get_user_organization_id()
    )
    OR EXISTS (
      SELECT 1 FROM collaborator_assignments ca
      WHERE ca.profile_id = auth.uid()
        AND ca.resource_type = 'school_class'
        AND ca.resource_id = p_class_id
        AND ca.organization_id = get_user_organization_id()
    )
$$;

GRANT EXECUTE ON FUNCTION teacher_has_class_assignment(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION teacher_can_grade(p_class_id UUID, p_subject_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_org_admin()
    OR EXISTS (
      SELECT 1 FROM school_teaching_assignments sta
      WHERE sta.profile_id = auth.uid()
        AND sta.class_id = p_class_id
        AND sta.subject_id = p_subject_id
        AND sta.organization_id = get_user_organization_id()
    )
    OR (
      p_class_id IS NOT NULL
      AND p_subject_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM collaborator_assignments ca
        WHERE ca.profile_id = auth.uid()
          AND ca.resource_type = 'school_class'
          AND ca.resource_id = p_class_id
          AND ca.organization_id = get_user_organization_id()
      )
      AND NOT EXISTS (
        SELECT 1 FROM school_teaching_assignments sta
        WHERE sta.profile_id = auth.uid()
          AND sta.organization_id = get_user_organization_id()
      )
    )
$$;

GRANT EXECUTE ON FUNCTION teacher_can_grade(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION is_assigned_to_school_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT teacher_has_class_assignment(p_class_id)
$$;

CREATE OR REPLACE FUNCTION teacher_can_grade_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT teacher_has_class_assignment(p_class_id)
$$;

-- ─── RLS table assignations enseignement ───────────────────────

ALTER TABLE school_teaching_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_teaching_select ON school_teaching_assignments FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR (
      belongs_to_org(organization_id)
      AND (can_manage_assignments() OR profile_id = auth.uid())
    )
  );

CREATE POLICY school_teaching_insert ON school_teaching_assignments FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id) AND can_manage_assignments());

CREATE POLICY school_teaching_update ON school_teaching_assignments FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id) AND can_manage_assignments())
  WITH CHECK (belongs_to_org(organization_id) AND can_manage_assignments());

CREATE POLICY school_teaching_delete ON school_teaching_assignments FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND can_manage_assignments());

-- ─── Classes / élèves / notes (mise à jour) ─────────────────────

DROP POLICY IF EXISTS school_classes_select ON school_classes;
CREATE POLICY school_classes_select ON school_classes FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (
      NOT has_role('teacher')
      OR is_org_admin()
      OR teacher_has_class_assignment(id)
    )
  );

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
        AND teacher_has_class_assignment(class_id)
      )
    )
  );

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
        AND subject_id IS NOT NULL
        AND teacher_can_grade(class_id, subject_id)
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
        AND subject_id IS NOT NULL
        AND teacher_can_grade(class_id, subject_id)
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
        AND subject_id IS NOT NULL
        AND teacher_can_grade(class_id, subject_id)
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
        AND subject_id IS NOT NULL
        AND teacher_can_grade(class_id, subject_id)
      )
    )
  );
