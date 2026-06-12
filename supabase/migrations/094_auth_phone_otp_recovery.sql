-- OTP récupération mot de passe (WhatsApp / SMS)

ALTER TABLE auth_phone_otp_challenges
  DROP CONSTRAINT IF EXISTS auth_phone_otp_challenges_purpose_check;

ALTER TABLE auth_phone_otp_challenges
  ADD CONSTRAINT auth_phone_otp_challenges_purpose_check
  CHECK (purpose IN ('login', 'signup', 'recovery'));

COMMENT ON TABLE auth_phone_otp_challenges IS
  'OTP auth : connexion, inscription (legacy), récupération mot de passe.';
