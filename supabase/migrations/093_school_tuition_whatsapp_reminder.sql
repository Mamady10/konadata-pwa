-- Rappel scolarité : un seul WhatsApp (J-1), activable par établissement

CREATE OR REPLACE FUNCTION update_school_student_payment_settings(
  p_org_id UUID,
  p_settings JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    (is_org_admin() AND belongs_to_org(p_org_id))
    OR is_platform_admin()
    OR (has_role('deputy_director', 'registrar', 'accountant') AND belongs_to_org(p_org_id))
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE organizations SET
    settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{student_payments}',
      jsonb_build_object(
        'enabled', COALESCE((p_settings->>'enabled')::BOOLEAN, false),
        'allow_enrollment_payment', COALESCE((p_settings->>'allow_enrollment_payment')::BOOLEAN, true),
        'allow_reenrollment_payment', COALESCE((p_settings->>'allow_reenrollment_payment')::BOOLEAN, true),
        'allow_tuition_payment', COALESCE((p_settings->>'allow_tuition_payment')::BOOLEAN, true),
        'enrollment_new_fee_gnf', GREATEST(0, COALESCE((p_settings->>'enrollment_new_fee_gnf')::NUMERIC, 0)),
        'enrollment_reenrollment_fee_gnf', GREATEST(0, COALESCE((p_settings->>'enrollment_reenrollment_fee_gnf')::NUMERIC, 0)),
        'min_payment_gnf', GREATEST(10000, COALESCE((p_settings->>'min_payment_gnf')::NUMERIC, 100000)),
        'tuition_installments', COALESCE(p_settings->'tuition_installments', '[]'::jsonb),
        'orange_money_enabled', COALESCE((p_settings->>'orange_money_enabled')::BOOLEAN, true),
        'orange_money_merchant_phone', NULLIF(trim(p_settings->>'orange_money_merchant_phone'), ''),
        'orange_money_merchant_label', NULLIF(trim(p_settings->>'orange_money_merchant_label'), ''),
        'tuition_whatsapp_reminder_enabled', COALESCE((p_settings->>'tuition_whatsapp_reminder_enabled')::BOOLEAN, false)
      ),
      true
    )
  WHERE id = p_org_id AND type = 'school';

  RETURN school_student_payment_settings(p_org_id);
END;
$$;

CREATE OR REPLACE FUNCTION school_student_payment_settings(p_org_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT settings->'student_payments' FROM organizations WHERE id = p_org_id),
    jsonb_build_object(
      'enabled', false,
      'allow_enrollment_payment', true,
      'allow_reenrollment_payment', true,
      'allow_tuition_payment', true,
      'enrollment_new_fee_gnf', 0,
      'enrollment_reenrollment_fee_gnf', 0,
      'min_payment_gnf', 100000,
      'tuition_installments', '[]'::jsonb,
      'orange_money_enabled', true,
      'orange_money_merchant_phone', null,
      'orange_money_merchant_label', null,
      'tuition_whatsapp_reminder_enabled', false
    )
  )
  || jsonb_build_object(
    'min_payment_gnf',
    COALESCE(
      ((SELECT settings->'student_payments' FROM organizations WHERE id = p_org_id)->>'min_payment_gnf')::NUMERIC,
      100000
    ),
    'tuition_installments',
    COALESCE(
      (SELECT settings->'student_payments'->'tuition_installments' FROM organizations WHERE id = p_org_id),
      '[]'::jsonb
    ),
    'orange_money_enabled',
    COALESCE(
      ((SELECT settings->'student_payments' FROM organizations WHERE id = p_org_id)->>'orange_money_enabled')::BOOLEAN,
      true
    ),
    'orange_money_merchant_phone',
    (SELECT settings->'student_payments'->>'orange_money_merchant_phone' FROM organizations WHERE id = p_org_id),
    'orange_money_merchant_label',
    (SELECT settings->'student_payments'->>'orange_money_merchant_label' FROM organizations WHERE id = p_org_id),
    'tuition_whatsapp_reminder_enabled',
    COALESCE(
      ((SELECT settings->'student_payments' FROM organizations WHERE id = p_org_id)->>'tuition_whatsapp_reminder_enabled')::BOOLEAN,
      false
    )
  );
$$;

-- Un seul rappel : J-1 avant échéance, écoles avec option activée
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
BEGIN
  IF p_reminder_kind <> '1d' THEN
    RAISE EXCEPTION 'Seul le rappel J-1 (1d) est supporté';
  END IF;

  RETURN QUERY
  WITH active_orgs AS (
    SELECT o.id, o.name, school_student_payment_settings(o.id) AS sp
    FROM organizations o
    WHERE o.type = 'school' AND o.is_active = true
      AND COALESCE((school_student_payment_settings(o.id)->>'enabled')::BOOLEAN, false)
      AND COALESCE(
        (school_student_payment_settings(o.id)->>'tuition_whatsapp_reminder_enabled')::BOOLEAN,
        false
      )
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
      AND (inst.elem->>'due_date')::DATE = CURRENT_DATE + 1
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
        AND rl.reminder_kind = '1d'
        AND rl.academic_year = school_current_academic_year()
    );
END;
$$;
