-- Dashboard BTP : index de lecture + agrégations SQL pré-calculées

CREATE INDEX IF NOT EXISTS idx_btp_sites_org_status
  ON btp_sites (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_btp_fuel_logs_org_logged
  ON btp_fuel_logs (organization_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_btp_fuel_logs_org_anomaly
  ON btp_fuel_logs (organization_id, logged_at DESC)
  WHERE is_anomaly = true;

CREATE INDEX IF NOT EXISTS idx_btp_daily_progress_org_date
  ON btp_daily_progress (organization_id, progress_date DESC);

CREATE INDEX IF NOT EXISTS idx_btp_daily_progress_org_site_date
  ON btp_daily_progress (organization_id, site_id, progress_date);

CREATE INDEX IF NOT EXISTS idx_btp_delivery_notes_org_date
  ON btp_delivery_notes (organization_id, delivery_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_btp_personnel_org_active_site
  ON btp_personnel (organization_id, site_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_btp_site_planning_refs_org
  ON btp_site_planning_refs (organization_id, site_id, slot);

-- Total litres carburant sur une période
CREATE OR REPLACE FUNCTION btp_dashboard_fuel_total(p_org_id uuid, p_since timestamptz)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(liters), 0)
  FROM btp_fuel_logs
  WHERE organization_id = p_org_id
    AND logged_at >= p_since;
$$;

-- Litres par mois (clé de tri = 1er du mois)
CREATE OR REPLACE FUNCTION btp_dashboard_fuel_by_month(p_org_id uuid, p_since date)
RETURNS TABLE(month_sort date, litres numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    date_trunc('month', logged_at)::date AS month_sort,
    COALESCE(SUM(liters), 0) AS litres
  FROM btp_fuel_logs
  WHERE organization_id = p_org_id
    AND logged_at::date >= p_since
  GROUP BY 1
  ORDER BY 1;
$$;

-- Effectifs actifs par chantier (top 4 chantiers actifs)
CREATE OR REPLACE FUNCTION btp_dashboard_effectifs_par_chantier(p_org_id uuid, p_limit int DEFAULT 4)
RETURNS TABLE(chantier text, effectif bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.name AS chantier,
    COUNT(p.id) AS effectif
  FROM btp_sites s
  LEFT JOIN btp_personnel p
    ON p.site_id = s.id
   AND p.organization_id = s.organization_id
   AND p.is_active = true
  WHERE s.organization_id = p_org_id
    AND s.status = 'active'
  GROUP BY s.id, s.name
  ORDER BY s.name
  LIMIT GREATEST(p_limit, 0);
$$;

GRANT EXECUTE ON FUNCTION btp_dashboard_fuel_total(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION btp_dashboard_fuel_by_month(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION btp_dashboard_effectifs_par_chantier(uuid, int) TO authenticated;
