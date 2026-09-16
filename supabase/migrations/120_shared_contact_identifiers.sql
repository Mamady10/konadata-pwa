-- Contacts partagés : plusieurs comptes peuvent utiliser le même WhatsApp / email.
-- L'identifiant Auth (profiles.email / auth.users.email) reste UNIQUE.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

COMMENT ON COLUMN profiles.contact_email IS
  'Email de contact saisi par l''utilisateur (peut être partagé entre plusieurs comptes). '
  'profiles.email reste l''identifiant Auth unique.';

COMMENT ON COLUMN profiles.phone IS
  'Téléphone / WhatsApp de contact (peut être partagé entre plusieurs comptes).';

-- Rétrofill : comptes email classiques
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
