-- ============================================================
-- KonaData v2 — Noyau plateforme (multi-tenant)
-- ============================================================

-- ─── ORGANIZATIONS (tenant racine) ───────────────────────────

CREATE TABLE organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  type       organization_type NOT NULL,
  email      TEXT,
  phone      TEXT,
  address    TEXT,
  logo_url   TEXT,
  settings   JSONB NOT NULL DEFAULT '{}',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX idx_organizations_type ON organizations(type);
CREATE INDEX idx_organizations_active ON organizations(is_active);

COMMENT ON TABLE organizations IS 'Tenant racine — chaque client (école, ONG, BTP) est une organisation isolée.';

-- ─── PROFILES (1:1 avec auth.users) ───────────────────────────

CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  role            app_role NOT NULL DEFAULT 'candidate',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  avatar_url      TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_email_not_empty CHECK (char_length(trim(email)) > 0)
);

CREATE INDEX idx_profiles_organization ON profiles(organization_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE UNIQUE INDEX idx_profiles_email ON profiles(lower(email));

COMMENT ON TABLE profiles IS 'Extension métier de auth.users — RBAC et rattachement organisation.';

-- ─── Triggers updated_at ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Création automatique du profil à l''inscription Auth ─────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    'candidate'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Contrainte : organization_id obligatoire sauf plateforme ─

CREATE OR REPLACE FUNCTION enforce_profile_org_for_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role NOT IN ('platform_admin', 'candidate') AND NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id requis pour le rôle %', NEW.role;
  END IF;
  IF NEW.role = 'platform_admin' AND NEW.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'platform_admin ne doit pas être rattaché à une organisation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_enforce_org
  BEFORE INSERT OR UPDATE OF role, organization_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_profile_org_for_role();

-- ─── Audit & notifications (noyau) ─────────────────────────────

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action          audit_action NOT NULL,
  resource_type   TEXT,
  resource_id     UUID,
  details         JSONB NOT NULL DEFAULT '{}',
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'info',
  is_read         BOOLEAN NOT NULL DEFAULT false,
  link            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
