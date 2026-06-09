-- L'élève / candidat doit voir toutes ses demandes (tous établissements), pas seulement organization_id du profil.

-- Personnes liées au compte (toutes orgs)
DROP POLICY IF EXISTS core_persons_select ON core_persons;
CREATE POLICY core_persons_select ON core_persons FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR belongs_to_org(organization_id)
  );

-- Noms des établissements des dossiers du candidat
DROP POLICY IF EXISTS org_select ON organizations;
CREATE POLICY org_select ON organizations FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR id = get_user_organization_id()
    OR (
      is_school_student_or_candidate()
      AND EXISTS (
        SELECT 1
        FROM school_students ss
        INNER JOIN core_persons cp ON cp.id = ss.person_id
        WHERE ss.organization_id = organizations.id
          AND cp.profile_id = auth.uid()
      )
    )
  );

-- Demandes : ne pas exiger is_school_org() sur le profil utilisateur
DROP POLICY IF EXISTS school_enrollments_select ON school_enrollments;
CREATE POLICY school_enrollments_select ON school_enrollments FOR SELECT TO authenticated
  USING (
    (
      is_school_org()
      AND belongs_to_org(organization_id)
      AND is_school_staff()
    )
    OR (
      is_school_student_or_candidate()
      AND student_id IS NOT NULL
      AND owns_school_student(student_id)
    )
  );

-- Élèves liés au compte (toutes orgs)
DROP POLICY IF EXISTS school_students_select ON school_students;
CREATE POLICY school_students_select ON school_students FOR SELECT TO authenticated
  USING (
    (is_school_org() AND belongs_to_org(organization_id) AND (
      (is_school_staff() AND NOT has_role('teacher'))
      OR (
        has_role('teacher')
        AND class_id IS NOT NULL
        AND teacher_has_class_assignment(class_id)
      )
    ))
    OR (is_school_student_or_candidate() AND owns_school_student(id))
  );

-- RPC : liste complète des demandes du candidat (secours si le client échoue)
CREATE OR REPLACE FUNCTION get_my_learner_enrollments()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_result JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(
    jsonb_agg(row_data ORDER BY created_at DESC),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT
      e.created_at,
      to_jsonb(e.*)
        || jsonb_build_object(
          'organizations', jsonb_build_object('name', COALESCE(o.name, 'Établissement')),
          'school_classes',
          CASE
            WHEN c.id IS NOT NULL THEN jsonb_build_object('name', c.name)
            ELSE NULL
          END
        ) AS row_data
    FROM school_enrollments e
    INNER JOIN school_students ss ON ss.id = e.student_id
    INNER JOIN core_persons cp ON cp.id = ss.person_id
    LEFT JOIN organizations o ON o.id = e.organization_id
    LEFT JOIN school_classes c ON c.id = e.class_id
    WHERE cp.profile_id = v_uid
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_learner_enrollments() TO authenticated;
