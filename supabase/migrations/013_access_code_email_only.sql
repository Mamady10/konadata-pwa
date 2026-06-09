-- À exécuter UNIQUEMENT si 012 est déjà appliquée (table organization_access_codes existe).
-- Ne pas ré-exécuter 012 — elle provoque : relation "organization_access_codes" already exists

ALTER TABLE organization_access_codes
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

COMMENT ON COLUMN organization_access_codes.recipient_email IS 'Destinataire du dernier envoi email';
COMMENT ON COLUMN organization_access_codes.emailed_at IS 'Date du dernier envoi email';

CREATE OR REPLACE FUNCTION record_access_code_email(p_code_id UUID, p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_issue_access_codes() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE organization_access_codes SET
    recipient_email = lower(trim(p_email)),
    emailed_at = now()
  WHERE id = p_code_id
    AND organization_id = get_user_organization_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Code introuvable';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION record_access_code_email(UUID, TEXT) TO authenticated;
