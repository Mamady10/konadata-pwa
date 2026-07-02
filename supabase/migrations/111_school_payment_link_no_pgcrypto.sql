-- Correctif : "function gen_random_bytes(integer) does not exist" à la génération
-- d'un lien de paiement élève. On remplace encode(gen_random_bytes()) par un
-- jeton basé sur gen_random_uuid() (disponible sans pgcrypto dans le search_path).

CREATE OR REPLACE FUNCTION school_payment_random_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
$$;

GRANT EXECUTE ON FUNCTION school_payment_random_token() TO authenticated;

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

  v_token := school_payment_random_token();

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
