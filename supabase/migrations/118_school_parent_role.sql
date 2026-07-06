-- Rôle parent / tuteur : accès établissement (vie scolaire, actualités parents)

DO $$
BEGIN
  ALTER TYPE app_role ADD VALUE 'parent';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE app_role IS
  'parent = tuteur connecté à l''établissement (suivi enfant, vie scolaire)';

CREATE OR REPLACE FUNCTION is_role_allowed_for_org(p_org_type organization_type, p_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_org_type
    WHEN 'school' THEN p_role IN (
      'deputy_director', 'registrar', 'accountant', 'teacher', 'student', 'candidate', 'parent'
    )
    WHEN 'ngo' THEN p_role IN ('deputy_director', 'ngo_staff')
    WHEN 'btp' THEN p_role IN ('deputy_director', 'btp_staff')
    WHEN 'business' THEN p_role IN ('deputy_director', 'accountant', 'pme_staff')
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION parent_linked_school_student_ids(p_org_id UUID DEFAULT NULL)
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_phone TEXT;
  v_ids UUID[];
BEGIN
  SELECT organization_id, regexp_replace(COALESCE(phone, ''), '[^0-9+]', '', 'g')
  INTO v_org_id, v_phone
  FROM profiles
  WHERE id = auth.uid();

  IF v_org_id IS NULL OR length(v_phone) < 8 THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  IF p_org_id IS NOT NULL AND p_org_id <> v_org_id THEN
    RETURN ARRAY[]::UUID[];
  END IF;

  SELECT COALESCE(array_agg(DISTINCT ss.id), ARRAY[]::UUID[])
  INTO v_ids
  FROM school_students ss
  INNER JOIN school_enrollments e ON e.student_id = ss.id AND e.organization_id = ss.organization_id
  WHERE ss.organization_id = v_org_id
    AND regexp_replace(
      COALESCE(NULLIF(trim(e.guardian_phone), ''), NULLIF(trim(e.applicant_phone), ''), ''),
      '[^0-9+]', '', 'g'
    ) = v_phone;

  RETURN v_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION parent_linked_school_student_ids(UUID) TO authenticated;

DROP POLICY IF EXISTS school_announcements_select ON school_announcements;
CREATE POLICY school_announcements_select ON school_announcements FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id)
    AND is_school_org()
    AND (
      is_platform_admin()
      OR is_org_admin()
      OR has_role('deputy_director', 'registrar', 'accountant', 'teacher')
      OR (has_role('student', 'candidate') AND visible_to_students)
      OR (has_role('parent') AND visible_to_parents)
    )
  );

DROP POLICY IF EXISTS school_report_cards_select ON school_report_cards;
CREATE POLICY school_report_cards_select ON school_report_cards FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (
      is_school_staff()
      OR owns_school_student(student_id)
      OR (
        has_role('parent')
        AND student_id = ANY(parent_linked_school_student_ids(organization_id))
      )
    )
  );

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
      OR (
        has_role('parent')
        AND id = ANY(parent_linked_school_student_ids(organization_id))
      )
    )
  );
