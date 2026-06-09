-- Modèles de documents de référence (directeur) pour guider l'IA à la production.

CREATE TABLE organization_ai_document_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sector          TEXT NOT NULL CHECK (sector IN ('school', 'ngo', 'btp')),
  purpose         TEXT NOT NULL,
  label           TEXT NOT NULL,
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_ai_templates_unique UNIQUE (organization_id, sector, purpose)
);

CREATE INDEX idx_org_ai_templates_org ON organization_ai_document_templates (organization_id);
CREATE INDEX idx_org_ai_templates_sector ON organization_ai_document_templates (organization_id, sector);

CREATE TRIGGER trg_org_ai_templates_updated
  BEFORE UPDATE ON organization_ai_document_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE organization_ai_document_templates IS
  'Un modèle par type de document et secteur ; l''IA s''aligne sur ce fichier pour les productions.';

ALTER TABLE organization_ai_document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_ai_templates_select ON organization_ai_document_templates
  FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id));

CREATE POLICY org_ai_templates_insert ON organization_ai_document_templates
  FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id) AND is_org_admin());

CREATE POLICY org_ai_templates_update ON organization_ai_document_templates
  FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id) AND is_org_admin())
  WITH CHECK (belongs_to_org(organization_id) AND is_org_admin());

CREATE POLICY org_ai_templates_delete ON organization_ai_document_templates
  FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_org_admin());
