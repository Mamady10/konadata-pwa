-- Contacts partagés (appliquer dans SQL Editor si migrations auto non utilisées)
-- Source : supabase/migrations/120_shared_contact_identifiers.sql

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

UPDATE profiles
SET contact_email = lower(trim(email))
WHERE contact_email IS NULL
  AND email IS NOT NULL
  AND lower(email) NOT LIKE '%@phone.konadata.gn'
  AND lower(email) NOT LIKE '%@email.konadata.gn';

CREATE INDEX IF NOT EXISTS idx_profiles_phone_shared
  ON profiles (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_contact_email
  ON profiles (lower(contact_email))
  WHERE contact_email IS NOT NULL;
