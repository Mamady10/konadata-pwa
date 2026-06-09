-- ============================================================
-- KonaData — Facturation plateforme (abonnement + école / élève)
-- ============================================================

CREATE TYPE platform_subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'expired', 'cancelled'
);

CREATE TYPE platform_invoice_status AS ENUM (
  'draft', 'open', 'paid', 'void', 'overdue'
);

CREATE TYPE platform_payment_kind AS ENUM (
  'subscription_renewal', 'school_invoice'
);

-- Plans mensuels secteurs BTP / ONG / PME
CREATE TABLE platform_billing_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector            organization_type NOT NULL CHECK (sector IN ('ngo', 'btp', 'business')),
  name              TEXT NOT NULL,
  description       TEXT,
  monthly_price_gnf NUMERIC(14, 2) NOT NULL CHECK (monthly_price_gnf >= 0),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_platform_plans_sector_name ON platform_billing_plans(sector, name);

CREATE TABLE organization_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id               UUID NOT NULL REFERENCES platform_billing_plans(id),
  status                platform_subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end    TIMESTAMPTZ NOT NULL,
  trial_ends_at         TIMESTAMPTZ,
  grace_until           TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE platform_school_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_year     INTEGER NOT NULL,
  period_month    INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  amount_gnf      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  student_count   INTEGER NOT NULL DEFAULT 0,
  line_items      JSONB NOT NULL DEFAULT '[]',
  status          platform_invoice_status NOT NULL DEFAULT 'open',
  due_date        DATE NOT NULL,
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, period_year, period_month)
);

CREATE TABLE platform_billing_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind            platform_payment_kind NOT NULL,
  subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE SET NULL,
  invoice_id      UUID REFERENCES platform_school_invoices(id) ON DELETE SET NULL,
  amount_gnf      NUMERIC(14, 2) NOT NULL CHECK (amount_gnf > 0),
  payment_method  payment_method DEFAULT 'bank_transfer',
  reference       TEXT,
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_subscriptions_org ON organization_subscriptions(organization_id);
CREATE INDEX idx_school_invoices_org ON platform_school_invoices(organization_id, period_year DESC, period_month DESC);
CREATE INDEX idx_billing_payments_org ON platform_billing_payments(organization_id, paid_at DESC);

CREATE TRIGGER trg_organization_subscriptions_updated
  BEFORE UPDATE ON organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_platform_school_invoices_updated
  BEFORE UPDATE ON platform_school_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Plans par défaut ───────────────────────────────────────────

INSERT INTO platform_billing_plans (sector, name, description, monthly_price_gnf) VALUES
  ('ngo', 'ONG Standard', 'Accès module ONG, projets, enquêtes, rapports IA', 2500000),
  ('btp', 'BTP Standard', 'Accès chantiers, stock, carburant, documents chantier', 3500000),
  ('business', 'PME Standard', 'Accès ventes, stocks, clients, rapports commerce', 1500000)
ON CONFLICT (sector, name) DO NOTHING;

-- ─── Frais effectif par élève inscrit (classe ou défaut org) ─────

CREATE OR REPLACE FUNCTION school_student_platform_fee(
  p_org_id UUID,
  p_class_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default NUMERIC;
  v_class_fee NUMERIC;
BEGIN
  SELECT COALESCE((settings->>'tuition_fee_gnf')::NUMERIC, 1500000)
  INTO v_default
  FROM organizations WHERE id = p_org_id;

  IF p_class_id IS NULL THEN
    RETURN v_default;
  END IF;

  SELECT tuition_fee_gnf INTO v_class_fee
  FROM school_classes
  WHERE id = p_class_id AND organization_id = p_org_id;

  IF v_class_fee IS NOT NULL AND v_class_fee > 0 THEN
    RETURN v_class_fee;
  END IF;
  RETURN v_default;
END;
$$;

-- Recalcule la facture du mois en cours (élèves status = enrolled)
CREATE OR REPLACE FUNCTION refresh_school_platform_invoice(p_org_id UUID)
RETURNS platform_school_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_month INTEGER := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
  v_invoice platform_school_invoices;
  v_lines JSONB := '[]'::JSONB;
  v_total NUMERIC := 0;
  v_count INTEGER := 0;
  v_row RECORD;
  v_fee NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organizations WHERE id = p_org_id AND type = 'school'
  ) THEN
    RAISE EXCEPTION 'Organisation non scolaire';
  END IF;

  FOR v_row IN
    SELECT ss.id AS student_id,
           cp.full_name AS student_name,
           ss.class_id,
           sc.name AS class_name
    FROM school_students ss
    JOIN core_persons cp ON cp.id = ss.person_id
    LEFT JOIN school_classes sc ON sc.id = ss.class_id
    WHERE ss.organization_id = p_org_id
      AND ss.enrollment_status = 'enrolled'
  LOOP
    v_fee := school_student_platform_fee(p_org_id, v_row.class_id);
    v_total := v_total + v_fee;
    v_count := v_count + 1;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'student_id', v_row.student_id,
      'student_name', v_row.student_name,
      'class_id', v_row.class_id,
      'class_name', COALESCE(v_row.class_name, 'Sans classe'),
      'fee_gnf', v_fee
    ));
  END LOOP;

  INSERT INTO platform_school_invoices (
    organization_id, period_year, period_month,
    amount_gnf, student_count, line_items, status, due_date
  ) VALUES (
    p_org_id, v_year, v_month,
    v_total, v_count, v_lines,
    CASE WHEN v_total > 0 THEN 'open'::platform_invoice_status ELSE 'paid'::platform_invoice_status END,
    (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE
  )
  ON CONFLICT (organization_id, period_year, period_month)
  DO UPDATE SET
    amount_gnf = EXCLUDED.amount_gnf,
    student_count = EXCLUDED.student_count,
    line_items = EXCLUDED.line_items,
    status = CASE
      WHEN platform_school_invoices.status = 'paid' THEN 'paid'::platform_invoice_status
      WHEN EXCLUDED.amount_gnf <= 0 THEN 'paid'::platform_invoice_status
      ELSE 'open'::platform_invoice_status
    END,
    updated_at = now()
  RETURNING * INTO v_invoice;

  IF v_invoice.status = 'open' AND v_invoice.due_date < CURRENT_DATE THEN
    UPDATE platform_school_invoices
    SET status = 'overdue'
    WHERE id = v_invoice.id;
    SELECT * INTO v_invoice FROM platform_school_invoices WHERE id = v_invoice.id;
  END IF;

  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION bootstrap_organization_billing(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type organization_type;
  v_plan_id UUID;
BEGIN
  SELECT type INTO v_type FROM organizations WHERE id = p_org_id;
  IF v_type IS NULL THEN RETURN; END IF;

  IF v_type = 'school' THEN
    UPDATE organizations
    SET settings = settings || jsonb_build_object(
      'billing', jsonb_build_object(
        'model', 'per_enrolled_student',
        'configured_at', now()
      )
    )
    WHERE id = p_org_id;
    PERFORM refresh_school_platform_invoice(p_org_id);
    RETURN;
  END IF;

  IF v_type NOT IN ('ngo', 'btp', 'business') THEN RETURN; END IF;

  SELECT id INTO v_plan_id
  FROM platform_billing_plans
  WHERE sector = v_type AND is_active
  ORDER BY monthly_price_gnf
  LIMIT 1;

  IF v_plan_id IS NULL THEN RETURN; END IF;

  INSERT INTO organization_subscriptions (
    organization_id, plan_id, status,
    current_period_start, current_period_end, trial_ends_at
  ) VALUES (
    p_org_id, v_plan_id, 'trialing',
    now(), now() + INTERVAL '14 days', now() + INTERVAL '14 days'
  )
  ON CONFLICT (organization_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION organization_platform_access_ok(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type organization_type;
  v_sub organization_subscriptions%ROWTYPE;
  v_overdue INTEGER;
BEGIN
  IF p_org_id IS NULL THEN RETURN true; END IF;
  IF is_platform_admin() THEN RETURN true; END IF;

  SELECT type INTO v_type FROM organizations WHERE id = p_org_id;
  IF NOT FOUND OR NOT COALESCE((SELECT is_active FROM organizations WHERE id = p_org_id), true) THEN
    RETURN false;
  END IF;

  IF v_type = 'school' THEN
    SELECT COUNT(*) INTO v_overdue
    FROM platform_school_invoices
    WHERE organization_id = p_org_id
      AND status = 'overdue';
    IF v_overdue > 0 THEN RETURN false; END IF;

    SELECT COUNT(*) INTO v_overdue
    FROM platform_school_invoices
    WHERE organization_id = p_org_id
      AND status = 'open'
      AND due_date < CURRENT_DATE;
    IF v_overdue > 0 THEN RETURN false; END IF;

    RETURN true;
  END IF;

  SELECT * INTO v_sub FROM organization_subscriptions WHERE organization_id = p_org_id;
  IF NOT FOUND THEN
    PERFORM bootstrap_organization_billing(p_org_id);
    SELECT * INTO v_sub FROM organization_subscriptions WHERE organization_id = p_org_id;
    IF NOT FOUND THEN RETURN false; END IF;
  END IF;

  IF v_sub.status = 'cancelled' OR v_sub.status = 'expired' THEN
    RETURN false;
  END IF;

  IF v_sub.status IN ('trialing', 'active') AND v_sub.current_period_end >= now() THEN
    RETURN true;
  END IF;

  IF v_sub.status = 'past_due' AND v_sub.grace_until IS NOT NULL AND v_sub.grace_until >= now() THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION get_organization_billing_status(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type organization_type;
  v_org organizations%ROWTYPE;
  v_sub organization_subscriptions%ROWTYPE;
  v_plan platform_billing_plans%ROWTYPE;
  v_invoice platform_school_invoices%ROWTYPE;
  v_default_fee NUMERIC;
  v_access BOOLEAN;
BEGIN
  IF NOT (is_platform_admin() OR belongs_to_org(p_org_id)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organisation introuvable'; END IF;
  v_type := v_org.type;
  v_access := organization_platform_access_ok(p_org_id);

  IF v_type = 'school' THEN
    PERFORM refresh_school_platform_invoice(p_org_id);
    SELECT * INTO v_invoice
    FROM platform_school_invoices
    WHERE organization_id = p_org_id
    ORDER BY period_year DESC, period_month DESC
    LIMIT 1;

    v_default_fee := COALESCE((v_org.settings->>'tuition_fee_gnf')::NUMERIC, 1500000);

    RETURN jsonb_build_object(
      'model', 'per_enrolled_student',
      'access_allowed', v_access,
      'default_tuition_fee_gnf', v_default_fee,
      'current_invoice', CASE WHEN v_invoice.id IS NOT NULL THEN jsonb_build_object(
        'id', v_invoice.id,
        'period_year', v_invoice.period_year,
        'period_month', v_invoice.period_month,
        'amount_gnf', v_invoice.amount_gnf,
        'student_count', v_invoice.student_count,
        'status', v_invoice.status,
        'due_date', v_invoice.due_date,
        'line_items', v_invoice.line_items,
        'paid_at', v_invoice.paid_at
      ) ELSE NULL END
    );
  END IF;

  SELECT * INTO v_sub
  FROM organization_subscriptions
  WHERE organization_id = p_org_id;

  IF NOT FOUND THEN
    PERFORM bootstrap_organization_billing(p_org_id);
    SELECT * INTO v_sub FROM organization_subscriptions WHERE organization_id = p_org_id;
  END IF;

  SELECT * INTO v_plan FROM platform_billing_plans WHERE id = v_sub.plan_id;

  RETURN jsonb_build_object(
    'model', 'monthly_subscription',
    'access_allowed', v_access,
    'subscription', jsonb_build_object(
      'id', v_sub.id,
      'status', v_sub.status,
      'current_period_start', v_sub.current_period_start,
      'current_period_end', v_sub.current_period_end,
      'trial_ends_at', v_sub.trial_ends_at,
      'grace_until', v_sub.grace_until,
      'plan_name', v_plan.name,
      'monthly_price_gnf', v_plan.monthly_price_gnf,
      'sector', v_plan.sector
    )
  );
END;
$$;

-- Renouvellement abonnement (paiement manuel / intégration future)
CREATE OR REPLACE FUNCTION record_subscription_renewal(
  p_org_id UUID,
  p_months INTEGER DEFAULT 1,
  p_reference TEXT DEFAULT NULL,
  p_amount_gnf NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub organization_subscriptions%ROWTYPE;
  v_plan platform_billing_plans%ROWTYPE;
  v_amount NUMERIC;
  v_new_end TIMESTAMPTZ;
BEGIN
  IF NOT (is_org_admin() AND belongs_to_org(p_org_id)) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  SELECT * INTO v_sub FROM organization_subscriptions WHERE organization_id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abonnement introuvable'; END IF;

  SELECT monthly_price_gnf INTO v_amount FROM platform_billing_plans WHERE id = v_sub.plan_id;
  v_amount := COALESCE(p_amount_gnf, v_amount * GREATEST(p_months, 1));
  v_new_end := GREATEST(v_sub.current_period_end, now()) + (p_months || ' months')::INTERVAL;

  UPDATE organization_subscriptions SET
    status = 'active',
    current_period_start = now(),
    current_period_end = v_new_end,
    trial_ends_at = NULL,
    grace_until = NULL,
    updated_at = now()
  WHERE organization_id = p_org_id;

  INSERT INTO platform_billing_payments (
    organization_id, kind, subscription_id, amount_gnf, reference, recorded_by
  ) VALUES (
    p_org_id, 'subscription_renewal', v_sub.id, v_amount, p_reference, auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'current_period_end', v_new_end);
END;
$$;

CREATE OR REPLACE FUNCTION record_school_invoice_payment(
  p_invoice_id UUID,
  p_reference TEXT DEFAULT NULL,
  p_amount_gnf NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv platform_school_invoices%ROWTYPE;
  v_amount NUMERIC;
BEGIN
  SELECT * INTO v_inv FROM platform_school_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Facture introuvable'; END IF;

  IF NOT (is_org_admin() AND belongs_to_org(v_inv.organization_id)) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  v_amount := COALESCE(p_amount_gnf, v_inv.amount_gnf);

  UPDATE platform_school_invoices SET
    status = 'paid',
    paid_at = now(),
    updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO platform_billing_payments (
    organization_id, kind, invoice_id, amount_gnf, reference, recorded_by
  ) VALUES (
    v_inv.organization_id, 'school_invoice', p_invoice_id, v_amount, p_reference, auth.uid()
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION update_school_billing_settings(
  p_org_id UUID,
  p_default_tuition_gnf NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_org_admin() AND belongs_to_org(p_org_id)) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF p_default_tuition_gnf IS NULL OR p_default_tuition_gnf < 0 THEN
    RAISE EXCEPTION 'Montant invalide';
  END IF;

  UPDATE organizations SET
    settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{tuition_fee_gnf}',
      to_jsonb(p_default_tuition_gnf),
      true
    )
  WHERE id = p_org_id;

  PERFORM refresh_school_platform_invoice(p_org_id);
  RETURN get_organization_billing_status(p_org_id);
END;
$$;

GRANT EXECUTE ON FUNCTION school_student_platform_fee(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_school_platform_invoice(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bootstrap_organization_billing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION organization_platform_access_ok(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_organization_billing_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_subscription_renewal(UUID, INTEGER, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION record_school_invoice_payment(UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION update_school_billing_settings(UUID, NUMERIC) TO authenticated;

-- Bootstrap orgs existantes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM organizations LOOP
    PERFORM bootstrap_organization_billing(r.id);
  END LOOP;
END $$;
