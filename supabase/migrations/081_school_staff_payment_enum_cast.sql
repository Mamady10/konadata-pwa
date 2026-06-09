-- Corrige le cast enum payment_method / payment_status dans record_school_staff_payment

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
