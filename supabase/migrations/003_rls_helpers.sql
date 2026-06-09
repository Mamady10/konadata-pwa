-- ============================================================
-- KonaData v2 — Fonctions RLS & RBAC (SECURITY DEFINER)
-- ============================================================

-- Identité courante
CREATE OR REPLACE FUNCTION auth_uid()
RETURNS UUID
LANGUAGE sql STABLE
AS $$ SELECT auth.uid() $$;

CREATE OR REPLACE FUNCTION is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$ SELECT auth.uid() IS NOT NULL $$;

-- Contexte utilisateur (depuis profiles)
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_user_org_type()
RETURNS organization_type
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.type
  FROM profiles p
  JOIN organizations o ON o.id = p.organization_id
  WHERE p.id = auth.uid()
$$;

-- ─── Contrôles rôle ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'platform_admin' AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION has_role(VARIADIC p_roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = ANY(p_roles) AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director')
$$;

CREATE OR REPLACE FUNCTION can_manage_users()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director', 'registrar')
$$;

CREATE OR REPLACE FUNCTION can_manage_finance()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'accountant')
$$;

-- ─── Accès organisation (multi-tenant) ─────────────────────────

CREATE OR REPLACE FUNCTION belongs_to_org(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_platform_admin()
    OR (
      is_authenticated()
      AND p_org_id IS NOT NULL
      AND p_org_id = get_user_organization_id()
    )
$$;

-- Aucun accès si l'utilisateur n'a pas d'organisation (sauf platform_admin)
CREATE OR REPLACE FUNCTION has_tenant_context()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_platform_admin() OR get_user_organization_id() IS NOT NULL
$$;

-- ─── Accès par type de module ──────────────────────────────────

CREATE OR REPLACE FUNCTION is_school_org()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_org_type() = 'school' OR is_platform_admin()
$$;

CREATE OR REPLACE FUNCTION is_ngo_org()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_org_type() = 'ngo' OR is_platform_admin()
$$;

CREATE OR REPLACE FUNCTION is_btp_org()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_org_type() = 'btp' OR is_platform_admin()
$$;

-- ─── Rôles module École ────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_school_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(
    'platform_admin', 'org_admin', 'deputy_director',
    'registrar', 'accountant', 'teacher'
  )
$$;

CREATE OR REPLACE FUNCTION can_write_school_academic()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(
    'platform_admin', 'org_admin', 'deputy_director',
    'registrar', 'teacher'
  )
$$;

CREATE OR REPLACE FUNCTION can_write_school_grades()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director', 'teacher')
$$;

CREATE OR REPLACE FUNCTION is_school_student_or_candidate()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('student', 'candidate')
$$;

-- ─── Rôles module ONG / BTP ─────────────────────────────────────

CREATE OR REPLACE FUNCTION is_ngo_staff_role()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director', 'ngo_staff')
$$;

CREATE OR REPLACE FUNCTION is_btp_staff_role()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director', 'btp_staff')
$$;

-- Journal d'audit (nécessite get_user_organization_id)
CREATE OR REPLACE FUNCTION log_audit(
  p_action audit_action,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_log_id UUID;
BEGIN
  v_org_id := get_user_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Impossible d''écrire un audit sans organisation';
  END IF;
  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
  VALUES (v_org_id, auth.uid(), p_action, p_resource_type, p_resource_id, p_details)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;
