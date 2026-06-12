-- OTP récupération mot de passe (WhatsApp / SMS)
-- Exécuter dans Supabase SQL Editor si migration 094 pas encore appliquée.

ALTER TABLE auth_phone_otp_challenges
  DROP CONSTRAINT IF EXISTS auth_phone_otp_challenges_purpose_check;

ALTER TABLE auth_phone_otp_challenges
  ADD CONSTRAINT auth_phone_otp_challenges_purpose_check
  CHECK (purpose IN ('login', 'signup', 'recovery'));
