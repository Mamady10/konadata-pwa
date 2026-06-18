-- Référentiel projet BTP (niveaux A & B) : jalons, planning, budget enrichi

ALTER TABLE btp_sites
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS moa_recipient TEXT,
  ADD COLUMN IF NOT EXISTS planned_avg_workers INTEGER,
  ADD COLUMN IF NOT EXISTS planned_monthly_fuel_liters NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS budget_alert_pct NUMERIC(5,2) DEFAULT 90,
  ADD COLUMN IF NOT EXISTS budget_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN btp_sites.budget_breakdown IS
  'Répartition % par poste: labor, materials, equipment, subcontract, overhead';

CREATE TABLE IF NOT EXISTS btp_site_milestones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id           UUID NOT NULL REFERENCES btp_sites(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  target_physical_pct NUMERIC(5,2) NOT NULL CHECK (target_physical_pct >= 0 AND target_physical_pct <= 100),
  planned_date      DATE NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_btp_site_milestones_site ON btp_site_milestones(site_id, sort_order);

ALTER TABLE btp_site_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS btp_site_milestones_all ON btp_site_milestones;
CREATE POLICY btp_site_milestones_all ON btp_site_milestones FOR ALL TO authenticated
  USING (organization_id = get_user_org_id())
  WITH CHECK (organization_id = get_user_org_id());
