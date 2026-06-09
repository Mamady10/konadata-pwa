-- ============================================================
-- Établissements : abonnement plateforme ANNUEL (≠ mensuel BTP/ONG/PME)
-- Colonne monthly_base_gnf = forfait annuel pour les écoles
-- ============================================================

DO $$
BEGIN
  CREATE TYPE platform_billing_period AS ENUM ('monthly', 'annual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE organization_billing_offers
  ADD COLUMN IF NOT EXISTS billing_period platform_billing_period NOT NULL DEFAULT 'monthly';

UPDATE organization_billing_offers o
SET billing_period = 'annual'
FROM organizations org
WHERE org.id = o.organization_id AND org.type = 'school';

COMMENT ON COLUMN organization_billing_offers.monthly_base_gnf IS
  'BTP/ONG/PME : forfait mensuel. École : forfait annuel plateforme (GNF/an).';
COMMENT ON COLUMN organization_billing_offers.per_enrolled_student_gnf IS
  'École : tarif plateforme par élève inscrit et par an (GNF/élève/an).';

ALTER TABLE platform_school_invoices
  DROP CONSTRAINT IF EXISTS platform_school_invoices_period_month_check;

ALTER TABLE platform_school_invoices
  ADD CONSTRAINT platform_school_invoices_period_month_check
  CHECK (period_month BETWEEN 0 AND 12);

COMMENT ON COLUMN platform_school_invoices.period_month IS
  '0 = facture annuelle ; 1–12 = mensuel (legacy, non utilisé pour les écoles).';

-- Facture annuelle en cours (period_month = 0)
CREATE OR REPLACE FUNCTION refresh_school_platform_invoice(p_org_id UUID)
RETURNS platform_school_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_invoice platform_school_invoices;
  v_lines JSONB := '[]'::JSONB;
  v_total NUMERIC := 0;
  v_count INTEGER := 0;
  v_row RECORD;
  v_unit NUMERIC;
  v_base NUMERIC;
  v_valid_until DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organizations WHERE id = p_org_id AND type = 'school' AND billing_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Organisation scolaire inactive ou inexistante';
  END IF;

  SELECT COALESCE(
    (settings->>'platform_annual_base_gnf')::NUMERIC,
    (settings->>'platform_monthly_base_gnf')::NUMERIC,
    0
  ) INTO v_base FROM organizations WHERE id = p_org_id;

  IF v_base = 0 THEN
    SELECT COALESCE(monthly_base_gnf, 0) INTO v_base
    FROM organization_billing_offers WHERE organization_id = p_org_id;
  END IF;

  v_unit := org_platform_per_student_fee(p_org_id);
  v_total := v_base;

  FOR v_row IN
    SELECT ss.id AS student_id, cp.full_name AS student_name, ss.class_id,
           sc.name AS class_name, ss.enrollment_source
    FROM school_students ss
    JOIN core_persons cp ON cp.id = ss.person_id
    LEFT JOIN school_classes sc ON sc.id = ss.class_id
    WHERE ss.organization_id = p_org_id AND ss.enrollment_status = 'enrolled'
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
      'type', 'annual_base',
      'label', 'Forfait annuel plateforme',
      'fee_gnf', v_base
    )) || v_lines;
  END IF;

  SELECT (settings->>'platform_subscription_valid_until')::DATE INTO v_valid_until
  FROM organizations WHERE id = p_org_id;

  INSERT INTO platform_school_invoices (
    organization_id, period_year, period_month,
    amount_gnf, student_count, line_items, status, due_date
  ) VALUES (
    p_org_id, v_year, 0,
    v_total, v_count, v_lines,
    CASE WHEN v_total > 0 THEN 'open'::platform_invoice_status ELSE 'paid'::platform_invoice_status END,
    COALESCE(v_valid_until, (make_date(v_year, 12, 31)))
  )
  ON CONFLICT (organization_id, period_year, period_month)
  DO UPDATE SET
    amount_gnf = EXCLUDED.amount_gnf,
    student_count = EXCLUDED.student_count,
    line_items = EXCLUDED.line_items,
    due_date = EXCLUDED.due_date,
    status = CASE
      WHEN platform_school_invoices.status = 'paid' THEN 'paid'::platform_invoice_status
      WHEN EXCLUDED.amount_gnf <= 0 THEN 'paid'::platform_invoice_status
      ELSE platform_school_invoices.status
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
  v_valid_until DATE := (CURRENT_DATE + INTERVAL '1 year')::DATE;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  SELECT * INTO v_offer FROM organization_billing_offers WHERE organization_id = p_org_id;

  IF v_offer.status <> 'paid' THEN
    RAISE EXCEPTION 'Offre non payée';
  END IF;

  IF v_org.type = 'school' THEN
    UPDATE organizations SET
      billing_status = 'active',
      settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
        'platform_billing_period', 'annual',
        'platform_annual_base_gnf', v_offer.monthly_base_gnf,
        'platform_per_student_annual_gnf', v_offer.per_enrolled_student_gnf,
        'platform_per_student_gnf', v_offer.per_enrolled_student_gnf,
        'platform_subscription_valid_until', v_valid_until
      )
    WHERE id = p_org_id;

    PERFORM refresh_school_platform_invoice(p_org_id);

    UPDATE platform_school_invoices SET
      status = 'paid',
      paid_at = now(),
      notes = 'Première année incluse dans l''activation'
    WHERE organization_id = p_org_id
      AND period_year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
      AND period_month = 0;
    RETURN;
  END IF;

  UPDATE organizations SET
    billing_status = 'active',
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
      'platform_monthly_base_gnf', v_offer.monthly_base_gnf,
      'platform_per_student_gnf', v_offer.per_enrolled_student_gnf,
      'platform_billing_period', 'monthly'
    )
  WHERE id = p_org_id;

  IF v_org.type IN ('ngo', 'btp', 'business') THEN
    SELECT id INTO v_plan_id FROM platform_billing_plans
    WHERE sector = v_org.type AND is_active ORDER BY monthly_price_gnf LIMIT 1;

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
  v_valid_until DATE;
BEGIN
  IF p_org_id IS NULL THEN RETURN true; END IF;
  IF is_platform_admin() THEN RETURN true; END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND OR NOT COALESCE(v_org.is_active, true) THEN RETURN false; END IF;

  IF v_org.billing_status = 'pending_payment' OR v_org.billing_status = 'suspended' THEN
    RETURN false;
  END IF;

  IF v_org.type = 'school' THEN
    SELECT (settings->>'platform_subscription_valid_until')::DATE INTO v_valid_until
    FROM organizations WHERE id = p_org_id;

    IF v_valid_until IS NOT NULL AND v_valid_until < CURRENT_DATE THEN
      SELECT COUNT(*) INTO v_overdue FROM platform_school_invoices
      WHERE organization_id = p_org_id
        AND period_month = 0
        AND status IN ('open', 'overdue');
      IF v_overdue > 0 THEN RETURN false; END IF;
    END IF;

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
  v_new_valid DATE := NULL;
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

  IF v_inv.period_month = 0 THEN
    SELECT GREATEST(
      COALESCE((settings->>'platform_subscription_valid_until')::DATE, CURRENT_DATE),
      CURRENT_DATE
    ) + INTERVAL '1 year' INTO v_new_valid
    FROM organizations WHERE id = v_inv.organization_id;

    UPDATE organizations SET
      settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{platform_subscription_valid_until}',
        to_jsonb(v_new_valid::TEXT),
        true
      )
    WHERE id = v_inv.organization_id;
  END IF;

  INSERT INTO platform_billing_payments (
    organization_id, kind, invoice_id, amount_gnf, reference, recorded_by
  ) VALUES (
    v_inv.organization_id, 'school_invoice', p_invoice_id, v_amount, p_reference, auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'subscription_valid_until', v_new_valid);
END;
$$;

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
  v_period platform_billing_period := 'monthly';
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
    trim(p_name), p_type, p_email, p_phone, 'pending_payment',
    jsonb_build_object(
      'onboarding', jsonb_build_object(
        'declared_expected_students', p_declared_expected_students,
        'declared_city', p_declared_city,
        'submitted_at', now()
      ),
      'platform_billing_period', CASE WHEN p_type = 'school' THEN 'annual' ELSE 'monthly' END
    )
  )
  RETURNING id INTO v_org_id;

  SELECT * INTO v_plan FROM platform_billing_plans
  WHERE sector = p_type AND is_active ORDER BY monthly_price_gnf LIMIT 1;

  IF p_type = 'school' THEN
    v_period := 'annual';
    v_activation := 500000;
    v_base := 3600000;
    v_per_student := 300000;
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
    organization_id, status, sector_plan_id, billing_period,
    activation_amount_gnf, monthly_base_gnf, per_enrolled_student_gnf,
    declared_expected_students, declared_city, declared_phone
  ) VALUES (
    v_org_id, 'draft', v_plan.id, v_period,
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
  v_period platform_billing_period;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'Réservé à l''admin KonaData'; END IF;

  SELECT CASE WHEN o.type = 'school' THEN 'annual'::platform_billing_period ELSE 'monthly'::platform_billing_period END
  INTO v_period FROM organizations o WHERE o.id = p_org_id;

  UPDATE organization_billing_offers SET
    activation_amount_gnf = GREATEST(0, p_activation),
    monthly_base_gnf = GREATEST(0, p_monthly_base),
    per_enrolled_student_gnf = GREATEST(0, p_per_student),
    billing_period = v_period,
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
    'billing_period', v_offer.billing_period,
    'activation_amount_gnf', v_offer.activation_amount_gnf,
    'monthly_base_gnf', v_offer.monthly_base_gnf,
    'annual_base_gnf', CASE WHEN v_offer.billing_period = 'annual' THEN v_offer.monthly_base_gnf ELSE NULL END,
    'per_enrolled_student_gnf', v_offer.per_enrolled_student_gnf,
    'declared_expected_students', v_offer.declared_expected_students,
    'ceo_notes', v_offer.ceo_notes
  );
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
      'model', CASE WHEN v_org.type = 'school' THEN 'annual_school_subscription' ELSE 'monthly_subscription' END,
      'access_allowed', false,
      'billing_status', v_org.billing_status,
      'billing_period', COALESCE(v_offer.billing_period::TEXT, 'annual'),
      'offer', CASE WHEN v_offer.id IS NOT NULL THEN jsonb_build_object(
        'status', v_offer.status,
        'activation_amount_gnf', v_offer.activation_amount_gnf,
        'monthly_base_gnf', v_offer.monthly_base_gnf,
        'annual_base_gnf', v_offer.monthly_base_gnf,
        'per_enrolled_student_gnf', v_offer.per_enrolled_student_gnf,
        'payment_token', v_offer.payment_token,
        'ceo_notes', v_offer.ceo_notes,
        'billing_period', v_offer.billing_period
      ) ELSE NULL END
    );
  END IF;

  IF v_org.type = 'school' THEN
    PERFORM refresh_school_platform_invoice(p_org_id);
    SELECT * INTO v_invoice FROM platform_school_invoices
    WHERE organization_id = p_org_id AND period_month = 0
    ORDER BY period_year DESC LIMIT 1;

    RETURN jsonb_build_object(
      'model', 'annual_school_subscription',
      'access_allowed', v_access,
      'billing_status', v_org.billing_status,
      'billing_period', 'annual',
      'default_tuition_fee_gnf', COALESCE((v_org.settings->>'tuition_fee_gnf')::NUMERIC, 1500000),
      'platform_annual_base_gnf', COALESCE(
        (v_org.settings->>'platform_annual_base_gnf')::NUMERIC,
        v_offer.monthly_base_gnf,
        0
      ),
      'platform_per_student_gnf', org_platform_per_student_fee(p_org_id),
      'subscription_valid_until', v_org.settings->>'platform_subscription_valid_until',
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
    'billing_period', 'monthly',
    'subscription', CASE WHEN v_sub.id IS NOT NULL THEN jsonb_build_object(
      'id', v_sub.id,
      'status', v_sub.status,
      'current_period_end', v_sub.current_period_end,
      'plan_name', v_plan.name,
      'monthly_price_gnf', v_plan.monthly_price_gnf
    ) ELSE NULL END
  );
END;
$$;

UPDATE organization_billing_offers o
SET billing_period = 'annual'
FROM organizations org
WHERE org.id = o.organization_id AND org.type = 'school' AND o.billing_period = 'monthly';
