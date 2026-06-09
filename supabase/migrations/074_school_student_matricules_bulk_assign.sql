-- Attribution en masse des codes élève aux élèves existants sans matricule

CREATE OR REPLACE FUNCTION assign_school_student_matricules_batch(
  p_org_id UUID,
  p_class_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student RECORD;
  v_matricule TEXT;
  v_assigned INT := 0;
  v_skipped_no_class INT := 0;
  v_skipped_race INT := 0;
BEGIN
  IF NOT (
    (is_org_admin() AND belongs_to_org(p_org_id))
    OR is_platform_admin()
    OR (has_role('deputy_director', 'registrar') AND belongs_to_org(p_org_id))
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  PERFORM 1 FROM organizations WHERE id = p_org_id FOR UPDATE;

  FOR v_student IN
    SELECT ss.id, ss.class_id
    FROM school_students ss
    WHERE ss.organization_id = p_org_id
      AND (ss.matricule IS NULL OR trim(ss.matricule) = '')
      AND (p_class_id IS NULL OR ss.class_id = p_class_id)
    ORDER BY ss.class_id NULLS LAST, ss.created_at ASC
  LOOP
    IF v_student.class_id IS NULL THEN
      v_skipped_no_class := v_skipped_no_class + 1;
      CONTINUE;
    END IF;

    v_matricule := allocate_school_student_matricule(p_org_id, v_student.class_id, true);

    UPDATE school_students SET
      matricule = v_matricule,
      updated_at = now()
    WHERE id = v_student.id
      AND organization_id = p_org_id
      AND (matricule IS NULL OR trim(matricule) = '');

    IF FOUND THEN
      v_assigned := v_assigned + 1;
    ELSE
      v_skipped_race := v_skipped_race + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'assigned', v_assigned,
    'skipped_no_class', v_skipped_no_class,
    'skipped_race', v_skipped_race
  );
END;
$$;

CREATE OR REPLACE FUNCTION count_school_students_without_matricule(
  p_org_id UUID,
  p_class_id UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM school_students ss
  WHERE ss.organization_id = p_org_id
    AND (ss.matricule IS NULL OR trim(ss.matricule) = '')
    AND (p_class_id IS NULL OR ss.class_id = p_class_id);
$$;

GRANT EXECUTE ON FUNCTION assign_school_student_matricules_batch(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION count_school_students_without_matricule(UUID, UUID) TO authenticated;
