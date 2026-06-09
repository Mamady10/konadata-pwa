ALTER TABLE organization_billing_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_offers_select ON organization_billing_offers FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR (belongs_to_org(organization_id) AND is_org_admin())
  );

CREATE POLICY billing_offers_platform_write ON organization_billing_offers FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
