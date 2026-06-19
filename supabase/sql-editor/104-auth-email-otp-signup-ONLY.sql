-- Migration 104 — OTP email inscription (à exécuter dans SQL Editor Supabase)

CREATE TABLE IF NOT EXISTS auth_email_otp_challenges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  email_hash    TEXT NOT NULL,
  code_hash     TEXT NOT NULL,
  purpose       TEXT NOT NULL DEFAULT 'signup' CHECK (purpose IN ('signup')),
  ip_hash       TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  verified_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_email_otp_email_hash
  ON auth_email_otp_challenges (email_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_email_otp_expires
  ON auth_email_otp_challenges (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_email_otp_ip_hash
  ON auth_email_otp_challenges (ip_hash, created_at DESC);

COMMENT ON TABLE auth_email_otp_challenges IS
  'Codes OTP email pour confirmation inscription.';

ALTER TABLE auth_email_otp_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_email_otp_service ON auth_email_otp_challenges;
CREATE POLICY auth_email_otp_service ON auth_email_otp_challenges
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
