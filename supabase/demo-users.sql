-- ============================================================
-- Comptes démo ONG + BTP
-- Exécuter APRÈS création des utilisateurs dans Supabase Auth
-- Mot de passe recommandé pour tous : Demo@Kona2026
-- ============================================================

-- 1. Authentication → Users → Add user :
--    director@fdg.gn       / Demo@Kona2026  (Auto Confirm)
--    director@guineebtp.gn / Demo@Kona2026  (Auto Confirm)

-- 2. Puis exécuter :

SELECT setup_demo_user(
  'director@fdg.gn',
  '11111111-1111-1111-1111-111111111102',
  'org_admin',
  'Fatoumata Camara'
);

SELECT setup_demo_user(
  'director@guineebtp.gn',
  '11111111-1111-1111-1111-111111111103',
  'org_admin',
  'Ibrahima Bah'
);

-- 3. Vérification :
SELECT p.full_name, p.email, p.role, o.name, o.type
FROM profiles p
JOIN organizations o ON o.id = p.organization_id
WHERE p.email IN ('director@fdg.gn', 'director@guineebtp.gn');

-- 4. Migration codes d'accès (SQL Editor) :
--    Exécuter le contenu de : supabase/migrations/012_organization_access_codes.sql
