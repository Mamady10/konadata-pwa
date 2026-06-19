-- Références planning BTP (Ref 1 / Ref 2) — choix indépendant par le directeur

ALTER TABLE btp_sites
  ADD COLUMN IF NOT EXISTS default_planning_ref_slot SMALLINT NOT NULL DEFAULT 1
    CHECK (default_planning_ref_slot IN (1, 2));

COMMENT ON COLUMN btp_sites.default_planning_ref_slot IS
  'Référence planning utilisée par défaut à la saisie avancement (1 ou 2).';

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

-- Migrer jalons existants → Référence 1
INSERT INTO btp_site_planning_refs (
  organization_id, site_id, slot, label, source_type, start_date, end_date, milestones, updated_at
)
SELECT
  s.organization_id,
  s.id,
  1,
  'Référence 1 — Jalons',
  'milestones',
  s.start_date,
  s.end_date,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'label', m.label,
          'targetPhysicalPct', m.target_physical_pct,
          'plannedDate', m.planned_date::text,
          'sortOrder', m.sort_order
        )
        ORDER BY m.sort_order
      )
      FROM btp_site_milestones m
      WHERE m.site_id = s.id
    ),
    '[]'::jsonb
  ),
  now()
FROM btp_sites s
WHERE EXISTS (SELECT 1 FROM btp_site_milestones m WHERE m.site_id = s.id)
ON CONFLICT (site_id, slot) DO NOTHING;

-- Migrer MS Project existant → Référence 2 (ou Ref 1 si vide)
INSERT INTO btp_site_planning_refs (
  organization_id, site_id, slot, label, source_type, start_date, end_date,
  tasks, source_filename, project_title, updated_at
)
SELECT
  sch.organization_id,
  sch.site_id,
  CASE WHEN EXISTS (
    SELECT 1 FROM btp_site_planning_refs r WHERE r.site_id = sch.site_id AND r.slot = 1
  ) THEN 2 ELSE 1 END,
  CASE WHEN EXISTS (
    SELECT 1 FROM btp_site_planning_refs r WHERE r.site_id = sch.site_id AND r.slot = 1
  ) THEN 'Référence 2 — MS Project' ELSE 'Référence 1 — MS Project' END,
  'ms_project',
  sch.start_date,
  sch.end_date,
  sch.tasks,
  sch.source_filename,
  sch.project_title,
  COALESCE(sch.imported_at, now())
FROM btp_site_schedules sch
ON CONFLICT (site_id, slot) DO UPDATE SET
  source_type = EXCLUDED.source_type,
  tasks = EXCLUDED.tasks,
  source_filename = EXCLUDED.source_filename,
  project_title = EXCLUDED.project_title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  updated_at = now();

-- Référence 1 linéaire pour chantiers avec dates seules
INSERT INTO btp_site_planning_refs (
  organization_id, site_id, slot, label, source_type, start_date, end_date, updated_at
)
SELECT
  s.organization_id,
  s.id,
  1,
  'Référence 1 — Dates contractuelles',
  'linear',
  s.start_date,
  s.end_date,
  now()
FROM btp_sites s
WHERE s.start_date IS NOT NULL
  AND s.end_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM btp_site_planning_refs r WHERE r.site_id = s.id AND r.slot = 1
  )
ON CONFLICT (site_id, slot) DO NOTHING;

-- Référence 2 placeholder (dates) pour tous les chantiers
INSERT INTO btp_site_planning_refs (
  organization_id, site_id, slot, label, source_type, start_date, end_date, updated_at
)
SELECT
  s.organization_id,
  s.id,
  2,
  'Référence 2 — À configurer',
  'linear',
  s.start_date,
  s.end_date,
  now()
FROM btp_sites s
WHERE s.start_date IS NOT NULL
  AND s.end_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM btp_site_planning_refs r WHERE r.site_id = s.id AND r.slot = 2
  )
ON CONFLICT (site_id, slot) DO NOTHING;
