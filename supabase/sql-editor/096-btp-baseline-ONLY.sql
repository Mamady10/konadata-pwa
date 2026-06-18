-- ============================================================
-- 096 — Référentiel projet BTP (niveaux A & B)
-- À exécuter dans le SQL Editor du MÊME projet que l'app (voir .env.local)
-- Prérequis : table btp_sites (migration 007_btp_module.sql)
-- ============================================================

-- Diagnostic rapide (doit retourner 1 ligne)
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'btp_sites'
) AS btp_sites_exists;

-- Si btp_sites_exists = false → STOP :
--   vous n'êtes pas sur le bon projet Supabase, ou le module BTP n'est pas installé.
--   Vérifiez l'URL du projet (Settings → API) = NEXT_PUBLIC_SUPABASE_URL dans .env.local
--   Puis exécutez d'abord supabase/migrations/007_btp_module.sql (et migrations antérieures).

-- ─── Colonnes référentiel sur btp_sites ───────────────────────

ALTER TABLE btp_sites
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS moa_recipient TEXT,
  ADD COLUMN IF NOT EXISTS planned_avg_workers INTEGER,
  ADD COLUMN IF NOT EXISTS planned_monthly_fuel_liters NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS budget_alert_pct NUMERIC(5,2) DEFAULT 90,
  ADD COLUMN IF NOT EXISTS budget_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN btp_sites.budget_breakdown IS
  'Répartition % par poste: labor, materials, equipment, subcontract, overhead';

-- ─── Jalons planifiés ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS btp_site_milestones (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id             UUID NOT NULL REFERENCES btp_sites(id) ON DELETE CASCADE,
  label               TEXT NOT NULL,
  target_physical_pct NUMERIC(5,2) NOT NULL CHECK (target_physical_pct >= 0 AND target_physical_pct <= 100),
  planned_date        DATE NOT NULL,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_btp_site_milestones_site ON btp_site_milestones(site_id, sort_order);

ALTER TABLE btp_site_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS btp_site_milestones_all ON btp_site_milestones;
CREATE POLICY btp_site_milestones_all ON btp_site_milestones FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

-- Vérification finale
SELECT '096 OK' AS status, COUNT(*) AS milestones_table
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'btp_site_milestones';
