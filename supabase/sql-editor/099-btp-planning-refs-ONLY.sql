-- 099 — Références planning Ref 1 / Ref 2 (SQL Editor)

ALTER TABLE btp_sites
  ADD COLUMN IF NOT EXISTS default_planning_ref_slot SMALLINT NOT NULL DEFAULT 1
    CHECK (default_planning_ref_slot IN (1, 2));

CREATE TABLE IF NOT EXISTS btp_site_planning_refs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id           UUID NOT NULL REFERENCES btp_sites(id) ON DELETE CASCADE,
  slot              SMALLINT NOT NULL CHECK (slot IN (1, 2)),
  label             TEXT NOT NULL,
  source_type       TEXT NOT NULL CHECK (source_type IN ('linear', 'milestones', 'ms_project')),
  start_date        DATE,
  end_date          DATE,
  milestones        JSONB NOT NULL DEFAULT '[]'::jsonb,
  tasks             JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_filename   TEXT,
  project_title     TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT btp_site_planning_refs_site_slot_unique UNIQUE (site_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_btp_site_planning_refs_site ON btp_site_planning_refs (site_id, slot);

ALTER TABLE btp_site_planning_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS btp_site_planning_refs_all ON btp_site_planning_refs;
CREATE POLICY btp_site_planning_refs_all ON btp_site_planning_refs FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

SELECT '099 OK' AS status;
