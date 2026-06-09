-- Encaissement guichet (scolarité / comptabilité) : scolarité, inscription, réinscription

CREATE OR REPLACE FUNCTION can_record_school_staff_payment(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school JSONB;
BEGIN
  IF NOT is_authenticated() THEN
    RETURN FALSE;
  END IF;
  IF is_platform_admin() THEN
    RETURN TRUE;
  END IF;
  IF NOT belongs_to_org(p_org_id) THEN
    RETURN FALSE;
  END IF;
  IF can_manage_finance() OR is_org_admin() THEN
    RETURN TRUE;
  END IF;
  IF has_role('registrar') THEN
    SELECT COALESCE(settings->'school', '{}'::jsonb)
    INTO v_school
    FROM organizations
    WHERE id = p_org_id;
    RETURN COALESCE((v_school->>'registrar_can_record_payments')::BOOLEAN, FALSE);
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION record_school_staff_payment(
  p_student_id UUID,
  p_kind TEXT,
  p_amount NUMERIC,
  p_enrollment_id UUID DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cash',
  p_reference TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'paid'
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
  v_year TEXT;
  v_payment school_payments%ROWTYPE;
  v_receipt JSONB;
  v_desc TEXT;
  v_existing UUID;
  v_method TEXT;
  v_method_enum payment_method;
BEGIN
  IF p_kind NOT IN ('tuition', 'enrollment', 'reenrollment') THEN
    RAISE EXCEPTION 'Type de paiement invalide';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant invalide';
  END IF;
  IF p_status NOT IN ('paid', 'pending', 'partial') THEN
    RAISE EXCEPTION 'Statut invalide';
  END IF;

  SELECT * INTO v_student FROM school_students WHERE id = p_student_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Élève introuvable';
  END IF;

  IF NOT can_record_school_staff_payment(v_student.organization_id) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  v_settings := school_student_payment_settings(v_student.organization_id);
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || (EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 1)::TEXT;

  IF p_kind = 'enrollment' AND NOT COALESCE((v_settings->>'allow_enrollment_payment')::BOOLEAN, TRUE) THEN
    RAISE EXCEPTION 'Paiement inscription non activé';
  END IF;
  IF p_kind = 'reenrollment' AND NOT COALESCE((v_settings->>'allow_reenrollment_payment')::BOOLEAN, TRUE) THEN
    RAISE EXCEPTION 'Paiement réinscription non activé';
  END IF;
  IF p_kind = 'tuition' AND NOT COALESCE((v_settings->>'allow_tuition_payment')::BOOLEAN, TRUE) THEN
    RAISE EXCEPTION 'Paiement scolarité non activé';
  END IF;

  IF p_kind IN ('enrollment', 'reenrollment') THEN
    IF p_enrollment_id IS NULL THEN
      RAISE EXCEPTION 'Dossier d''inscription requis';
    END IF;
    SELECT * INTO v_enr FROM school_enrollments
    WHERE id = p_enrollment_id
      AND student_id = p_student_id
      AND organization_id = v_student.organization_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Dossier introuvable';
    END IF;
    IF v_enr.status NOT IN ('pending', 'admitted', 'enrolled') THEN
      RAISE EXCEPTION 'Ce dossier ne permet pas d''enregistrer un paiement';
    END IF;
    IF p_kind = 'enrollment' AND COALESCE(v_enr.request_type::TEXT, 'new') <> 'new' THEN
      RAISE EXCEPTION 'Utilisez le type réinscription pour ce dossier';
    END IF;
    IF p_kind = 'reenrollment' AND COALESCE(v_enr.request_type::TEXT, 'new') <> 'reenrollment' THEN
      RAISE EXCEPTION 'Utilisez le type inscription pour ce dossier';
    END IF;
    IF v_enr.academic_year IS NOT NULL AND trim(v_enr.academic_year) <> '' THEN
      v_year := trim(v_enr.academic_year);
    END IF;

    SELECT id INTO v_existing FROM school_payments
    WHERE student_id = p_student_id
      AND enrollment_id = p_enrollment_id
      AND payment_kind = p_kind
      AND status = 'paid'
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RAISE EXCEPTION 'Un paiement % est déjà enregistré pour ce dossier',
        CASE p_kind WHEN 'enrollment' THEN 'd''inscription' ELSE 'de réinscription' END;
    END IF;
  ELSE
    IF v_student.enrollment_status <> 'enrolled' THEN
      RAISE EXCEPTION 'Scolarité payable une fois inscrit(e)';
    END IF;
    IF p_enrollment_id IS NOT NULL THEN
      SELECT * INTO v_enr FROM school_enrollments
      WHERE id = p_enrollment_id
        AND student_id = p_student_id
        AND organization_id = v_student.organization_id;
      IF FOUND AND v_enr.academic_year IS NOT NULL AND trim(v_enr.academic_year) <> '' THEN
        v_year := trim(v_enr.academic_year);
      END IF;
    END IF;
  END IF;

  v_desc := COALESCE(
    NULLIF(trim(p_description), ''),
    CASE p_kind
      WHEN 'enrollment' THEN 'Frais d''inscription'
      WHEN 'reenrollment' THEN 'Frais de réinscription'
      ELSE 'Frais de scolarité'
    END
  );

  v_method := COALESCE(NULLIF(trim(p_payment_method), ''), 'cash');
  IF v_method NOT IN ('orange_money', 'mtn_momo', 'bank_transfer', 'cash', 'other') THEN
    RAISE EXCEPTION 'Mode de paiement invalide';
  END IF;
  v_method_enum := v_method::payment_method;

  INSERT INTO school_payments (
    organization_id,
    student_id,
    enrollment_id,
    amount,
    payment_kind,
    payment_method,
    status,
    reference,
    description,
    paid_at,
    academic_year,
    confirmation_source
  ) VALUES (
    v_student.organization_id,
    p_student_id,
    p_enrollment_id,
    p_amount,
    p_kind,
    v_method_enum,
    p_status::payment_status,
    NULLIF(trim(p_reference), ''),
    v_desc,
    CASE WHEN p_status = 'paid' THEN NOW() ELSE NULL END,
    v_year,
    'staff'
  )
  RETURNING * INTO v_payment;

  IF p_status = 'paid' THEN
    v_receipt := finalize_school_payment_receipt(v_payment.id);
    RETURN jsonb_build_object(
      'success', TRUE,
      'payment_id', v_payment.id,
      'receipt_url', v_receipt->>'receipt_url'
    );
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'payment_id', v_payment.id);
END;
$$;

CREATE OR REPLACE FUNCTION school_payment_random_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
$$;

CREATE OR REPLACE FUNCTION finalize_school_payment_receipt(p_payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay school_payments%ROWTYPE;
  v_token TEXT;
BEGIN
  SELECT * INTO v_pay FROM school_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Paiement introuvable');
  END IF;

  IF NOT can_record_school_staff_payment(v_pay.organization_id) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  IF v_pay.status <> 'paid' THEN
    RETURN jsonb_build_object('error', 'Paiement non confirmé');
  END IF;

  IF v_pay.payment_token IS NULL THEN
    v_token := school_payment_random_token();
    UPDATE school_payments SET payment_token = v_token WHERE id = p_payment_id;
    v_pay.payment_token := v_token;
  END IF;

  RETURN issue_school_payment_receipt(p_payment_id)
    || jsonb_build_object('receipt_url', '/recu-scolarite/' || v_pay.payment_token);
END;
$$;

GRANT EXECUTE ON FUNCTION can_record_school_staff_payment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION school_payment_random_token() TO authenticated;
GRANT EXECUTE ON FUNCTION record_school_staff_payment(UUID, TEXT, NUMERIC, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
