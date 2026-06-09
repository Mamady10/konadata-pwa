-- Promouvoir mamadyk@gmail.com en CEO KonaData (platform_admin)
-- Supabase → SQL Editor → Run

UPDATE profiles
SET
  role = 'platform_admin',
  organization_id = NULL,
  full_name = COALESCE(NULLIF(trim(full_name), ''), 'CEO KonaData'),
  is_active = true
WHERE lower(email) = lower('mamadyk@gmail.com');

-- Si 0 ligne mise à jour : l'utilisateur Auth existe mais pas encore de profil
INSERT INTO profiles (id, email, full_name, role, organization_id, is_active)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', 'CEO KonaData'),
  'platform_admin',
  NULL,
  true
FROM auth.users u
WHERE lower(u.email) = lower('mamadyk@gmail.com')
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id);

UPDATE profiles
SET
  role = 'platform_admin',
  organization_id = NULL,
  is_active = true
WHERE id IN (SELECT id FROM auth.users WHERE lower(email) = lower('mamadyk@gmail.com'));

SELECT id, email, role, organization_id, full_name, is_active
FROM profiles
WHERE lower(email) = lower('mamadyk@gmail.com');
