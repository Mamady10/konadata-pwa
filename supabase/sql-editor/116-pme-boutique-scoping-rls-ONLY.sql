-- ============================================================
-- KonaData v2 — PME : verrouillage RLS par boutique
-- À COLLER TEL QUEL dans Supabase → SQL Editor → Run.
-- IMPORTANT : exécutez d'abord 114 puis 115, ENSUITE ce script.
-- (La valeur d'enum 'pme_boutique' de la 115 doit déjà exister.)
-- Idempotent : ré-exécutable.
-- ============================================================

CREATE OR REPLACE FUNCTION is_pme_director()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director', 'accountant')
$$;

GRANT EXECUTE ON FUNCTION is_pme_director() TO authenticated;

CREATE OR REPLACE FUNCTION is_assigned_to_pme_boutique(p_boutique_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_pme_director()
    OR EXISTS (
      SELECT 1 FROM collaborator_assignments ca
      WHERE ca.profile_id = auth.uid()
        AND ca.resource_type = 'pme_boutique'
        AND ca.resource_id = p_boutique_id
        AND ca.organization_id = get_user_organization_id()
    )
$$;

GRANT EXECUTE ON FUNCTION is_assigned_to_pme_boutique(UUID) TO authenticated;

DROP POLICY IF EXISTS pme_boutiques_all ON pme_boutiques;
CREATE POLICY pme_boutiques_all ON pme_boutiques FOR ALL TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role()
    AND (is_pme_director() OR is_assigned_to_pme_boutique(id))
  )
  WITH CHECK (
    belongs_to_org(organization_id) AND is_pme_org() AND is_pme_director()
  );

DROP POLICY IF EXISTS pme_sales_all ON pme_sales;
CREATE POLICY pme_sales_all ON pme_sales FOR ALL TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role()
    AND (is_pme_director() OR (boutique_id IS NOT NULL AND is_assigned_to_pme_boutique(boutique_id)))
  )
  WITH CHECK (
    belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role()
    AND (is_pme_director() OR (boutique_id IS NOT NULL AND is_assigned_to_pme_boutique(boutique_id)))
  );

DROP POLICY IF EXISTS pme_purchases_all ON pme_purchases;
CREATE POLICY pme_purchases_all ON pme_purchases FOR ALL TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role()
    AND (is_pme_director() OR (boutique_id IS NOT NULL AND is_assigned_to_pme_boutique(boutique_id)))
  )
  WITH CHECK (
    belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role()
    AND (is_pme_director() OR (boutique_id IS NOT NULL AND is_assigned_to_pme_boutique(boutique_id)))
  );

DROP POLICY IF EXISTS pme_expenses_all ON pme_expenses;
CREATE POLICY pme_expenses_all ON pme_expenses FOR ALL TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role()
    AND (is_pme_director() OR (boutique_id IS NOT NULL AND is_assigned_to_pme_boutique(boutique_id)))
  )
  WITH CHECK (
    belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role()
    AND (is_pme_director() OR (boutique_id IS NOT NULL AND is_assigned_to_pme_boutique(boutique_id)))
  );

DROP POLICY IF EXISTS pme_products_all ON pme_products;
CREATE POLICY pme_products_all ON pme_products FOR ALL TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role()
    AND (is_pme_director() OR (boutique_id IS NOT NULL AND is_assigned_to_pme_boutique(boutique_id)))
  )
  WITH CHECK (
    belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role()
    AND (is_pme_director() OR (boutique_id IS NOT NULL AND is_assigned_to_pme_boutique(boutique_id)))
  );
