-- Import planning MS Project (XML) par chantier — courbe planifiée pondérée

CREATE TABLE IF NOT EXISTS btp_site_schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id           UUID NOT NULL REFERENCES btp_sites(id) ON DELETE CASCADE,
  source_filename   TEXT,
  project_title     TEXT,
  start_date        DATE,
  end_date          DATE,
  task_count        INTEGER NOT NULL DEFAULT 0,
  tasks             JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT btp_site_schedules_site_unique UNIQUE (site_id)
);

CREATE INDEX IF NOT EXISTS idx_btp_site_schedules_org ON btp_site_schedules (organization_id);
CREATE INDEX IF NOT EXISTS idx_btp_site_schedules_site ON btp_site_schedules (site_id);

COMMENT ON TABLE btp_site_schedules IS
  'Planning MS Project importé (XML) — tâches feuilles pondérées par durée pour % planifié cumulé.';
COMMENT ON COLUMN btp_site_schedules.tasks IS
  'Tableau JSON: uid, name, startDate, finishDate, durationDays, weight, isMilestone, outlineLevel';

ALTER TABLE btp_site_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS btp_site_schedules_all ON btp_site_schedules;
CREATE POLICY btp_site_schedules_all ON btp_site_schedules FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());
