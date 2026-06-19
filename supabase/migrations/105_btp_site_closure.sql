-- Clôture chantier BTP : date, commentaire MOA, lien rapport archivé

ALTER TABLE btp_sites
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closure_comment TEXT,
  ADD COLUMN IF NOT EXISTS closure_report_id UUID REFERENCES organization_ai_generated_reports(id) ON DELETE SET NULL;

COMMENT ON COLUMN btp_sites.completed_at IS 'Date de clôture / réception MOA';
COMMENT ON COLUMN btp_sites.closure_comment IS 'Commentaire de synthèse à la clôture';
COMMENT ON COLUMN btp_sites.closure_report_id IS 'Rapport de clôture archivé (dossier MOA)';

CREATE INDEX IF NOT EXISTS idx_btp_sites_closure_report ON btp_sites(closure_report_id)
  WHERE closure_report_id IS NOT NULL;
