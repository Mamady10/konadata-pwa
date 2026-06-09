-- ============================================================
-- Diagnostic codes d'accès (à exécuter dans Supabase SQL Editor)
-- Ne nécessite pas d'être connecté en tant qu'utilisateur app
-- ============================================================

-- 1) Table et fonctions
SELECT
  to_regclass('public.organization_access_codes') AS table_codes,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'can_issue_access_codes'
  ) AS fn_can_issue,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'generate_access_code'
  ) AS fn_generate;

-- 2) Vérifier qu'aucun directeur n'est rattaché à la mauvaise organisation
--    director@guineebtp.gn → org_id ...1103, type btp
--    director@isc.gn       → org_id ...1101, type school
SELECT
  p.email,
  p.role,
  p.is_active,
  p.organization_id,
  o.name AS org_name,
  o.type AS org_type
FROM profiles p
LEFT JOIN organizations o ON o.id = p.organization_id
WHERE lower(p.email) IN (
  'director@isc.gn',
  'director@fdg.gn',
  'director@guineebtp.gn',
  'admin@konadata.gn'
)
ORDER BY p.email;

-- 3) Codes déjà générés pour l'ISC
SELECT code, role, uses_count, max_uses, is_active, created_at
FROM organization_access_codes
WHERE organization_id = '11111111-1111-1111-1111-111111111101'
ORDER BY created_at DESC
LIMIT 10;

-- 4) Si director@isc.gn n'a PAS role = org_admin, exécutez ensuite :
--    supabase/sql-editor/FIX-director-profiles.sql
