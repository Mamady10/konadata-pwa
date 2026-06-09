-- Créer le compte CEO KonaData (platform_admin)
-- À exécuter dans Supabase → SQL Editor APRÈS avoir créé l'utilisateur dans Authentication.

-- 1) Dashboard → Authentication → Users → Add user
--    Email : ceo@konadata.gn (ou le vôtre)
--    Mot de passe : choisissez un mot de passe fort
--    Cochez "Auto Confirm User" si disponible (évite le blocage email)

-- 2) Remplacez l'email ci-dessous puis Run :

UPDATE profiles
SET
  role = 'platform_admin',
  organization_id = NULL,
  full_name = 'CEO KonaData',
  is_active = true
WHERE lower(email) = lower('ceo@konadata.gn');

-- 3) Vérification :
SELECT id, email, role, organization_id, full_name, is_active
FROM profiles
WHERE lower(email) = lower('ceo@konadata.gn');

-- Attendu : role = platform_admin, organization_id = NULL
