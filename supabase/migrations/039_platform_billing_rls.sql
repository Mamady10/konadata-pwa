-- RLS facturation plateforme

ALTER TABLE platform_billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_school_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_billing_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_plans_select ON platform_billing_plans FOR SELECT TO authenticated
  USING (true);

CREATE POLICY org_subscriptions_select ON organization_subscriptions FOR SELECT TO authenticated
  USING (is_platform_admin() OR belongs_to_org(organization_id));

CREATE POLICY org_subscriptions_platform ON organization_subscriptions FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY school_invoices_select ON platform_school_invoices FOR SELECT TO authenticated
  USING (is_platform_admin() OR (belongs_to_org(organization_id) AND is_org_admin()));

CREATE POLICY school_invoices_platform ON platform_school_invoices FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY billing_payments_select ON platform_billing_payments FOR SELECT TO authenticated
  USING (is_platform_admin() OR (belongs_to_org(organization_id) AND is_org_admin()));

CREATE POLICY billing_payments_platform ON platform_billing_payments FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
