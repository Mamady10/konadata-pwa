-- ============================================================
-- KonaData F3 — Assignations ONG agent ↔ projet + documents
-- ============================================================

CREATE TABLE IF NOT EXISTS ngo_project_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES ngo_projects(id) ON DELETE CASCADE,
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  doc_type        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ngo_project_documents_unique UNIQUE (project_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_ngo_project_docs_org ON ngo_project_documents (organization_id);
CREATE INDEX IF NOT EXISTS idx_ngo_project_docs_project ON ngo_project_documents (project_id);
CREATE INDEX IF NOT EXISTS idx_ngo_project_docs_document ON ngo_project_documents (document_id);

COMMENT ON TABLE ngo_project_documents IS
  'Lien document ↔ projet ONG pour filtrage par assignation.';

-- ─── Helpers RBAC assignations ONG ───────────────────────────────

CREATE OR REPLACE FUNCTION is_assigned_to_ngo_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_org_admin()
    OR EXISTS (
      SELECT 1 FROM collaborator_assignments ca
      WHERE ca.profile_id = auth.uid()
        AND ca.resource_type = 'ngo_project'
        AND ca.resource_id = p_project_id
        AND ca.organization_id = get_user_organization_id()
    )
$$;

GRANT EXECUTE ON FUNCTION is_assigned_to_ngo_project(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION ngo_staff_can_upload_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_org_admin()
    OR EXISTS (
      SELECT 1 FROM collaborator_assignments ca
      WHERE ca.profile_id = auth.uid()
        AND ca.resource_type = 'ngo_project'
        AND ca.resource_id = p_project_id
        AND ca.can_upload = true
        AND ca.organization_id = get_user_organization_id()
    )
$$;

GRANT EXECUTE ON FUNCTION ngo_staff_can_upload_project(UUID) TO authenticated;

-- ─── RLS ngo_project_documents ───────────────────────────────────

ALTER TABLE ngo_project_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ngo_project_docs_select ON ngo_project_documents;
DROP POLICY IF EXISTS ngo_project_docs_insert ON ngo_project_documents;
DROP POLICY IF EXISTS ngo_project_docs_delete ON ngo_project_documents;

CREATE POLICY ngo_project_docs_select ON ngo_project_documents FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_ngo_org()
    AND (is_org_admin() OR is_assigned_to_ngo_project(project_id))
  );

CREATE POLICY ngo_project_docs_insert ON ngo_project_documents FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id) AND is_ngo_org()
    AND ngo_staff_can_upload_project(project_id)
  );

CREATE POLICY ngo_project_docs_delete ON ngo_project_documents FOR DELETE TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_ngo_org() AND is_org_admin()
  );

-- ─── RLS ngo_projects (lecture filtrée pour agents) ──────────────

DROP POLICY IF EXISTS ngo_projects_all ON ngo_projects;

CREATE POLICY ngo_projects_select ON ngo_projects FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role()
    AND (is_org_admin() OR is_assigned_to_ngo_project(id))
  );

CREATE POLICY ngo_projects_insert ON ngo_projects FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id) AND is_ngo_org() AND is_org_admin()
  );

CREATE POLICY ngo_projects_update ON ngo_projects FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_org_admin())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_org_admin());

CREATE POLICY ngo_projects_delete ON ngo_projects FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_org_admin());

-- ─── RLS documents (filtrage ONG pour ngo_staff) ─────────────────

DROP POLICY IF EXISTS documents_select ON documents;

CREATE POLICY documents_select ON documents FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id)
    AND (
      NOT is_ngo_org()
      OR is_org_admin()
      OR (
        has_role('ngo_staff')
        AND EXISTS (
          SELECT 1 FROM ngo_project_documents npd
          WHERE npd.document_id = documents.id
            AND is_assigned_to_ngo_project(npd.project_id)
        )
      )
      OR (is_ngo_org() AND NOT has_role('ngo_staff'))
    )
  );
