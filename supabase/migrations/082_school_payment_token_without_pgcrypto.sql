-- Jeton de paiement / reçu sans dépendance à pgcrypto (gen_random_bytes)

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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
  v_receipt JSONB;
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

  v_receipt := issue_school_payment_receipt(p_payment_id);
  RETURN v_receipt || jsonb_build_object('receipt_url', '/recu-scolarite/' || v_pay.payment_token);
END;
$$;

GRANT EXECUTE ON FUNCTION school_payment_random_token() TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_school_payment_receipt(UUID) TO authenticated;
