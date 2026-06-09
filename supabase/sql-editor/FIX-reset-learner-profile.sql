-- Réinitialise un compte créé par erreur en « Directeur » au lieu de candidat.
-- Remplacez l'email par celui du compte concerné, puis exécutez dans Supabase SQL Editor.

UPDATE profiles
SET
  role = 'candidate',
  organization_id = NULL,
  onboarding_path = 'learner'
WHERE lower(email) = lower('VOTRE_EMAIL@exemple.gn');

-- Vérification :
SELECT id, email, role, organization_id, onboarding_path
FROM profiles
WHERE lower(email) = lower('VOTRE_EMAIL@exemple.gn');
