-- Webhook Orange Money — confirmation auto paiements scolarité élèves

ALTER TABLE school_payments
  ADD COLUMN IF NOT EXISTS confirmation_source TEXT
    CHECK (confirmation_source IS NULL OR confirmation_source IN ('manual', 'orange_money', 'staff')),
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;

COMMENT ON COLUMN school_payments.confirmation_source IS
  'manual = déclaration famille ; orange_money = webhook OM ; staff = validation comptable.';
COMMENT ON COLUMN school_payments.provider_payment_id IS
  'ID transaction externe (Orange Money event_id / transaction_id).';

CREATE TABLE IF NOT EXISTS school_payment_webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT NOT NULL DEFAULT 'orange_money',
  external_id     TEXT NOT NULL,
  payment_id      UUID REFERENCES school_payments(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'processed',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_school_payment_webhook_payment
  ON school_payment_webhook_events(payment_id);

-- Paramètres OM dans student_payments settings
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
        'orange_money_merchant_label', NULLIF(trim(p_settings->>'orange_money_merchant_label'), '')
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
      'orange_money_merchant_label', null
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
    (SELECT settings->'student_payments'->>'orange_money_merchant_label' FROM organizations WHERE id = p_org_id)
  );
$$;

-- Marquer intention Orange Money (reste pending jusqu'au webhook)
CREATE OR REPLACE FUNCTION prepare_school_payment_orange_money(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay school_payments%ROWTYPE;
  v_settings JSONB;
BEGIN
  SELECT * INTO v_pay FROM school_payments WHERE payment_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lien de paiement invalide'; END IF;
  IF v_pay.status = 'paid' THEN
    RETURN jsonb_build_object('already_paid', true, 'receipt_url', '/recu-scolarite/' || p_token);
  END IF;
  IF v_pay.status <> 'pending' THEN
    RAISE EXCEPTION 'Paiement non disponible';
  END IF;

  v_settings := school_student_payment_settings(v_pay.organization_id);
  IF NOT COALESCE((v_settings->>'orange_money_enabled')::BOOLEAN, true) THEN
    RAISE EXCEPTION 'Orange Money non activé pour cet établissement';
  END IF;

  UPDATE school_payments SET
    payment_method = 'orange_money'
  WHERE id = v_pay.id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_token', p_token,
    'amount_gnf', v_pay.amount,
    'merchant_phone', v_settings->>'orange_money_merchant_phone',
    'merchant_label', COALESCE(v_settings->>'orange_money_merchant_label', 'Compte Orange Money établissement'),
    'instructions',
      'Envoyez ' || v_pay.amount::TEXT || ' GNF via Orange Money en indiquant le matricule élève. La confirmation est automatique sous quelques minutes.'
  );
END;
$$;

-- Webhook Orange Money → paid + reçu
CREATE OR REPLACE FUNCTION process_school_payment_webhook(
  p_provider TEXT,
  p_external_id TEXT,
  p_payment_token TEXT,
  p_amount_gnf NUMERIC,
  p_status TEXT,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay school_payments%ROWTYPE;
  v_existing UUID;
  v_receipt JSONB;
  v_ref TEXT;
BEGIN
  IF trim(COALESCE(p_external_id, '')) = '' THEN
    RAISE EXCEPTION 'external_id requis';
  END IF;
  IF trim(COALESCE(p_payment_token, '')) = '' THEN
    RAISE EXCEPTION 'payment_token requis';
  END IF;

  SELECT id INTO v_existing FROM school_payment_webhook_events
  WHERE provider = COALESCE(NULLIF(trim(p_provider), ''), 'orange_money')
    AND external_id = trim(p_external_id);
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;

  IF lower(trim(COALESCE(p_status, ''))) NOT IN ('success', 'completed', 'paid', 'ok') THEN
    INSERT INTO school_payment_webhook_events (provider, external_id, payload, status)
    VALUES (
      COALESCE(NULLIF(trim(p_provider), ''), 'orange_money'),
      trim(p_external_id),
      jsonb_build_object('status', p_status, 'token', p_payment_token),
      'ignored'
    );
    RETURN jsonb_build_object('success', false, 'reason', 'payment_not_successful');
  END IF;

  SELECT * INTO v_pay FROM school_payments
  WHERE payment_token = trim(p_payment_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paiement scolarité introuvable pour ce token';
  END IF;

  IF v_pay.status = 'paid' THEN
    INSERT INTO school_payment_webhook_events (
      provider, external_id, payment_id, organization_id, payload, status
    ) VALUES (
      COALESCE(NULLIF(trim(p_provider), ''), 'orange_money'),
      trim(p_external_id), v_pay.id, v_pay.organization_id,
      jsonb_build_object('already_paid', true), 'duplicate'
    );
    RETURN jsonb_build_object(
      'success', true,
      'already_paid', true,
      'receipt_url', '/recu-scolarite/' || v_pay.payment_token
    );
  END IF;

  IF v_pay.status <> 'pending' THEN
    RAISE EXCEPTION 'Paiement non en attente (statut %)', v_pay.status;
  END IF;

  IF p_amount_gnf IS NOT NULL AND v_pay.amount > 0 THEN
    IF abs(p_amount_gnf - v_pay.amount) > GREATEST(1, v_pay.amount * 0.01) THEN
      RAISE EXCEPTION 'Montant webhook (%) différent du montant attendu (%)', p_amount_gnf, v_pay.amount;
    END IF;
  END IF;

  v_ref := COALESCE(
    NULLIF(trim(p_reference), ''),
    'OM-' || trim(p_external_id)
  );

  UPDATE school_payments SET
    status = 'paid',
    paid_at = now(),
    payment_method = 'orange_money',
    confirmation_source = 'orange_money',
    provider_payment_id = trim(p_external_id),
    reference = v_ref
  WHERE id = v_pay.id;

  v_receipt := issue_school_payment_receipt(v_pay.id);

  INSERT INTO school_payment_webhook_events (
    provider, external_id, payment_id, organization_id, payload, status
  ) VALUES (
    COALESCE(NULLIF(trim(p_provider), ''), 'orange_money'),
    trim(p_external_id),
    v_pay.id,
    v_pay.organization_id,
    jsonb_build_object(
      'payment_token', p_payment_token,
      'amount_gnf', p_amount_gnf,
      'reference', v_ref
    ),
    'processed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_pay.id,
    'confirmation_source', 'orange_money',
    'reference', v_ref,
    'receipt', v_receipt,
    'receipt_url', '/recu-scolarite/' || v_pay.payment_token,
    'balance', CASE
      WHEN v_pay.payment_kind = 'tuition' THEN
        school_tuition_balance(v_pay.student_id, v_pay.enrollment_id, v_pay.academic_year)
      ELSE NULL
    END
  );
END;
$$;

-- Confirmation manuelle / staff
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
  v_source TEXT;
  v_is_staff BOOLEAN;
BEGIN
  SELECT * INTO v_pay FROM school_payments WHERE payment_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lien de paiement invalide'; END IF;

  IF v_pay.status = 'paid' THEN
    v_receipt := issue_school_payment_receipt(v_pay.id);
    RETURN jsonb_build_object(
      'already_paid', true,
      'payment_id', v_pay.id,
      'receipt', v_receipt,
      'receipt_url', '/recu-scolarite/' || p_token,
      'confirmation_source', v_pay.confirmation_source
    );
  END IF;

  IF auth.uid() IS NOT NULL AND NOT (
    is_platform_admin()
    OR (can_manage_finance() AND belongs_to_org(v_pay.organization_id))
    OR owns_school_student(v_pay.student_id)
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  v_is_staff := is_platform_admin()
    OR (can_manage_finance() AND belongs_to_org(v_pay.organization_id));
  v_source := CASE WHEN v_is_staff THEN 'staff' ELSE 'manual' END;

  UPDATE school_payments SET
    status = 'paid',
    paid_at = now(),
    confirmation_source = v_source,
    payment_method = COALESCE(payment_method, 'other'),
    reference = COALESCE(NULLIF(trim(p_reference), ''), reference, 'PAY-' || to_char(now(), 'YYYYMMDD-HH24MISS'))
  WHERE id = v_pay.id;

  SELECT * INTO v_pay FROM school_payments WHERE id = v_pay.id;
  v_receipt := issue_school_payment_receipt(v_pay.id);

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_pay.id,
    'confirmation_source', v_source,
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

-- Enrichir lecture paiement + reçu
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
  v_balance JSONB;
  v_settings JSONB;
BEGIN
  SELECT * INTO v_pay FROM school_payments WHERE payment_token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_student FROM school_students WHERE id = v_pay.student_id;
  SELECT * INTO v_org FROM organizations WHERE id = v_pay.organization_id;
  SELECT * INTO v_person FROM core_persons WHERE id = v_student.person_id;
  v_settings := school_student_payment_settings(v_pay.organization_id);

  IF v_pay.payment_kind = 'tuition' THEN
    v_balance := school_tuition_balance(v_pay.student_id, v_pay.enrollment_id, v_pay.academic_year);
  END IF;

  RETURN jsonb_build_object(
    'payment_id', v_pay.id,
    'payment_token', v_pay.payment_token,
    'amount_gnf', v_pay.amount,
    'payment_kind', v_pay.payment_kind,
    'status', v_pay.status,
    'payment_method', v_pay.payment_method,
    'confirmation_source', v_pay.confirmation_source,
    'provider_payment_id', v_pay.provider_payment_id,
    'reference', v_pay.reference,
    'description', v_pay.description,
    'academic_year', v_pay.academic_year,
    'organization_id', v_org.id,
    'organization_name', v_org.name,
    'student_id', v_student.id,
    'student_name', v_person.full_name,
    'student_matricule', v_student.matricule,
    'enrollment_id', v_pay.enrollment_id,
    'balance', v_balance,
    'min_payment_gnf', COALESCE((v_settings->>'min_payment_gnf')::NUMERIC, 100000),
    'tuition_installments', COALESCE(v_settings->'tuition_installments', '[]'::jsonb),
    'orange_money_enabled', COALESCE((v_settings->>'orange_money_enabled')::BOOLEAN, true),
    'orange_money_merchant_phone', v_settings->>'orange_money_merchant_phone',
    'orange_money_merchant_label', v_settings->>'orange_money_merchant_label',
    'receipt_url', CASE WHEN v_pay.status = 'paid' THEN '/recu-scolarite/' || p_token ELSE NULL END
  );
END;
$$;

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
    'confirmation_source', v_pay.confirmation_source,
    'provider_payment_id', v_pay.provider_payment_id,
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

GRANT EXECUTE ON FUNCTION prepare_school_payment_orange_money(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION process_school_payment_webhook(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;
