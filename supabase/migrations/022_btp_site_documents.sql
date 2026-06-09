-- ============================================================
-- KonaData — Documents BTP liés aux chantiers + RLS staff
-- ============================================================

CREATE TABLE IF NOT EXISTS btp_site_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id         UUID NOT NULL REFERENCES btp_sites(id) ON DELETE CASCADE,
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL DEFAULT 'other',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT btp_site_documents_unique UNIQUE (site_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_btp_site_docs_org ON btp_site_documents (organization_id);
CREATE INDEX IF NOT EXISTS idx_btp_site_docs_site ON btp_site_documents (site_id);
CREATE INDEX IF NOT EXISTS idx_btp_site_docs_document ON btp_site_documents (document_id);

COMMENT ON TABLE btp_site_documents IS
  'Lien document ↔ chantier BTP (type explicite pour tri IA et recherche directeur).';

ALTER TABLE btp_site_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY btp_site_documents_select ON btp_site_documents FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id)
    AND (
      can_manage_assignments()
      OR is_assigned_to_btp_site(site_id)
      OR NOT has_role('btp_staff')
    )
  );

CREATE POLICY btp_site_documents_insert ON btp_site_documents FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id)
    AND (is_org_admin() OR btp_staff_can_edit_site(site_id))
  );

CREATE POLICY btp_site_documents_delete ON btp_site_documents FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_org_admin());

-- ─── Lecture documents : staff BTP limité aux chantiers assignés ─

DROP POLICY IF EXISTS documents_select ON documents;

CREATE POLICY documents_select ON documents FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id)
    AND (
      is_platform_admin()
      OR is_org_admin()
      OR (
        is_ngo_org()
        AND has_role('ngo_staff')
        AND EXISTS (
          SELECT 1 FROM ngo_project_documents npd
          WHERE npd.document_id = documents.id
            AND is_assigned_to_ngo_project(npd.project_id)
        )
      )
      OR (
        is_btp_org()
        AND has_role('btp_staff')
        AND EXISTS (
          SELECT 1 FROM btp_site_documents bsd
          WHERE bsd.document_id = documents.id
            AND is_assigned_to_btp_site(bsd.site_id)
        )
      )
      OR (is_ngo_org() AND NOT has_role('ngo_staff'))
      OR (is_btp_org() AND NOT has_role('btp_staff'))
      OR is_school_org()
      OR (NOT is_ngo_org() AND NOT is_btp_org() AND NOT is_school_org())
    )
  );
