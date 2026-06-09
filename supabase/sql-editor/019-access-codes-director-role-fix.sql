-- ============================================================
-- Correctif : directeurs legacy (role texte « director ») + génération codes
-- Ré-exécutable. À lancer si « Seul le directeur peut inviter un adjoint »
-- alors que vous êtes connecté en directeur.
-- ============================================================

CREATE OR REPLACE FUNCTION is_org_admin_role()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_active = true
      AND (
        role = 'org_admin'::app_role
        OR role::text IN ('director', 'super_admin', 'country_director', 'project_director')
      )
  )
$$;

CREATE OR REPLACE FUNCTION can_issue_access_codes()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
      has_role('org_admin', 'deputy_director')
      OR is_org_admin_role()
      OR has_role('deputy_director')
    )
    AND get_user_organization_id() IS NOT NULL
    AND NOT is_platform_admin()
$$;

GRANT EXECUTE ON FUNCTION is_org_admin_role() TO authenticated;
GRANT EXECUTE ON FUNCTION can_issue_access_codes() TO authenticated;

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

  IF v_org_type IS NULL AND v_org_id IS NOT NULL THEN
    SELECT type INTO v_org_type FROM organizations WHERE id = v_org_id;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Aucune organisation liée à votre compte';
  END IF;

  IF v_org_type IS NULL THEN
    RAISE EXCEPTION 'Type d''organisation introuvable (organizations.type doit être school, ngo ou btp)';
  END IF;

  IF p_role IN ('org_admin', 'platform_admin') THEN
    RAISE EXCEPTION 'Le rôle % ne peut pas être attribué via code d''accès', p_role;
  END IF;

  IF p_role = 'deputy_director' AND NOT is_org_admin_role() AND NOT has_role('org_admin') THEN
    RAISE EXCEPTION 'Seul le directeur (org_admin) peut inviter un directeur adjoint';
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
    now() + (GREATEST(COALESCE(p_expires_days, 30), 1) || ' days')::INTERVAL,
    auth.uid()
  );

  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_access_code(app_role, TEXT, INTEGER, INTEGER) TO authenticated;

-- Colonnes email (migration 013)
ALTER TABLE organization_access_codes
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;
