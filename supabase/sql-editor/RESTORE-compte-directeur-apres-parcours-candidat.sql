-- Si un directeur est bloqué sur « nouvel étudiant », le profil a souvent été passé en candidat
-- (role = candidate, organization_id = NULL). À adapter : email et UUID organisation.

-- 1) Diagnostic
SELECT
  p.id,
  p.email,
  p.role,
  p.organization_id,
  p.onboarding_path,
  o.name AS org_name,
  o.type AS org_type
FROM profiles p
LEFT JOIN organizations o ON o.id = p.organization_id
WHERE p.email = 'mamadyk@gmail.com';  -- ← votre email

-- 2) Restaurer le rattachement (remplacer l'UUID organisation)
-- SELECT id, name FROM organizations WHERE name ILIKE '%votre établissement%';

UPDATE profiles
SET
  role = 'org_admin',
  organization_id = '00000000-0000-0000-0000-000000000000'::uuid,  -- ← UUID org
  onboarding_path = 'director'
WHERE email = 'mamadyk@gmail.com';

-- 3) Vérification
SELECT id, email, role, organization_id, onboarding_path FROM profiles
WHERE email = 'mamadyk@gmail.com';
