-- ============================================================
-- Offres personnalisées CEO + activation obligatoire avant accès
-- Facturation école : base + par élève inscrit (tarif plateforme, ≠ scolarité)
-- ============================================================

CREATE TYPE organization_billing_status AS ENUM (
  'pending_payment', 'active', 'suspended'
);

CREATE TYPE billing_offer_status AS ENUM (
  'draft', 'awaiting_payment', 'paid', 'cancelled'
);

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS billing_status organization_billing_status NOT NULL DEFAULT 'active';

COMMENT ON COLUMN organizations.billing_status IS
  'pending_payment = org créée, accès bloqué jusqu''au paiement de l''offre CEO';

CREATE TABLE organization_billing_offers (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  status                    billing_offer_status NOT NULL DEFAULT 'draft',
  sector_plan_id            UUID REFERENCES platform_billing_plans(id) ON DELETE SET NULL,
  activation_amount_gnf     NUMERIC(14, 2) NOT NULL DEFAULT 0,
  monthly_base_gnf          NUMERIC(14, 2) NOT NULL DEFAULT 0,
  per_enrolled_student_gnf  NUMERIC(14, 2) NOT NULL DEFAULT 0,
  declared_expected_students INTEGER,
  declared_city             TEXT,
  declared_phone            TEXT,
  ceo_notes                 TEXT,
  payment_token             TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  payment_reference         TEXT,
  priced_by                 UUID REFERENCES profiles(id) ON DELETE SET NULL,
  priced_at                 TIMESTAMPTZ,
  paid_at                   TIMESTAMPTZ,
  paid_recorded_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_offers_token ON organization_billing_offers(payment_token);
CREATE INDEX idx_billing_offers_status ON organization_billing_offers(status);

CREATE TRIGGER trg_billing_offers_updated
  BEFORE UPDATE ON organization_billing_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE school_students
  ADD COLUMN IF NOT EXISTS enrollment_source TEXT NOT NULL DEFAULT 'manual'
  CHECK (enrollment_source IN ('platform', 'manual', 'import'));

COMMENT ON COLUMN school_students.enrollment_source IS
  'platform = candidature en ligne ; manual/import = saisie établissement (comptent aussi pour la facturation KonaData)';

-- Tarif plateforme par élève (≠ frais de scolarité élève → école)
CREATE OR REPLACE FUNCTION org_platform_per_student_fee(p_org_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee NUMERIC;
BEGIN
  SELECT per_enrolled_student_gnf INTO v_fee
  FROM organization_billing_offers
  WHERE organization_id = p_org_id AND status = 'paid';

  IF v_fee IS NOT NULL AND v_fee > 0 THEN
    RETURN v_fee;
  END IF;

  SELECT COALESCE((settings->>'platform_per_student_gnf')::NUMERIC, 0)
  INTO v_fee
  FROM organizations WHERE id = p_org_id;

  RETURN COALESCE(v_fee, 0);
END;
$$;

CREATE OR REPLACE FUNCTION school_student_platform_fee(
  p_org_id UUID,
  p_class_id UUID
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_platform_per_student_fee(p_org_id)
$$;

-- Facture mensuelle école = base mensuelle + (élèves inscrits × tarif plateforme)
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
  v_unit NUMERIC;
  v_base NUMERIC;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organizations WHERE id = p_org_id AND type = 'school' AND billing_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Organisation scolaire inactive ou inexistante';
  END IF;

  SELECT COALESCE(monthly_base_gnf, 0) INTO v_base
  FROM organization_billing_offers WHERE organization_id = p_org_id;

  IF v_base IS NULL OR v_base = 0 THEN
    SELECT COALESCE((settings->>'platform_monthly_base_gnf')::NUMERIC, 0) INTO v_base
    FROM organizations WHERE id = p_org_id;
  END IF;

  v_unit := org_platform_per_student_fee(p_org_id);
  v_total := v_base;

  FOR v_row IN
    SELECT ss.id AS student_id,
           cp.full_name AS student_name,
           ss.class_id,
           sc.name AS class_name,
           ss.enrollment_source
    FROM school_students ss
    JOIN core_persons cp ON cp.id = ss.person_id
    LEFT JOIN school_classes sc ON sc.id = ss.class_id
    WHERE ss.organization_id = p_org_id
      AND ss.enrollment_status = 'enrolled'
  LOOP
    v_total := v_total + v_unit;
    v_count := v_count + 1;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'student_id', v_row.student_id,
      'student_name', v_row.student_name,
      'class_id', v_row.class_id,
      'class_name', COALESCE(v_row.class_name, 'Sans classe'),
      'fee_gnf', v_unit,
      'enrollment_source', v_row.enrollment_source
    ));
  END LOOP;

  IF v_base > 0 THEN
    v_lines := jsonb_build_array(jsonb_build_object(
      'type', 'monthly_base',
      'label', 'Forfait mensuel plateforme',
      'fee_gnf', v_base
    )) || v_lines;
  END IF;

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
    UPDATE platform_school_invoices SET status = 'overdue' WHERE id = v_invoice.id;
    SELECT * INTO v_invoice FROM platform_school_invoices WHERE id = v_invoice.id;
  END IF;

  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION activate_organization_after_offer_payment(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_offer organization_billing_offers%ROWTYPE;
  v_plan_id UUID;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  SELECT * INTO v_offer FROM organization_billing_offers WHERE organization_id = p_org_id;

  IF v_offer.status <> 'paid' THEN
    RAISE EXCEPTION 'Offre non payée';
  END IF;

  UPDATE organizations SET
    billing_status = 'active',
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
      'platform_monthly_base_gnf', v_offer.monthly_base_gnf,
      'platform_per_student_gnf', v_offer.per_enrolled_student_gnf
    )
  WHERE id = p_org_id;

  IF v_org.type = 'school' THEN
    PERFORM refresh_school_platform_invoice(p_org_id);
    RETURN;
  END IF;

  IF v_org.type IN ('ngo', 'btp', 'business') THEN
    SELECT id INTO v_plan_id FROM platform_billing_plans
    WHERE sector = v_org.type AND is_active
    ORDER BY monthly_price_gnf LIMIT 1;

    IF v_plan_id IS NOT NULL THEN
      INSERT INTO organization_subscriptions (
        organization_id, plan_id, status,
        current_period_start, current_period_end
      ) VALUES (
        p_org_id, COALESCE(v_offer.sector_plan_id, v_plan_id), 'active',
        now(), now() + INTERVAL '1 month'
      )
      ON CONFLICT (organization_id) DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        status = 'active',
        current_period_start = now(),
        current_period_end = now() + INTERVAL '1 month',
        updated_at = now();
    END IF;
  END IF;
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
  v_org organizations%ROWTYPE;
  v_sub organization_subscriptions%ROWTYPE;
  v_overdue INTEGER;
BEGIN
  IF p_org_id IS NULL THEN RETURN true; END IF;
  IF is_platform_admin() THEN RETURN true; END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND OR NOT COALESCE(v_org.is_active, true) THEN RETURN false; END IF;

  IF v_org.billing_status = 'pending_payment' OR v_org.billing_status = 'suspended' THEN
    RETURN false;
  END IF;

  IF v_org.type = 'school' THEN
    SELECT COUNT(*) INTO v_overdue FROM platform_school_invoices
    WHERE organization_id = p_org_id AND status = 'overdue';
    IF v_overdue > 0 THEN RETURN false; END IF;
    SELECT COUNT(*) INTO v_overdue FROM platform_school_invoices
    WHERE organization_id = p_org_id AND status = 'open' AND due_date < CURRENT_DATE;
    RETURN v_overdue = 0;
  END IF;

  SELECT * INTO v_sub FROM organization_subscriptions WHERE organization_id = p_org_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_sub.status IN ('trialing', 'active') AND v_sub.current_period_end >= now() THEN
    RETURN true;
  END IF;
  IF v_sub.status = 'past_due' AND v_sub.grace_until IS NOT NULL AND v_sub.grace_until >= now() THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- Création org : pending_payment + offre brouillon (grille sectorielle en secours)
CREATE OR REPLACE FUNCTION create_organization_with_owner(
  p_name TEXT,
  p_type organization_type,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_declared_expected_students INTEGER DEFAULT NULL,
  p_declared_city TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_plan platform_billing_plans%ROWTYPE;
  v_activation NUMERIC := 0;
  v_base NUMERIC := 0;
  v_per_student NUMERIC := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF get_user_organization_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Vous êtes déjà rattaché à une organisation';
  END IF;
  IF trim(COALESCE(p_name, '')) = '' THEN RAISE EXCEPTION 'Le nom de l''organisation est requis'; END IF;
  IF p_type = 'school' AND school_org_name_taken(p_name, NULL) THEN
    RAISE EXCEPTION 'Un établissement scolaire porte déjà ce nom. Choisissez un nom distinct (ex. ajoutez la ville).';
  END IF;

  INSERT INTO organizations (name, type, email, phone, billing_status, settings)
  VALUES (
    trim(p_name), p_type, p_email, p_phone,
    'pending_payment',
    jsonb_build_object(
      'onboarding', jsonb_build_object(
        'declared_expected_students', p_declared_expected_students,
        'declared_city', p_declared_city,
        'submitted_at', now()
      )
    )
  )
  RETURNING id INTO v_org_id;

  SELECT * INTO v_plan FROM platform_billing_plans
  WHERE sector = p_type AND is_active
  ORDER BY monthly_price_gnf LIMIT 1;

  IF p_type = 'school' THEN
    v_activation := 500000;
    v_base := 300000;
    v_per_student := 25000;
    IF p_declared_expected_students IS NOT NULL AND p_declared_expected_students > 0 THEN
      v_activation := v_activation + (p_declared_expected_students * v_per_student);
    END IF;
  ELSIF v_plan.id IS NOT NULL THEN
    v_activation := v_plan.monthly_price_gnf;
    v_base := v_plan.monthly_price_gnf;
  ELSE
    v_activation := 1000000;
    v_base := 1000000;
  END IF;

  INSERT INTO organization_billing_offers (
    organization_id, status, sector_plan_id,
    activation_amount_gnf, monthly_base_gnf, per_enrolled_student_gnf,
    declared_expected_students, declared_city, declared_phone
  ) VALUES (
    v_org_id, 'draft', v_plan.id,
    v_activation, v_base, v_per_student,
    p_declared_expected_students, p_declared_city, p_phone
  );

  UPDATE profiles SET organization_id = v_org_id, role = 'org_admin' WHERE id = v_user_id;

  RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION platform_admin_set_billing_offer(
  p_org_id UUID,
  p_activation NUMERIC,
  p_monthly_base NUMERIC,
  p_per_student NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS organization_billing_offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer organization_billing_offers%ROWTYPE;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'Réservé à l''admin KonaData'; END IF;

  UPDATE organization_billing_offers SET
    activation_amount_gnf = GREATEST(0, p_activation),
    monthly_base_gnf = GREATEST(0, p_monthly_base),
    per_enrolled_student_gnf = GREATEST(0, p_per_student),
    ceo_notes = p_notes,
    status = 'awaiting_payment',
    priced_by = auth.uid(),
    priced_at = now()
  WHERE organization_id = p_org_id
  RETURNING * INTO v_offer;

  IF NOT FOUND THEN RAISE EXCEPTION 'Offre introuvable'; END IF;
  RETURN v_offer;
END;
$$;

CREATE OR REPLACE FUNCTION record_offer_activation_payment(
  p_org_id UUID,
  p_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer organization_billing_offers%ROWTYPE;
BEGIN
  IF NOT is_platform_admin() AND NOT (is_org_admin() AND belongs_to_org(p_org_id)) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  SELECT * INTO v_offer FROM organization_billing_offers WHERE organization_id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offre introuvable'; END IF;
  IF v_offer.status NOT IN ('awaiting_payment', 'draft') THEN
    RAISE EXCEPTION 'Offre déjà traitée';
  END IF;

  UPDATE organization_billing_offers SET
    status = 'paid',
    payment_reference = p_reference,
    paid_at = now(),
    paid_recorded_by = auth.uid()
  WHERE organization_id = p_org_id;

  INSERT INTO platform_billing_payments (
    organization_id, kind, amount_gnf, reference, recorded_by
  ) VALUES (
    p_org_id, 'subscription_renewal', v_offer.activation_amount_gnf, p_reference, auth.uid()
  );

  PERFORM activate_organization_after_offer_payment(p_org_id);

  RETURN jsonb_build_object('success', true, 'organization_id', p_org_id);
END;
$$;

CREATE OR REPLACE FUNCTION get_billing_offer_by_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer organization_billing_offers%ROWTYPE;
  v_org organizations%ROWTYPE;
BEGIN
  SELECT o.* INTO v_offer FROM organization_billing_offers o WHERE payment_token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO v_org FROM organizations WHERE id = v_offer.organization_id;

  RETURN jsonb_build_object(
    'organization_name', v_org.name,
    'organization_type', v_org.type,
    'billing_status', v_org.billing_status,
    'offer_status', v_offer.status,
    'activation_amount_gnf', v_offer.activation_amount_gnf,
    'monthly_base_gnf', v_offer.monthly_base_gnf,
    'per_enrolled_student_gnf', v_offer.per_enrolled_student_gnf,
    'declared_expected_students', v_offer.declared_expected_students,
    'ceo_notes', v_offer.ceo_notes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_organization_with_owner(TEXT, organization_type, TEXT, TEXT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_admin_set_billing_offer(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_offer_activation_payment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_billing_offer_by_token(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION activate_organization_after_offer_payment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION org_platform_per_student_fee(UUID) TO authenticated;

-- Rétrocompatibilité : orgs existantes → offre payée + accès actif
INSERT INTO organization_billing_offers (
  organization_id, status, activation_amount_gnf, monthly_base_gnf, per_enrolled_student_gnf
)
SELECT
  o.id, 'paid', 0,
  CASE WHEN o.type = 'school' THEN 300000 ELSE COALESCE(p.monthly_price_gnf, 0) END,
  CASE WHEN o.type = 'school' THEN 25000 ELSE 0 END
FROM organizations o
LEFT JOIN platform_billing_plans p ON p.sector = o.type AND p.is_active
WHERE NOT EXISTS (
  SELECT 1 FROM organization_billing_offers b WHERE b.organization_id = o.id
)
ON CONFLICT (organization_id) DO NOTHING;

UPDATE organizations SET billing_status = 'active' WHERE billing_status IS NULL;

-- Statut facturation (offre + accès)
CREATE OR REPLACE FUNCTION get_organization_billing_status(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_offer organization_billing_offers%ROWTYPE;
  v_invoice platform_school_invoices%ROWTYPE;
  v_sub organization_subscriptions%ROWTYPE;
  v_plan platform_billing_plans%ROWTYPE;
  v_access BOOLEAN;
BEGIN
  IF NOT (is_platform_admin() OR belongs_to_org(p_org_id)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  SELECT * INTO v_offer FROM organization_billing_offers WHERE organization_id = p_org_id;
  v_access := organization_platform_access_ok(p_org_id);

  IF v_org.billing_status = 'pending_payment' THEN
    RETURN jsonb_build_object(
      'model', CASE WHEN v_org.type = 'school' THEN 'per_enrolled_student' ELSE 'monthly_subscription' END,
      'access_allowed', false,
      'billing_status', v_org.billing_status,
      'offer', CASE WHEN v_offer.id IS NOT NULL THEN jsonb_build_object(
        'status', v_offer.status,
        'activation_amount_gnf', v_offer.activation_amount_gnf,
        'monthly_base_gnf', v_offer.monthly_base_gnf,
        'per_enrolled_student_gnf', v_offer.per_enrolled_student_gnf,
        'payment_token', v_offer.payment_token,
        'ceo_notes', v_offer.ceo_notes
      ) ELSE NULL END
    );
  END IF;

  IF v_org.type = 'school' THEN
    PERFORM refresh_school_platform_invoice(p_org_id);
    SELECT * INTO v_invoice FROM platform_school_invoices
    WHERE organization_id = p_org_id
    ORDER BY period_year DESC, period_month DESC LIMIT 1;

    RETURN jsonb_build_object(
      'model', 'per_enrolled_student',
      'access_allowed', v_access,
      'billing_status', v_org.billing_status,
      'default_tuition_fee_gnf', COALESCE((v_org.settings->>'tuition_fee_gnf')::NUMERIC, 1500000),
      'platform_monthly_base_gnf', COALESCE((v_org.settings->>'platform_monthly_base_gnf')::NUMERIC, v_offer.monthly_base_gnf, 0),
      'platform_per_student_gnf', org_platform_per_student_fee(p_org_id),
      'current_invoice', CASE WHEN v_invoice.id IS NOT NULL THEN to_jsonb(v_invoice) ELSE NULL END
    );
  END IF;

  SELECT * INTO v_sub FROM organization_subscriptions WHERE organization_id = p_org_id;
  IF v_sub.id IS NOT NULL THEN
    SELECT * INTO v_plan FROM platform_billing_plans WHERE id = v_sub.plan_id;
  END IF;

  RETURN jsonb_build_object(
    'model', 'monthly_subscription',
    'access_allowed', v_access,
    'billing_status', v_org.billing_status,
    'subscription', CASE WHEN v_sub.id IS NOT NULL THEN jsonb_build_object(
      'id', v_sub.id,
      'status', v_sub.status,
      'current_period_end', v_sub.current_period_end,
      'plan_name', v_plan.name,
      'monthly_price_gnf', v_plan.monthly_price_gnf
    ) ELSE NULL END,
    'offer', CASE WHEN v_offer.id IS NOT NULL THEN jsonb_build_object(
      'monthly_base_gnf', v_offer.monthly_base_gnf,
      'per_enrolled_student_gnf', v_offer.per_enrolled_student_gnf
    ) ELSE NULL END
  );
END;
$$;
