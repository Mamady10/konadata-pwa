-- Archives année scolaire clôturée + codes réinscription liés à l'année cible

-- ─── Archives exportables (scolarité, finances, bulletins, etc.) ───
CREATE TABLE IF NOT EXISTS school_academic_year_archives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  academic_year   TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (
    category IN ('scolarite', 'finances', 'bulletins', 'notes', 'classes', 'synthese')
  ),
  file_name       TEXT NOT NULL,
  content_type    TEXT NOT NULL DEFAULT 'text/csv',
  content         TEXT NOT NULL,
  row_count       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_academic_year_archives_unique
    UNIQUE (organization_id, academic_year, category)
);

CREATE INDEX IF NOT EXISTS idx_school_academic_year_archives_org_year
  ON school_academic_year_archives(organization_id, academic_year);

ALTER TABLE school_academic_year_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_academic_year_archives_staff ON school_academic_year_archives;
CREATE POLICY school_academic_year_archives_staff ON school_academic_year_archives
  FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND is_school_staff())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND is_school_staff());

-- ─── Codes réinscription : année cible + lien élève / matricule ───
ALTER TABLE school_reenrollment_codes
  ADD COLUMN IF NOT EXISTS academic_year TEXT,
  ADD COLUMN IF NOT EXISTS source_academic_year TEXT,
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES school_students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS matricule TEXT;

COMMENT ON COLUMN school_reenrollment_codes.academic_year IS
  'Année scolaire pour laquelle le code est valable (réinscription). NULL = toute année.';
COMMENT ON COLUMN school_reenrollment_codes.source_academic_year IS
  'Année d''origine de l''élève (ex. année clôturée).';
COMMENT ON COLUMN school_reenrollment_codes.matricule IS
  'Matricule de l''élève ; le code saisi peut correspondre au matricule.';

CREATE INDEX IF NOT EXISTS idx_school_reenrollment_codes_org_year
  ON school_reenrollment_codes(organization_id, academic_year);
