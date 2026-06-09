-- ============================================================
-- KonaData — Codes d'accès collaborateurs (migration 012)
-- À exécuter SEUL si la table organization_access_codes n'existe pas encore.
-- Prérequis : migrations 001–011 déjà appliquées.
-- ============================================================
-- Vérification rapide :
--   SELECT to_regclass('public.organization_access_codes');
-- Si NULL → exécuter ce fichier entier dans Supabase SQL Editor.

-- Copie idempotente : le fichier migrations/012_organization_access_codes.sql
-- est la source de vérité. Ce script est identique pour déploiement manuel.

CREATE TABLE IF NOT EXISTS organization_access_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  role            app_role NOT NULL,
  label           TEXT,
  max_uses        INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0 AND max_uses <= 100),
  uses_count      INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  expires_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT access_code_uses_valid CHECK (uses_count <= max_uses)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_codes_code_upper ON organization_access_codes (upper(trim(code)));
CREATE INDEX IF NOT EXISTS idx_access_codes_org ON organization_access_codes (organization_id, is_active);

-- ─── Fonctions (CREATE OR REPLACE = ré-exécutable) ─────────────

CREATE OR REPLACE FUNCTION can_issue_access_codes()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('org_admin', 'deputy_director')
    AND get_user_organization_id() IS NOT NULL
    AND NOT is_platform_admin()
$$;

GRANT EXECUTE ON FUNCTION can_issue_access_codes() TO authenticated;

CREATE OR REPLACE FUNCTION count_org_responsables(p_org_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM profiles
  WHERE organization_id = p_org_id
    AND role IN ('org_admin', 'deputy_director')
    AND is_active = true
$$;

CREATE OR REPLACE FUNCTION enforce_max_org_responsables()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_count INTEGER;
  v_deputy_count INTEGER;
BEGIN
  IF NEW.organization_id IS NULL OR NEW.role NOT IN ('org_admin', 'deputy_director') THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'org_admin' THEN
    SELECT COUNT(*) INTO v_admin_count FROM profiles
    WHERE organization_id = NEW.organization_id
      AND role = 'org_admin'
      AND is_active = true
      AND id <> NEW.id;
    IF v_admin_count >= 1 THEN
      RAISE EXCEPTION 'Une organisation ne peut avoir qu''un seul directeur (org_admin)';
    END IF;
  END IF;

  IF NEW.role = 'deputy_director' THEN
    SELECT COUNT(*) INTO v_deputy_count FROM profiles
    WHERE organization_id = NEW.organization_id
      AND role = 'deputy_director'
      AND is_active = true
      AND id <> NEW.id;
    IF v_deputy_count >= 1 THEN
      RAISE EXCEPTION 'Une organisation ne peut avoir qu''un seul directeur adjoint';
    END IF;
  END IF;

  IF count_org_responsables(NEW.organization_id) >= 2
     AND NEW.role IN ('org_admin', 'deputy_director')
     AND NOT EXISTS (
       SELECT 1 FROM profiles p
       WHERE p.id = NEW.id AND p.role IN ('org_admin', 'deputy_director')
     ) THEN
    RAISE EXCEPTION 'Maximum 2 responsables par organisation (directeur + adjoint)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_max_responsables ON profiles;
CREATE TRIGGER trg_profiles_max_responsables
  BEFORE INSERT OR UPDATE OF role, organization_id, is_active ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_max_org_responsables();

CREATE OR REPLACE FUNCTION is_role_allowed_for_org(p_org_type organization_type, p_role app_role)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_org_type
    WHEN 'school' THEN p_role IN (
      'deputy_director', 'registrar', 'accountant', 'teacher', 'student', 'candidate'
    )
    WHEN 'ngo' THEN p_role IN ('deputy_director', 'ngo_staff')
    WHEN 'btp' THEN p_role IN ('deputy_director', 'btp_staff')
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION random_access_code_segment(p_len INTEGER DEFAULT 4)
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, p_len))
$$;

CREATE OR REPLACE FUNCTION generate_access_code(
  p_role        app_role,
  p_label       TEXT DEFAULT NULL,
  p_max_uses    INTEGER DEFAULT 1,
  p_expires_days INTEGER DEFAULT 30
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id   UUID;
  v_org_type organization_type;
  v_code     TEXT;
  v_attempts INTEGER := 0;
BEGIN
  IF NOT can_issue_access_codes() THEN
    RAISE EXCEPTION 'Seuls les responsables (directeur ou adjoint) peuvent générer des codes';
  END IF;

  v_org_id := get_user_organization_id();
  v_org_type := get_user_org_type();

  IF p_role IN ('org_admin', 'platform_admin') THEN
    RAISE EXCEPTION 'Le rôle % ne peut pas être attribué via code d''accès', p_role;
  END IF;

  IF p_role = 'deputy_director' AND NOT has_role('org_admin') THEN
    RAISE EXCEPTION 'Seul le directeur peut inviter un directeur adjoint';
  END IF;

  IF NOT is_role_allowed_for_org(v_org_type, p_role) THEN
    RAISE EXCEPTION 'Le rôle % n''est pas autorisé pour une organisation de type %', p_role, v_org_type;
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    v_code := 'KONA-' || random_access_code_segment(4) || '-' || random_access_code_segment(4);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM organization_access_codes WHERE upper(trim(code)) = upper(trim(v_code))
    );
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Impossible de générer un code unique';
    END IF;
  END LOOP;

  INSERT INTO organization_access_codes (
    organization_id, code, role, label, max_uses, expires_at, created_by
  ) VALUES (
    v_org_id,
    v_code,
    p_role,
    NULLIF(trim(p_label), ''),
    GREATEST(1, LEAST(COALESCE(p_max_uses, 1), 100)),
    now() + (COALESCE(p_expires_days, 30) || ' days')::INTERVAL,
    auth.uid()
  );

  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_access_code(app_role, TEXT, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION redeem_access_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_row organization_access_codes%ROWTYPE;
  v_org organizations%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF get_user_organization_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Vous êtes déjà rattaché à une organisation';
  END IF;

  SELECT * INTO v_row
  FROM organization_access_codes
  WHERE upper(trim(code)) = upper(trim(p_code))
    AND is_active = true
    AND uses_count < max_uses
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Code invalide, expiré ou déjà utilisé';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = v_row.organization_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organisation introuvable ou inactive';
  END IF;

  IF NOT is_role_allowed_for_org(v_org.type, v_row.role) THEN
    RAISE EXCEPTION 'Rôle incompatible avec le type d''organisation';
  END IF;

  IF v_row.role = 'deputy_director' THEN
    IF EXISTS (
      SELECT 1 FROM profiles
      WHERE organization_id = v_row.organization_id
        AND role = 'deputy_director'
        AND is_active = true
        AND id <> v_user_id
    ) THEN
      RAISE EXCEPTION 'Le poste de directeur adjoint est déjà pourvu';
    END IF;
  END IF;

  UPDATE profiles SET
    organization_id = v_row.organization_id,
    role = v_row.role
  WHERE id = v_user_id;

  UPDATE organization_access_codes SET
    uses_count = uses_count + 1,
    is_active = CASE WHEN uses_count + 1 >= max_uses THEN false ELSE is_active END
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'organization_id', v_row.organization_id,
    'organization_name', v_org.name,
    'organization_type', v_org.type,
    'role', v_row.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_access_code(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION revoke_access_code(p_code_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_issue_access_codes() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE organization_access_codes SET is_active = false
  WHERE id = p_code_id
    AND organization_id = get_user_organization_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Code introuvable';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION revoke_access_code(UUID) TO authenticated;

ALTER TABLE organization_access_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS access_codes_select ON organization_access_codes;
DROP POLICY IF EXISTS access_codes_insert ON organization_access_codes;
DROP POLICY IF EXISTS access_codes_update ON organization_access_codes;

CREATE POLICY access_codes_select ON organization_access_codes FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR (organization_id = get_user_organization_id() AND can_issue_access_codes())
  );

CREATE POLICY access_codes_insert ON organization_access_codes FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND can_issue_access_codes()
  );

CREATE POLICY access_codes_update ON organization_access_codes FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id() AND can_issue_access_codes())
  WITH CHECK (organization_id = get_user_organization_id() AND can_issue_access_codes());

-- Colonnes email (migration 013, idempotent)
ALTER TABLE organization_access_codes
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION record_access_code_email(p_code_id UUID, p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_issue_access_codes() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE organization_access_codes SET
    recipient_email = lower(trim(p_email)),
    emailed_at = now()
  WHERE id = p_code_id
    AND organization_id = get_user_organization_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Code introuvable';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION record_access_code_email(UUID, TEXT) TO authenticated;

-- Test (connecté en tant que directeur ISC dans l'app, ou remplacer auth.uid()) :
-- SELECT can_issue_access_codes();
-- SELECT generate_access_code('teacher'::app_role, 'Test prof', 1, 30);
