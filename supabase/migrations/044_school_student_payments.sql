-- ============================================================
-- Paiements élèves (niveau 2) : inscription, réinscription, scolarité
-- ============================================================

ALTER TABLE school_payments
  ADD COLUMN IF NOT EXISTS payment_kind TEXT NOT NULL DEFAULT 'tuition'
    CHECK (payment_kind IN ('tuition', 'enrollment', 'reenrollment')),
  ADD COLUMN IF NOT EXISTS payment_token TEXT,
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES school_enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS academic_year TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_payments_token
  ON school_payments(payment_token) WHERE payment_token IS NOT NULL;

COMMENT ON COLUMN school_payments.payment_kind IS
  'tuition = frais scolarité ; enrollment = frais nouvelle inscription ; reenrollment = frais réinscription';

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
      'enrollment_reenrollment_fee_gnf', 0
    )
  );
$$;

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
    OR (has_role('deputy_director', 'registrar') AND belongs_to_org(p_org_id))
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
        'enrollment_reenrollment_fee_gnf', GREATEST(0, COALESCE((p_settings->>'enrollment_reenrollment_fee_gnf')::NUMERIC, 0))
      ),
      true
    )
  WHERE id = p_org_id AND type = 'school';

  RETURN school_student_payment_settings(p_org_id);
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
BEGIN
  v_settings := school_student_payment_settings(p_org_id);

  IF p_kind = 'enrollment' THEN
    RETURN COALESCE((v_settings->>'enrollment_new_fee_gnf')::NUMERIC, 0);
  ELSIF p_kind = 'reenrollment' THEN
    RETURN COALESCE((v_settings->>'enrollment_reenrollment_fee_gnf')::NUMERIC, 0);
  ELSIF p_kind = 'tuition' THEN
    SELECT * INTO v_student FROM school_students WHERE id = p_student_id AND organization_id = p_org_id;
    IF NOT FOUND THEN RETURN 0; END IF;
    SELECT tuition_fee_gnf INTO v_fee FROM school_classes WHERE id = v_student.class_id;
    IF v_fee IS NOT NULL AND v_fee > 0 THEN RETURN v_fee; END IF;
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

  IF NOT organization_platform_access_ok(v_student.organization_id) THEN
    RAISE EXCEPTION 'Les paiements en ligne ne sont pas disponibles pour cet établissement';
  END IF;

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
    IF v_student.enrollment_status <> 'enrolled' THEN
      RAISE EXCEPTION 'Scolarité payable une fois inscrit(e)';
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

CREATE OR REPLACE FUNCTION get_school_student_payment_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay school_payments%ROWTYPE;
  v_student school_students%ROWTYPE;
  v_org organizations%ROWTYPE;
  v_person core_persons%ROWTYPE;
BEGIN
  SELECT * INTO v_pay FROM school_payments WHERE payment_token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_student FROM school_students WHERE id = v_pay.student_id;
  SELECT * INTO v_org FROM organizations WHERE id = v_pay.organization_id;
  SELECT * INTO v_person FROM core_persons WHERE id = v_student.person_id;

  RETURN jsonb_build_object(
    'payment_id', v_pay.id,
    'payment_token', v_pay.payment_token,
    'amount_gnf', v_pay.amount,
    'payment_kind', v_pay.payment_kind,
    'status', v_pay.status,
    'description', v_pay.description,
    'academic_year', v_pay.academic_year,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'student_id', v_student.id,
    'student_name', v_person.full_name,
    'enrollment_id', v_pay.enrollment_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION record_school_student_payment_by_token(
  p_token TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay school_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_pay FROM school_payments WHERE payment_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lien de paiement invalide'; END IF;
  IF v_pay.status = 'paid' THEN
    RETURN jsonb_build_object('already_paid', true, 'payment_id', v_pay.id);
  END IF;

  IF NOT (
    is_platform_admin()
    OR (is_org_admin() AND belongs_to_org(v_pay.organization_id))
    OR owns_school_student(v_pay.student_id)
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE school_payments SET
    status = 'paid',
    paid_at = now(),
    reference = COALESCE(NULLIF(trim(p_reference), ''), reference, 'PAY-' || to_char(now(), 'YYYYMMDD-HH24MISS'))
  WHERE id = v_pay.id;

  RETURN jsonb_build_object('success', true, 'payment_id', v_pay.id);
END;
$$;

GRANT EXECUTE ON FUNCTION school_student_payment_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_school_student_payment_settings(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION school_payment_amount_for_kind(UUID, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_school_student_payment_link(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_school_student_payment_by_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_school_student_payment_by_token(TEXT, TEXT) TO authenticated;
