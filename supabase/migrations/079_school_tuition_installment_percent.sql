-- Tranches scolarité en % du montant annuel (toutes classes) + dates communes

CREATE OR REPLACE FUNCTION list_school_tuition_reminder_targets(p_reminder_kind TEXT)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  student_id UUID,
  enrollment_id UUID,
  student_name TEXT,
  guardian_phone TEXT,
  guardian_name TEXT,
  installment_index INT,
  installment_label TEXT,
  installment_amount_gnf NUMERIC,
  due_date DATE,
  remaining_gnf NUMERIC,
  academic_year TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_date DATE;
BEGIN
  IF p_reminder_kind NOT IN ('7d', '1d', 'due', 'overdue') THEN
    RAISE EXCEPTION 'Type de rappel invalide';
  END IF;

  v_target_date := CASE p_reminder_kind
    WHEN '7d' THEN CURRENT_DATE + 7
    WHEN '1d' THEN CURRENT_DATE + 1
    WHEN 'due' THEN CURRENT_DATE
    WHEN 'overdue' THEN CURRENT_DATE - 7
  END;

  RETURN QUERY
  WITH active_orgs AS (
    SELECT o.id, o.name, school_student_payment_settings(o.id) AS sp
    FROM organizations o
    WHERE o.type = 'school' AND o.is_active = true
      AND COALESCE((school_student_payment_settings(o.id)->>'enabled')::BOOLEAN, false)
  ),
  installments AS (
    SELECT
      ao.id AS org_id,
      ao.name AS org_name,
      inst.idx,
      inst.elem
    FROM active_orgs ao,
    LATERAL jsonb_array_elements(COALESCE(ao.sp->'tuition_installments', '[]'::jsonb))
      WITH ORDINALITY AS inst(elem, idx)
    WHERE (inst.elem->>'due_date') IS NOT NULL
      AND (inst.elem->>'due_date')::DATE = v_target_date
  )
  SELECT
    i.org_id,
    i.org_name,
    ss.id,
    e.id,
    cp.full_name,
    COALESCE(NULLIF(trim(e.guardian_phone), ''), NULLIF(trim(cp.phone), ''), NULLIF(trim(e.applicant_phone), '')),
    e.guardian_name,
    (i.idx - 1)::INT,
    COALESCE(i.elem->>'label', 'Tranche ' || i.idx::TEXT),
    CASE
      WHEN COALESCE((i.elem->>'percent')::NUMERIC, 0) > 0 THEN
        ROUND(
          COALESCE((school_tuition_balance(ss.id, e.id, school_current_academic_year())->>'total_due_gnf')::NUMERIC, 0)
          * (i.elem->>'percent')::NUMERIC / 100
        )
      ELSE
        COALESCE((i.elem->>'amount_gnf')::NUMERIC, 0)
    END,
    (i.elem->>'due_date')::DATE,
    GREATEST(0, COALESCE((school_tuition_balance(ss.id, e.id, school_current_academic_year())->>'remaining_gnf')::NUMERIC, 0)),
    school_current_academic_year()
  FROM installments i
  INNER JOIN school_students ss ON ss.organization_id = i.org_id
    AND ss.enrollment_status IN ('admitted', 'enrolled')
  INNER JOIN core_persons cp ON cp.id = ss.person_id
  INNER JOIN LATERAL (
    SELECT en.*
    FROM school_enrollments en
    WHERE en.student_id = ss.id AND en.status IN ('admitted', 'enrolled')
    ORDER BY en.created_at DESC
    LIMIT 1
  ) e ON true
  WHERE COALESCE(e.guardian_sms_consent, false) = true
    AND COALESCE(NULLIF(trim(e.guardian_phone), ''), NULLIF(trim(cp.phone), ''), NULLIF(trim(e.applicant_phone), '')) IS NOT NULL
    AND COALESCE((school_tuition_balance(ss.id, e.id, school_current_academic_year())->>'remaining_gnf')::NUMERIC, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM school_tuition_reminder_log rl
      WHERE rl.organization_id = i.org_id
        AND rl.student_id = ss.id
        AND rl.enrollment_id IS NOT DISTINCT FROM e.id
        AND rl.installment_index = (i.idx - 1)::INT
        AND rl.reminder_kind = p_reminder_kind
        AND rl.academic_year = school_current_academic_year()
    );
END;
$$;
