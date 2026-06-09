-- Reçus / factures de paiement scolarité (émission automatique après règlement)

ALTER TABLE school_payments
  ADD COLUMN IF NOT EXISTS receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS receipt_issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipt_verification_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_payments_receipt_number
  ON school_payments(organization_id, receipt_number)
  WHERE receipt_number IS NOT NULL;

COMMENT ON COLUMN school_payments.receipt_number IS
  'Numéro séquentiel du reçu (ex. REC-2026-000042), émis à la confirmation du paiement.';
COMMENT ON COLUMN school_payments.receipt_verification_code IS
  'Code court de vérification affiché sur le reçu (QR / contrôle comptable).';

-- Compteur séquentiel par établissement et année civile
CREATE OR REPLACE FUNCTION next_school_payment_receipt_number(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  v_seq INT;
  v_key TEXT;
  v_current INT;
BEGIN
  v_key := 'receipt_seq_' || v_year;

  SELECT COALESCE((settings->>v_key)::INT, 0) INTO v_current
  FROM organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organisation introuvable';
  END IF;

  v_seq := v_current + 1;

  UPDATE organizations SET
    settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      ARRAY[v_key],
      to_jsonb(v_seq),
      true
    )
  WHERE id = p_org_id;

  RETURN 'REC-' || v_year || '-' || lpad(v_seq::TEXT, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION issue_school_payment_receipt(p_payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay school_payments%ROWTYPE;
  v_receipt TEXT;
  v_verify TEXT;
BEGIN
  SELECT * INTO v_pay FROM school_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Paiement introuvable');
  END IF;

  IF v_pay.status <> 'paid' THEN
    RETURN jsonb_build_object('error', 'Paiement non confirmé');
  END IF;

  IF v_pay.receipt_number IS NOT NULL THEN
    RETURN jsonb_build_object(
      'receipt_number', v_pay.receipt_number,
      'receipt_issued_at', v_pay.receipt_issued_at,
      'receipt_verification_code', v_pay.receipt_verification_code,
      'already_issued', true
    );
  END IF;

  v_receipt := next_school_payment_receipt_number(v_pay.organization_id);
  v_verify := upper(substr(md5(v_pay.id::TEXT || COALESCE(v_pay.payment_token, '')), 1, 8));

  UPDATE school_payments SET
    receipt_number = v_receipt,
    receipt_issued_at = now(),
    receipt_verification_code = v_verify
  WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'receipt_number', v_receipt,
    'receipt_issued_at', now(),
    'receipt_verification_code', v_verify,
    'payment_token', v_pay.payment_token
  );
END;
$$;

-- Lecture reçu : token secret = accès (anonyme ou connecté)
CREATE OR REPLACE FUNCTION get_school_payment_receipt_by_token(p_token TEXT)
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
  v_class school_classes%ROWTYPE;
  v_balance JSONB;
  v_settings JSONB;
BEGIN
  SELECT * INTO v_pay FROM school_payments WHERE payment_token = p_token;
  IF NOT FOUND OR v_pay.status <> 'paid' THEN
    RETURN NULL;
  END IF;

  IF v_pay.receipt_number IS NULL THEN
    PERFORM issue_school_payment_receipt(v_pay.id);
    SELECT * INTO v_pay FROM school_payments WHERE payment_token = p_token;
  END IF;

  SELECT * INTO v_student FROM school_students WHERE id = v_pay.student_id;
  SELECT * INTO v_org FROM organizations WHERE id = v_pay.organization_id;
  SELECT * INTO v_person FROM core_persons WHERE id = v_student.person_id;
  v_settings := COALESCE(v_org.settings, '{}'::jsonb);

  IF v_student.class_id IS NOT NULL THEN
    SELECT * INTO v_class FROM school_classes WHERE id = v_student.class_id;
  END IF;

  IF v_pay.payment_kind = 'tuition' THEN
    v_balance := school_tuition_balance(v_pay.student_id, v_pay.enrollment_id, v_pay.academic_year);
  END IF;

  RETURN jsonb_build_object(
    'payment_id', v_pay.id,
    'payment_token', v_pay.payment_token,
    'receipt_number', v_pay.receipt_number,
    'receipt_issued_at', v_pay.receipt_issued_at,
    'receipt_verification_code', v_pay.receipt_verification_code,
    'amount_gnf', v_pay.amount,
    'currency', COALESCE(v_pay.currency, 'GNF'),
    'payment_kind', v_pay.payment_kind,
    'payment_method', v_pay.payment_method,
    'reference', v_pay.reference,
    'paid_at', v_pay.paid_at,
    'description', v_pay.description,
    'academic_year', v_pay.academic_year,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'organization_email', v_org.email,
    'organization_city', v_settings->>'city',
    'organization_phone', v_settings->>'phone',
    'student_id', v_student.id,
    'student_name', v_person.full_name,
    'student_matricule', v_student.matricule,
    'class_name', v_class.name,
    'balance', v_balance,
    'issued_by', 'KonaData'
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
  v_receipt JSONB;
BEGIN
  SELECT * INTO v_pay FROM school_payments WHERE payment_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lien de paiement invalide'; END IF;

  IF v_pay.status = 'paid' THEN
    v_receipt := issue_school_payment_receipt(v_pay.id);
    RETURN jsonb_build_object(
      'already_paid', true,
      'payment_id', v_pay.id,
      'receipt', v_receipt,
      'receipt_url', '/recu-scolarite/' || p_token
    );
  END IF;

  IF auth.uid() IS NOT NULL AND NOT (
    is_platform_admin()
    OR (can_manage_finance() AND belongs_to_org(v_pay.organization_id))
    OR owns_school_student(v_pay.student_id)
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE school_payments SET
    status = 'paid',
    paid_at = now(),
    reference = COALESCE(NULLIF(trim(p_reference), ''), reference, 'PAY-' || to_char(now(), 'YYYYMMDD-HH24MISS'))
  WHERE id = v_pay.id;

  SELECT * INTO v_pay FROM school_payments WHERE id = v_pay.id;
  v_receipt := issue_school_payment_receipt(v_pay.id);

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_pay.id,
    'receipt', v_receipt,
    'receipt_url', '/recu-scolarite/' || p_token,
    'balance', CASE
      WHEN v_pay.payment_kind = 'tuition' THEN
        school_tuition_balance(v_pay.student_id, v_pay.enrollment_id, v_pay.academic_year)
      ELSE NULL
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION next_school_payment_receipt_number(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION issue_school_payment_receipt(UUID) TO authenticated;
-- Caisse : émettre reçu pour paiement manuel (sans token en ligne)
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

  IF NOT (
    is_platform_admin()
    OR (can_manage_finance() AND belongs_to_org(v_pay.organization_id))
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  IF v_pay.status <> 'paid' THEN
    RETURN jsonb_build_object('error', 'Paiement non confirmé');
  END IF;

  IF v_pay.payment_token IS NULL THEN
    v_token := encode(gen_random_bytes(24), 'hex');
    UPDATE school_payments SET payment_token = v_token WHERE id = p_payment_id;
    v_pay.payment_token := v_token;
  END IF;

  RETURN issue_school_payment_receipt(p_payment_id)
    || jsonb_build_object('receipt_url', '/recu-scolarite/' || v_pay.payment_token);
END;
$$;

GRANT EXECUTE ON FUNCTION finalize_school_payment_receipt(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_school_payment_receipt_by_token(TEXT) TO authenticated, anon;
