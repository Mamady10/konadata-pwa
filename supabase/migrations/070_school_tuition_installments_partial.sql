-- Tranches scolarité, paiements partiels, tuteurs, portail matricule, rappels SMS

-- ─── Tuteur / responsable financier ───────────────────────────
ALTER TABLE school_enrollments
  ADD COLUMN IF NOT EXISTS guardian_name TEXT,
  ADD COLUMN IF NOT EXISTS guardian_phone TEXT,
  ADD COLUMN IF NOT EXISTS guardian_relation TEXT,
  ADD COLUMN IF NOT EXISTS guardian_sms_consent BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN school_enrollments.guardian_phone IS
  'Téléphone du tuteur pour rappels de paiement (format libre, normalisé côté app).';

-- ─── Journal rappels SMS tranches ─────────────────────────────
CREATE TABLE IF NOT EXISTS school_tuition_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES school_enrollments(id) ON DELETE SET NULL,
  installment_index INT NOT NULL DEFAULT 0,
  reminder_kind TEXT NOT NULL CHECK (reminder_kind IN ('7d', '1d', 'due', 'overdue')),
  phone_e164 TEXT NOT NULL,
  academic_year TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (
    organization_id, student_id, enrollment_id, installment_index, reminder_kind, academic_year
  )
);

CREATE INDEX IF NOT EXISTS idx_tuition_reminder_log_org
  ON school_tuition_reminder_log(organization_id, sent_at DESC);

-- ─── OTP portail paiement public (matricule) ──────────────────
CREATE TABLE IF NOT EXISTS school_payment_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  ip_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_payment_otp_student
  ON school_payment_otp_challenges(student_id, created_at DESC);

-- ─── Année scolaire courante ──────────────────────────────────
CREATE OR REPLACE FUNCTION school_current_academic_year()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || (EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 1)::TEXT;
$$;

-- ─── Paramètres paiements élèves (tranches + min) ─────────────
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
      'tuition_installments', '[]'::jsonb
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
        'tuition_installments', COALESCE(p_settings->'tuition_installments', '[]'::jsonb)
      ),
      true
    )
  WHERE id = p_org_id AND type = 'school';

  RETURN school_student_payment_settings(p_org_id);
END;
$$;

-- ─── Montant déjà payé (scolarité) ────────────────────────────
CREATE OR REPLACE FUNCTION school_tuition_paid_amount(
  p_student_id UUID,
  p_enrollment_id UUID DEFAULT NULL,
  p_academic_year TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM school_payments
  WHERE student_id = p_student_id
    AND payment_kind = 'tuition'
    AND status = 'paid'
    AND (p_enrollment_id IS NULL OR enrollment_id = p_enrollment_id)
    AND (
      p_academic_year IS NULL
      OR academic_year IS NULL
      OR academic_year = p_academic_year
    );
$$;

-- ─── Solde scolarité ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION school_tuition_balance(
  p_student_id UUID,
  p_enrollment_id UUID DEFAULT NULL,
  p_academic_year TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student school_students%ROWTYPE;
  v_total NUMERIC;
  v_paid NUMERIC;
  v_year TEXT;
BEGIN
  SELECT * INTO v_student FROM school_students WHERE id = p_student_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Élève introuvable');
  END IF;

  v_year := COALESCE(p_academic_year, school_current_academic_year());
  v_total := school_payment_amount_for_kind(
    v_student.organization_id, 'tuition', p_student_id, p_enrollment_id
  );
  v_paid := school_tuition_paid_amount(p_student_id, p_enrollment_id, v_year);

  RETURN jsonb_build_object(
    'total_due_gnf', v_total,
    'paid_gnf', v_paid,
    'remaining_gnf', GREATEST(0, v_total - v_paid),
    'academic_year', v_year,
    'fully_paid', v_total > 0 AND v_paid >= v_total
  );
END;
$$;

-- ─── Création lien paiement (cœur, sans contrôle auth) ────────
CREATE OR REPLACE FUNCTION school_create_payment_link_core(
  p_student_id UUID,
  p_kind TEXT,
  p_enrollment_id UUID DEFAULT NULL,
  p_amount NUMERIC DEFAULT NULL
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
  v_year TEXT := school_current_academic_year();
  v_balance JSONB;
  v_remaining NUMERIC;
  v_min NUMERIC;
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
    v_amount := school_payment_amount_for_kind(v_student.organization_id, p_kind, p_student_id, p_enrollment_id);
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'Montant non configuré — demandez à l''établissement de fixer les frais';
    END IF;

    SELECT * INTO v_payment FROM school_payments
    WHERE student_id = p_student_id
      AND payment_kind = p_kind
      AND status = 'pending'
      AND enrollment_id = p_enrollment_id
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

    v_balance := school_tuition_balance(p_student_id, p_enrollment_id, v_year);
    v_remaining := COALESCE((v_balance->>'remaining_gnf')::NUMERIC, 0);
    IF v_remaining <= 0 THEN
      RAISE EXCEPTION 'Scolarité déjà réglée pour cette année';
    END IF;

    v_min := GREATEST(10000, COALESCE((v_settings->>'min_payment_gnf')::NUMERIC, 100000));

    IF p_amount IS NOT NULL AND p_amount > 0 THEN
      v_amount := p_amount;
    ELSE
      v_amount := v_remaining;
    END IF;

    IF v_amount < v_min THEN
      RAISE EXCEPTION 'Montant minimum : % GNF', v_min;
    END IF;
    IF v_amount > v_remaining THEN
      RAISE EXCEPTION 'Montant supérieur au solde restant (% GNF)', v_remaining;
    END IF;
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
      ELSE 'Frais de scolarité (versement partiel)'
    END,
    CURRENT_DATE
  )
  RETURNING * INTO v_payment;

  RETURN jsonb_build_object(
    'payment_id', v_payment.id,
    'payment_token', v_payment.payment_token,
    'amount_gnf', v_payment.amount,
    'payment_kind', v_payment.payment_kind,
    'status', v_payment.status,
    'balance', school_tuition_balance(p_student_id, p_enrollment_id, v_year)
  );
END;
$$;

-- ─── Création lien paiement (montant libre pour scolarité) ────
CREATE OR REPLACE FUNCTION create_school_student_payment_link(
  p_student_id UUID,
  p_kind TEXT,
  p_enrollment_id UUID DEFAULT NULL,
  p_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student school_students%ROWTYPE;
BEGIN
  SELECT * INTO v_student FROM school_students WHERE id = p_student_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Élève introuvable'; END IF;

  IF NOT (
    is_platform_admin()
    OR (is_school_staff() AND belongs_to_org(v_student.organization_id))
    OR owns_school_student(p_student_id)
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  RETURN school_create_payment_link_core(p_student_id, p_kind, p_enrollment_id, p_amount);
END;
$$;

-- Lien paiement via OTP portail public (sans compte)
CREATE OR REPLACE FUNCTION create_school_student_payment_link_public(
  p_student_id UUID,
  p_challenge_id UUID,
  p_amount NUMERIC,
  p_enrollment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge school_payment_otp_challenges%ROWTYPE;
BEGIN
  SELECT * INTO v_challenge FROM school_payment_otp_challenges
  WHERE id = p_challenge_id AND student_id = p_student_id AND verified_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vérification OTP requise';
  END IF;
  IF v_challenge.verified_at < now() - interval '30 minutes' THEN
    RAISE EXCEPTION 'Session expirée — recommencez la vérification';
  END IF;

  RETURN school_create_payment_link_core(p_student_id, 'tuition', p_enrollment_id, p_amount);
END;
$$;

-- ─── Lecture paiement par token (public) ──────────────────────
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
    'tuition_installments', COALESCE(v_settings->'tuition_installments', '[]'::jsonb)
  );
END;
$$;

-- ─── Enregistrer paiement (token = autorisation si anonyme) ─────
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

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_pay.id,
    'balance', CASE
      WHEN v_pay.payment_kind = 'tuition' THEN
        school_tuition_balance(v_pay.student_id, v_pay.enrollment_id, v_pay.academic_year)
      ELSE NULL
    END
  );
END;
$$;

-- ─── Recherche élève par matricule (portail public) ───────────
CREATE OR REPLACE FUNCTION lookup_school_student_for_public_payment(
  p_org_id UUID,
  p_matricule TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student school_students%ROWTYPE;
  v_person core_persons%ROWTYPE;
  v_settings JSONB;
  v_balance JSONB;
  v_enrollment_id UUID;
  v_masked TEXT;
BEGIN
  IF NOT COALESCE((school_student_payment_settings(p_org_id)->>'enabled')::BOOLEAN, false) THEN
    RETURN jsonb_build_object('error', 'Paiements en ligne non activés pour cet établissement');
  END IF;

  SELECT ss.* INTO v_student
  FROM school_students ss
  WHERE ss.organization_id = p_org_id
    AND upper(trim(ss.matricule)) = upper(trim(p_matricule))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Matricule introuvable');
  END IF;

  IF v_student.enrollment_status NOT IN ('admitted', 'enrolled') THEN
    RETURN jsonb_build_object('error', 'Paiement scolarité disponible après admission ou inscription');
  END IF;

  SELECT * INTO v_person FROM core_persons WHERE id = v_student.person_id;

  SELECT e.id INTO v_enrollment_id
  FROM school_enrollments e
  WHERE e.student_id = v_student.id
    AND e.status IN ('admitted', 'enrolled')
  ORDER BY e.created_at DESC
  LIMIT 1;

  v_balance := school_tuition_balance(v_student.id, v_enrollment_id, NULL);
  IF COALESCE((v_balance->>'remaining_gnf')::NUMERIC, 0) <= 0 THEN
    RETURN jsonb_build_object('error', 'Scolarité déjà réglée pour cette année');
  END IF;

  v_settings := school_student_payment_settings(p_org_id);

  IF v_person.full_name IS NOT NULL AND length(v_person.full_name) > 2 THEN
    v_masked := left(v_person.full_name, 1) || '***' || right(v_person.full_name, 1);
  ELSE
    v_masked := 'Élève';
  END IF;

  RETURN jsonb_build_object(
    'student_id', v_student.id,
    'enrollment_id', v_enrollment_id,
    'masked_name', v_masked,
    'matricule', v_student.matricule,
    'balance', v_balance,
    'min_payment_gnf', COALESCE((v_settings->>'min_payment_gnf')::NUMERIC, 100000),
    'tuition_installments', COALESCE(v_settings->'tuition_installments', '[]'::jsonb)
  );
END;
$$;

-- ─── Cibles rappels SMS tranches ──────────────────────────────
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
    COALESCE((i.elem->>'amount_gnf')::NUMERIC, 0),
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

-- ─── Inscription : champs tuteur ──────────────────────────────
CREATE OR REPLACE FUNCTION apply_to_school_as_learner(
  p_org_id UUID,
  p_study_level TEXT,
  p_department TEXT,
  p_program TEXT,
  p_class_id UUID DEFAULT NULL,
  p_request_type TEXT DEFAULT 'new',
  p_reenrollment_code TEXT DEFAULT NULL,
  p_academic_year TEXT DEFAULT '2025-2026',
  p_guardian_name TEXT DEFAULT NULL,
  p_guardian_phone TEXT DEFAULT NULL,
  p_guardian_relation TEXT DEFAULT NULL,
  p_guardian_sms_consent BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_person_id UUID;
  v_student_id UUID;
  v_enrollment_id UUID;
  v_code_id UUID;
  v_verified BOOLEAN := false;
  v_norm_code TEXT;
  v_applicant_name TEXT;
  v_has_extended BOOLEAN;
  v_has_guardian BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Non authentifié');
  END IF;

  IF p_request_type NOT IN ('new', 'reenrollment') THEN
    RETURN jsonb_build_object('error', 'Type de demande invalide');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = p_org_id AND o.type = 'school' AND o.is_active = true
  ) THEN
    RETURN jsonb_build_object('error', 'Établissement introuvable ou inactif');
  END IF;

  SELECT id, full_name, email, organization_id, role
  INTO v_profile
  FROM profiles
  WHERE id = v_user_id;

  IF p_request_type = 'reenrollment' THEN
    v_norm_code := upper(trim(COALESCE(p_reenrollment_code, '')));
    IF length(v_norm_code) < 4 THEN
      RETURN jsonb_build_object('error', 'Code de réinscription requis (min. 4 caractères)');
    END IF;
    SELECT id INTO v_code_id
    FROM school_reenrollment_codes
    WHERE organization_id = p_org_id
      AND upper(trim(code)) = v_norm_code
      AND is_active = true
      AND used_at IS NULL;
    IF v_code_id IS NOT NULL THEN
      v_verified := true;
    END IF;
  END IF;

  v_applicant_name := COALESCE(NULLIF(trim(v_profile.full_name), ''), split_part(v_profile.email, '@', 1));

  SELECT id INTO v_person_id
  FROM core_persons
  WHERE profile_id = v_user_id AND organization_id = p_org_id
  LIMIT 1;

  IF v_person_id IS NULL THEN
    INSERT INTO core_persons (
      organization_id, profile_id, kind, full_name, email
    ) VALUES (
      p_org_id, v_user_id, 'candidate', v_applicant_name, v_profile.email
    )
    RETURNING id INTO v_person_id;
  END IF;

  SELECT id INTO v_student_id
  FROM school_students
  WHERE person_id = v_person_id AND organization_id = p_org_id
  LIMIT 1;

  IF v_student_id IS NULL THEN
    INSERT INTO school_students (organization_id, person_id, class_id, enrollment_status)
    VALUES (p_org_id, v_person_id, p_class_id, 'pending')
    RETURNING id INTO v_student_id;
  ELSIF p_class_id IS NOT NULL THEN
    UPDATE school_students SET class_id = p_class_id WHERE id = v_student_id;
  END IF;

  UPDATE profiles
  SET organization_id = p_org_id,
      role = CASE WHEN v_profile.role = 'student' THEN 'student' ELSE 'candidate' END,
      onboarding_path = 'learner'
  WHERE id = v_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'school_enrollments' AND column_name = 'request_type'
  ) INTO v_has_extended;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'school_enrollments' AND column_name = 'guardian_phone'
  ) INTO v_has_guardian;

  IF v_has_extended AND v_has_guardian THEN
    INSERT INTO school_enrollments (
      organization_id, student_id, class_id, academic_year, status,
      applicant_name, applicant_email, request_type, study_level, department, program,
      reenrollment_verification_code, reenrollment_code_verified, notes,
      guardian_name, guardian_phone, guardian_relation, guardian_sms_consent
    ) VALUES (
      p_org_id, v_student_id, p_class_id, p_academic_year, 'pending',
      v_applicant_name, v_profile.email, p_request_type, p_study_level, p_department, p_program,
      CASE WHEN p_request_type = 'reenrollment' THEN upper(trim(p_reenrollment_code)) ELSE NULL END,
      v_verified,
      CASE WHEN p_request_type = 'reenrollment' THEN 'Réinscription' ELSE 'Nouvelle inscription' END,
      NULLIF(trim(p_guardian_name), ''),
      NULLIF(trim(p_guardian_phone), ''),
      NULLIF(trim(p_guardian_relation), ''),
      COALESCE(p_guardian_sms_consent, false)
    )
    RETURNING id INTO v_enrollment_id;
  ELSIF v_has_extended THEN
    INSERT INTO school_enrollments (
      organization_id, student_id, class_id, academic_year, status,
      applicant_name, applicant_email, request_type, study_level, department, program,
      reenrollment_verification_code, reenrollment_code_verified, notes
    ) VALUES (
      p_org_id, v_student_id, p_class_id, p_academic_year, 'pending',
      v_applicant_name, v_profile.email, p_request_type, p_study_level, p_department, p_program,
      CASE WHEN p_request_type = 'reenrollment' THEN upper(trim(p_reenrollment_code)) ELSE NULL END,
      v_verified,
      CASE WHEN p_request_type = 'reenrollment' THEN 'Réinscription' ELSE 'Nouvelle inscription' END
    )
    RETURNING id INTO v_enrollment_id;
  ELSE
    INSERT INTO school_enrollments (
      organization_id, student_id, class_id, academic_year, status,
      applicant_name, applicant_email, notes
    ) VALUES (
      p_org_id, v_student_id, p_class_id, p_academic_year, 'pending',
      v_applicant_name, v_profile.email,
      CASE WHEN p_request_type = 'reenrollment' THEN 'Réinscription' ELSE 'Nouvelle inscription' END
    )
    RETURNING id INTO v_enrollment_id;
  END IF;

  IF v_code_id IS NOT NULL AND v_enrollment_id IS NOT NULL THEN
    UPDATE school_reenrollment_codes
    SET used_at = now(), used_by_enrollment_id = v_enrollment_id, is_active = false
    WHERE id = v_code_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'enrollment_id', v_enrollment_id);
END;
$$;

-- ─── Grants ───────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION school_current_academic_year() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION school_create_payment_link_core(UUID, TEXT, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION school_tuition_paid_amount(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION school_tuition_balance(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_school_student_payment_link(UUID, TEXT, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION create_school_student_payment_link_public(UUID, UUID, NUMERIC, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_school_student_payment_by_token(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION record_school_student_payment_by_token(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION lookup_school_student_for_public_payment(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION list_school_tuition_reminder_targets(TEXT) TO authenticated;
