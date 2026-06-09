-- ============================================================
-- KonaData v2 — Module PME : helpers RLS + politiques
-- ============================================================

CREATE OR REPLACE FUNCTION is_pme_org()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_org_type() = 'business' OR is_platform_admin()
$$;

CREATE OR REPLACE FUNCTION is_pme_staff_role()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director', 'accountant', 'pme_staff')
$$;

ALTER TABLE pme_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pme_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pme_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pme_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pme_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pme_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pme_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pme_customers_all ON pme_customers FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role());

CREATE POLICY pme_suppliers_all ON pme_suppliers FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role());

CREATE POLICY pme_products_all ON pme_products FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role());

CREATE POLICY pme_sales_all ON pme_sales FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role());

CREATE POLICY pme_purchases_all ON pme_purchases FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role());

CREATE POLICY pme_expenses_all ON pme_expenses FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role());

CREATE POLICY pme_transactions_all ON pme_transactions FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role());

CREATE OR REPLACE FUNCTION is_role_allowed_for_org(p_org_type organization_type, p_role app_role)
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_org_type
    WHEN 'school' THEN p_role IN (
      'deputy_director', 'registrar', 'accountant', 'teacher', 'student', 'candidate'
    )
    WHEN 'ngo' THEN p_role IN ('deputy_director', 'ngo_staff')
    WHEN 'btp' THEN p_role IN ('deputy_director', 'btp_staff')
    WHEN 'business' THEN p_role IN ('deputy_director', 'accountant', 'pme_staff')
    ELSE false
  END
$$;
