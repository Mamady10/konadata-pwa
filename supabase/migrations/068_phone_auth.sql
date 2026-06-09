-- Authentification compte par téléphone (OTP SMS / WhatsApp)

CREATE TABLE auth_phone_otp_challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164    TEXT NOT NULL,
  phone_hash    TEXT NOT NULL,
  code_hash     TEXT NOT NULL,
  purpose       TEXT NOT NULL CHECK (purpose IN ('login', 'signup')),
  channel       TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'whatsapp')),
  ip_hash       TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  verified_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_phone_otp_phone_hash ON auth_phone_otp_challenges (phone_hash, created_at DESC);
CREATE INDEX idx_auth_phone_otp_expires ON auth_phone_otp_challenges (expires_at);

COMMENT ON TABLE auth_phone_otp_challenges IS
  'Codes OTP pour création de compte ou connexion par numéro de téléphone (distinct des OTP sondages).';

ALTER TABLE auth_phone_otp_challenges ENABLE ROW LEVEL SECURITY;

-- Accès service role uniquement (API routes)
CREATE POLICY auth_phone_otp_service ON auth_phone_otp_challenges
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles (phone) WHERE phone IS NOT NULL;

-- Profil : téléphone depuis auth.users ou metadata à l''inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(
      NULLIF(trim(NEW.phone), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'phone_e164'), '')
    ),
    'candidate'
  );
  RETURN NEW;
END;
$$;
