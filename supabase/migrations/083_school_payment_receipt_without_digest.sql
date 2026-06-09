-- Code de vérification reçu sans pgcrypto (digest)

CREATE OR REPLACE FUNCTION school_payment_verification_code(p_payment_id UUID, p_token TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT upper(substr(md5(p_payment_id::TEXT || COALESCE(p_token, '')), 1, 8));
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
  v_verify := school_payment_verification_code(v_pay.id, v_pay.payment_token);

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

GRANT EXECUTE ON FUNCTION school_payment_verification_code(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION issue_school_payment_receipt(UUID) TO authenticated;
