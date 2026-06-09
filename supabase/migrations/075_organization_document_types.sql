-- Types de documents personnalisés par organisation (liés aux modèles IA)

CREATE TABLE organization_document_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sector          TEXT NOT NULL CHECK (sector IN ('school', 'ngo', 'btp')),
  code            TEXT NOT NULL,
  label           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'other',
  hint            TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_document_types_unique UNIQUE (organization_id, sector, code),
  CONSTRAINT organization_document_types_code_custom CHECK (code ~ '^custom_[a-z0-9_]+$')
);

CREATE INDEX idx_org_document_types_org ON organization_document_types (organization_id);
CREATE INDEX idx_org_document_types_sector ON organization_document_types (organization_id, sector)
  WHERE is_active = true;

CREATE TRIGGER trg_org_document_types_updated
  BEFORE UPDATE ON organization_document_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE organization_document_types IS
  'Types de documents propres à l''organisation ; reliés aux modèles IA via organization_ai_document_templates.purpose = code.';

ALTER TABLE organization_document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_document_types_select ON organization_document_types
  FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id));

CREATE POLICY org_document_types_insert ON organization_document_types
  FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id) AND is_org_admin());

CREATE POLICY org_document_types_update ON organization_document_types
  FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id) AND is_org_admin())
  WITH CHECK (belongs_to_org(organization_id) AND is_org_admin());

CREATE POLICY org_document_types_delete ON organization_document_types
  FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_org_admin());
