-- ============================================================
-- KonaData F4 — À exécuter SEUL (014 déjà appliquée)
-- Assignations BTP staff ↔ chantier
-- ============================================================

CREATE OR REPLACE FUNCTION is_assigned_to_btp_site(p_site_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_org_admin()
    OR EXISTS (
      SELECT 1 FROM collaborator_assignments ca
      WHERE ca.profile_id = auth.uid()
        AND ca.resource_type = 'btp_site'
        AND ca.resource_id = p_site_id
        AND ca.organization_id = get_user_organization_id()
    )
$$;

GRANT EXECUTE ON FUNCTION is_assigned_to_btp_site(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION btp_staff_can_edit_site(p_site_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_org_admin()
    OR EXISTS (
      SELECT 1 FROM collaborator_assignments ca
      WHERE ca.profile_id = auth.uid()
        AND ca.resource_type = 'btp_site'
        AND ca.resource_id = p_site_id
        AND (ca.can_upload = true OR ca.can_edit = true)
        AND ca.organization_id = get_user_organization_id()
    )
$$;

GRANT EXECUTE ON FUNCTION btp_staff_can_edit_site(UUID) TO authenticated;

DROP POLICY IF EXISTS btp_sites_all ON btp_sites;

CREATE POLICY btp_sites_select ON btp_sites FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role()
    AND (is_org_admin() OR is_assigned_to_btp_site(id))
  );

CREATE POLICY btp_sites_insert ON btp_sites FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id) AND is_btp_org() AND is_org_admin()
  );

CREATE POLICY btp_sites_update ON btp_sites FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_org_admin())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_org_admin());

CREATE POLICY btp_sites_delete ON btp_sites FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_org_admin());

DROP POLICY IF EXISTS btp_fuel_logs_all ON btp_fuel_logs;

CREATE POLICY btp_fuel_logs_select ON btp_fuel_logs FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role()
    AND (is_org_admin() OR is_assigned_to_btp_site(site_id))
  );

CREATE POLICY btp_fuel_logs_insert ON btp_fuel_logs FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id) AND is_btp_org()
    AND (is_org_admin() OR btp_staff_can_edit_site(site_id))
  );

CREATE POLICY btp_fuel_logs_update ON btp_fuel_logs FOR UPDATE TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_btp_org()
    AND (is_org_admin() OR btp_staff_can_edit_site(site_id))
  )
  WITH CHECK (
    belongs_to_org(organization_id) AND is_btp_org()
    AND (is_org_admin() OR btp_staff_can_edit_site(site_id))
  );

CREATE POLICY btp_fuel_logs_delete ON btp_fuel_logs FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_org_admin());

DROP POLICY IF EXISTS btp_daily_progress_all ON btp_daily_progress;

CREATE POLICY btp_daily_progress_select ON btp_daily_progress FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role()
    AND (is_org_admin() OR is_assigned_to_btp_site(site_id))
  );

CREATE POLICY btp_daily_progress_insert ON btp_daily_progress FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id) AND is_btp_org()
    AND (is_org_admin() OR btp_staff_can_edit_site(site_id))
  );

CREATE POLICY btp_daily_progress_update ON btp_daily_progress FOR UPDATE TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_btp_org()
    AND (is_org_admin() OR btp_staff_can_edit_site(site_id))
  )
  WITH CHECK (
    belongs_to_org(organization_id) AND is_btp_org()
    AND (is_org_admin() OR btp_staff_can_edit_site(site_id))
  );

CREATE POLICY btp_daily_progress_delete ON btp_daily_progress FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_org_admin());
