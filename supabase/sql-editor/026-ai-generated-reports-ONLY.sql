-- Copier-coller dans Supabase SQL Editor si la migration 026 n'est pas encore appliquée.
-- Historique des rapports IA (archivage & diffusion).

CREATE TABLE IF NOT EXISTS organization_ai_generated_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sector            TEXT NOT NULL CHECK (sector IN ('school', 'ngo', 'btp')),
  scope_id          TEXT NOT NULL,
  scope_label       TEXT NOT NULL,
  report_type       TEXT NOT NULL,
  report_type_label TEXT NOT NULL,
  title             TEXT NOT NULL,
  subtitle          TEXT,
  content           TEXT NOT NULL,
  engine            TEXT NOT NULL DEFAULT 'local' CHECK (engine IN ('local', 'openai')),
  created_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_ai_reports_org_sector
  ON organization_ai_generated_reports (organization_id, sector, created_at DESC);

ALTER TABLE organization_ai_generated_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_ai_reports_select ON organization_ai_generated_reports;
CREATE POLICY org_ai_reports_select ON organization_ai_generated_reports
  FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_org_admin());

DROP POLICY IF EXISTS org_ai_reports_insert ON organization_ai_generated_reports;
CREATE POLICY org_ai_reports_insert ON organization_ai_generated_reports
  FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id) AND is_org_admin());

DROP POLICY IF EXISTS org_ai_reports_delete ON organization_ai_generated_reports;
CREATE POLICY org_ai_reports_delete ON organization_ai_generated_reports
  FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_org_admin());
