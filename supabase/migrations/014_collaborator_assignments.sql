-- ============================================================
-- KonaData F1 — Assignations collaborateurs ↔ ressources
-- Phase 1 : Établissements (professeur ↔ classes)
-- ============================================================

CREATE TYPE assignment_resource_type AS ENUM (
  'school_class',
  'ngo_project',
  'btp_site'
);

CREATE TABLE collaborator_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_type   assignment_resource_type NOT NULL,
  resource_id     UUID NOT NULL,
  can_import      BOOLEAN NOT NULL DEFAULT false,
  can_upload      BOOLEAN NOT NULL DEFAULT false,
  can_edit        BOOLEAN NOT NULL DEFAULT false,
  assigned_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT collaborator_assignments_unique
    UNIQUE (profile_id, resource_type, resource_id)
);

CREATE INDEX idx_collab_assign_org ON collaborator_assignments (organization_id);
CREATE INDEX idx_collab_assign_profile ON collaborator_assignments (profile_id, resource_type);
CREATE INDEX idx_collab_assign_resource ON collaborator_assignments (resource_type, resource_id);

COMMENT ON TABLE collaborator_assignments IS
  'Périmètre des collaborateurs : classes (école), projets (ONG), chantiers (BTP).';

-- ─── Helpers RBAC assignations ───────────────────────────────────

CREATE OR REPLACE FUNCTION can_manage_assignments()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director')
$$;

GRANT EXECUTE ON FUNCTION can_manage_assignments() TO authenticated;

CREATE OR REPLACE FUNCTION is_assigned_to_school_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_org_admin()
    OR EXISTS (
      SELECT 1 FROM collaborator_assignments ca
      WHERE ca.profile_id = auth.uid()
        AND ca.resource_type = 'school_class'
        AND ca.resource_id = p_class_id
        AND ca.organization_id = get_user_organization_id()
    )
$$;

GRANT EXECUTE ON FUNCTION is_assigned_to_school_class(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION teacher_can_import_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_org_admin()
    OR EXISTS (
      SELECT 1 FROM collaborator_assignments ca
      WHERE ca.profile_id = auth.uid()
        AND ca.resource_type = 'school_class'
        AND ca.resource_id = p_class_id
        AND ca.can_import = true
        AND ca.organization_id = get_user_organization_id()
    )
$$;

GRANT EXECUTE ON FUNCTION teacher_can_import_class(UUID) TO authenticated;

-- ─── RLS ─────────────────────────────────────────────────────────

ALTER TABLE collaborator_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY collab_assign_select ON collaborator_assignments FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR (
      belongs_to_org(organization_id)
      AND (
        can_manage_assignments()
        OR profile_id = auth.uid()
      )
    )
  );

CREATE POLICY collab_assign_insert ON collaborator_assignments FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id)
    AND can_manage_assignments()
  );

CREATE POLICY collab_assign_update ON collaborator_assignments FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id) AND can_manage_assignments())
  WITH CHECK (belongs_to_org(organization_id) AND can_manage_assignments());

CREATE POLICY collab_assign_delete ON collaborator_assignments FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND can_manage_assignments());
