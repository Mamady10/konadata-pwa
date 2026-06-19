-- Liste personnel direct : salaire mensuel + import Excel

ALTER TABLE btp_personnel
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payroll_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (payroll_source IN ('manual', 'import')),
  ADD COLUMN IF NOT EXISTS payroll_start_date DATE;

COMMENT ON COLUMN btp_personnel.monthly_salary IS
  'Salaire mensuel brut (GNF) pour employés directs — intégré aux finances MO.';
COMMENT ON COLUMN btp_personnel.payroll_source IS
  'manual = saisie unitaire ; import = liste Excel directeur.';
COMMENT ON COLUMN btp_personnel.payroll_start_date IS
  'Date de début de prise en compte du salaire mensuel (défaut : date import).';

CREATE TABLE IF NOT EXISTS btp_personnel_imports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  file_name         TEXT,
  rows_imported     INTEGER NOT NULL DEFAULT 0,
  rows_deactivated  INTEGER NOT NULL DEFAULT 0,
  default_site_id   UUID REFERENCES btp_sites(id) ON DELETE SET NULL,
  imported_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_btp_personnel_imports_org ON btp_personnel_imports (organization_id, created_at DESC);

ALTER TABLE btp_personnel_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS btp_personnel_imports_all ON btp_personnel_imports;
CREATE POLICY btp_personnel_imports_all ON btp_personnel_imports FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());
