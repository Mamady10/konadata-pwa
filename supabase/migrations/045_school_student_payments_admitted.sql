-- Paiements élèves : scolarité après admission, montant lié à la classe du dossier

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
            WHEN c.id IS NOT NULL THEN jsonb_build_object('name', c.name, 'tuition_fee_gnf', c.tuition_fee_gnf)
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


CREATE OR REPLACE FUNCTION school_payment_amount_for_kind(
  p_org_id UUID,
  p_kind TEXT,
  p_student_id UUID,
  p_enrollment_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
  v_student school_students%ROWTYPE;
  v_enr school_enrollments%ROWTYPE;
  v_fee NUMERIC;
  v_class_id UUID;
BEGIN
  v_settings := school_student_payment_settings(p_org_id);

  IF p_kind = 'enrollment' THEN
    RETURN COALESCE((v_settings->>'enrollment_new_fee_gnf')::NUMERIC, 0);
  ELSIF p_kind = 'reenrollment' THEN
    RETURN COALESCE((v_settings->>'enrollment_reenrollment_fee_gnf')::NUMERIC, 0);
  ELSIF p_kind = 'tuition' THEN
    IF p_enrollment_id IS NOT NULL THEN
      SELECT class_id INTO v_class_id FROM school_enrollments
      WHERE id = p_enrollment_id AND student_id = p_student_id AND organization_id = p_org_id;
    END IF;
    IF v_class_id IS NULL THEN
      SELECT * INTO v_student FROM school_students WHERE id = p_student_id AND organization_id = p_org_id;
      v_class_id := v_student.class_id;
    END IF;
    IF v_class_id IS NOT NULL THEN
      SELECT tuition_fee_gnf INTO v_fee FROM school_classes WHERE id = v_class_id;
      IF v_fee IS NOT NULL AND v_fee > 0 THEN RETURN v_fee; END IF;
    END IF;
    RETURN COALESCE((SELECT (settings->>'tuition_fee_gnf')::NUMERIC FROM organizations WHERE id = p_org_id), 0);
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION create_school_student_payment_link(
  p_student_id UUID,
  p_kind TEXT,
  p_enrollment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student school_students%ROWTYPE;
  v_enr school_enrollments%ROWTYPE;
  v_settings JSONB;
  v_amount NUMERIC;
  v_token TEXT;
  v_payment school_payments%ROWTYPE;
  v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || (EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 1)::TEXT;
BEGIN
  IF p_kind NOT IN ('tuition', 'enrollment', 'reenrollment') THEN
    RAISE EXCEPTION 'Type de paiement invalide';
  END IF;

  SELECT * INTO v_student FROM school_students WHERE id = p_student_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Élève introuvable'; END IF;

  v_settings := school_student_payment_settings(v_student.organization_id);
  IF NOT COALESCE((v_settings->>'enabled')::BOOLEAN, false) THEN
    RAISE EXCEPTION 'Paiements en ligne désactivés — contactez la scolarité';
  END IF;

  IF p_kind = 'enrollment' AND NOT COALESCE((v_settings->>'allow_enrollment_payment')::BOOLEAN, true) THEN
    RAISE EXCEPTION 'Paiement inscription non activé';
  END IF;
  IF p_kind = 'reenrollment' AND NOT COALESCE((v_settings->>'allow_reenrollment_payment')::BOOLEAN, true) THEN
    RAISE EXCEPTION 'Paiement réinscription non activé';
  END IF;
  IF p_kind = 'tuition' AND NOT COALESCE((v_settings->>'allow_tuition_payment')::BOOLEAN, true) THEN
    RAISE EXCEPTION 'Paiement scolarité non activé';
  END IF;

  IF NOT (
    is_platform_admin()
    OR (is_school_staff() AND belongs_to_org(v_student.organization_id))
    OR owns_school_student(p_student_id)
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  IF p_kind IN ('enrollment', 'reenrollment') THEN
    IF p_enrollment_id IS NULL THEN
      RAISE EXCEPTION 'Dossier d''inscription requis';
    END IF;
    SELECT * INTO v_enr FROM school_enrollments
    WHERE id = p_enrollment_id AND student_id = p_student_id AND organization_id = v_student.organization_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;
    IF v_enr.status NOT IN ('admitted', 'enrolled', 'pending') THEN
      RAISE EXCEPTION 'Ce dossier ne permet pas de paiement en ligne';
    END IF;
    IF p_kind = 'enrollment' AND COALESCE(v_enr.request_type::TEXT, 'new') <> 'new' THEN
      RAISE EXCEPTION 'Utilisez le paiement réinscription pour ce dossier';
    END IF;
    IF p_kind = 'reenrollment' AND COALESCE(v_enr.request_type::TEXT, 'new') <> 'reenrollment' THEN
      RAISE EXCEPTION 'Utilisez le paiement inscription pour ce dossier';
    END IF;
  ELSE
    IF p_enrollment_id IS NOT NULL THEN
      SELECT * INTO v_enr FROM school_enrollments
      WHERE id = p_enrollment_id AND student_id = p_student_id AND organization_id = v_student.organization_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;
      IF v_enr.status NOT IN ('admitted', 'enrolled') THEN
        RAISE EXCEPTION 'Scolarité payable après acceptation par l''établissement';
      END IF;
    ELSIF v_student.enrollment_status NOT IN ('admitted', 'enrolled') THEN
      RAISE EXCEPTION 'Scolarité payable une fois accepté(e) ou inscrit(e)';
    END IF;
  END IF;

  v_amount := school_payment_amount_for_kind(v_student.organization_id, p_kind, p_student_id, p_enrollment_id);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Montant non configuré — demandez à l''établissement de fixer les frais';
  END IF;

  SELECT * INTO v_payment FROM school_payments
  WHERE student_id = p_student_id
    AND payment_kind = p_kind
    AND status = 'pending'
    AND (p_enrollment_id IS NULL OR enrollment_id = p_enrollment_id)
    AND (academic_year IS NULL OR academic_year = v_year)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_payment.id IS NOT NULL AND v_payment.payment_token IS NOT NULL THEN
    RETURN jsonb_build_object(
      'payment_id', v_payment.id,
      'payment_token', v_payment.payment_token,
      'amount_gnf', v_payment.amount,
      'payment_kind', v_payment.payment_kind,
      'status', v_payment.status
    );
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO school_payments (
    organization_id, student_id, enrollment_id, amount, payment_kind,
    payment_token, status, academic_year, description, due_date
  ) VALUES (
    v_student.organization_id, p_student_id, p_enrollment_id, v_amount, p_kind,
    v_token, 'pending', v_year,
    CASE p_kind
      WHEN 'enrollment' THEN 'Frais d''inscription'
      WHEN 'reenrollment' THEN 'Frais de réinscription'
      ELSE 'Frais de scolarité'
    END,
    CURRENT_DATE
  )
  RETURNING * INTO v_payment;

  RETURN jsonb_build_object(
    'payment_id', v_payment.id,
    'payment_token', v_payment.payment_token,
    'amount_gnf', v_payment.amount,
    'payment_kind', v_payment.payment_kind,
    'status', v_payment.status
  );
END;
$$;
