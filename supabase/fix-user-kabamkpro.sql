-- Vérifier l'état du compte kabamkpro@gmail.com
SELECT
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at,
  encrypted_password IS NOT NULL AS has_password
FROM auth.users
WHERE email = 'kabamkpro@gmail.com';

-- Forcer la confirmation email (si email_confirmed_at est NULL)
UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE email = 'kabamkpro@gmail.com';

-- Revérifier
SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'kabamkpro@gmail.com';

-- Si le compte pose toujours problème : supprimer et recréer via /rejoindre
-- (décommentez seulement si vous voulez repartir de zéro)
-- DELETE FROM auth.users WHERE email = 'kabamkpro@gmail.com';
