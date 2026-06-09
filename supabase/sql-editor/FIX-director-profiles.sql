-- ============================================================
-- Corrige les profils directeurs démo (rôle org_admin + org ISC/FDG/BTP)
-- À exécuter si DIAG-access-codes.sql montre un rôle incorrect
-- (ex. director, country_director, super_admin, ou platform_admin par erreur)
-- ============================================================

-- Normalise aussi les anciens rôles texte (director, super_admin, etc.)
UPDATE profiles SET
  role = 'org_admin'::app_role,
  organization_id = '11111111-1111-1111-1111-111111111101',
  is_active = true
WHERE lower(email) = 'director@isc.gn'
   OR (organization_id = '11111111-1111-1111-1111-111111111101' AND role::text IN ('director', 'super_admin'));

UPDATE profiles SET
  role = 'org_admin'::app_role,
  organization_id = '11111111-1111-1111-1111-111111111102',
  is_active = true
WHERE lower(email) = 'director@fdg.gn';

UPDATE profiles SET
  role = 'org_admin'::app_role,
  organization_id = '11111111-1111-1111-1111-111111111103',
  is_active = true
WHERE lower(email) = 'director@guineebtp.gn';

-- Vérification
SELECT email, role, is_active, organization_id
FROM profiles
WHERE lower(email) IN ('director@isc.gn', 'director@fdg.gn', 'director@guineebtp.gn');
