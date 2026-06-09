-- ============================================================
-- Établissements : paiement ANNUEL AVANT activation (début de période)
-- Pas de facture ouverte en fin d'année — renouvellement = pending_renewal + paiement d'abord
-- ============================================================

DO $$
BEGIN
  ALTER TYPE organization_billing_status ADD VALUE 'pending_renewal';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN organizations.billing_status IS
  'pending_payment = 1ère activation ; pending_renewal = renouvellement annuel à payer en début de période ; active = à jour';

-- Montant annuel = forfait + (élèves inscrits × tarif/an). p_use_declared = devis à l''inscription.
CREATE OR REPLACE FUNCTION compute_school_annual_amount(
  p_org_id UUID,
  p_use_declared BOOLEAN DEFAULT false
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base NUMERIC := 0;
  v_unit NUMERIC := 0;
  v_count INTEGER := 0;
  v_declared INTEGER;
BEGIN
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
  IF v_unit = 0 THEN
    SELECT COALESCE(per_enrolled_student_gnf, 0) INTO v_unit
    FROM organization_billing_offers WHERE organization_id = p_org_id;
  END IF;

  IF p_use_declared THEN
    SELECT declared_expected_students INTO v_declared
    FROM organization_billing_offers WHERE organization_id = p_org_id;
    v_count := COALESCE(v_declared, 0);
  ELSE
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM school_students
    WHERE organization_id = p_org_id AND enrollment_status = 'enrolled';
  END IF;

  RETURN v_base + (v_count * v_unit);
END;
$$;

-- Recalcule uniquement le montant dû sur l'offre (pas de facture ouverte en fin d'année)
CREATE OR REPLACE FUNCTION refresh_school_platform_invoice(p_org_id UUID)
RETURNS platform_school_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_invoice platform_school_invoices;
  v_org organizations%ROWTYPE;
  v_amount NUMERIC;
  v_count INTEGER;
  v_lines JSONB;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_org_id AND type = 'school';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organisation scolaire introuvable';
  END IF;

  v_amount := compute_school_annual_amount(p_org_id, false);
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM school_students WHERE organization_id = p_org_id AND enrollment_status = 'enrolled';

  v_lines := jsonb_build_array(jsonb_build_object(
    'type', 'annual_upfront',
    'label', 'Abonnement annuel (paiement en début de période)',
    'fee_gnf', v_amount,
    'student_count', v_count
  ));

  INSERT INTO platform_school_invoices (
    organization_id, period_year, period_month,
    amount_gnf, student_count, line_items, status, due_date, paid_at
  ) VALUES (
    p_org_id, v_year, 0,
    v_amount, v_count, v_lines,
    CASE
      WHEN v_org.billing_status IN ('pending_payment', 'pending_renewal') THEN 'draft'::platform_invoice_status
      WHEN (v_org.settings->>'platform_subscription_valid_until')::DATE >= CURRENT_DATE
        THEN 'paid'::platform_invoice_status
      ELSE 'draft'::platform_invoice_status
    END,
    CURRENT_DATE,
    CASE
      WHEN v_org.billing_status = 'active'
        AND (v_org.settings->>'platform_subscription_valid_until')::DATE >= CURRENT_DATE
      THEN now()
      ELSE NULL
    END
  )
  ON CONFLICT (organization_id, period_year, period_month)
  DO UPDATE SET
    amount_gnf = EXCLUDED.amount_gnf,
    student_count = EXCLUDED.student_count,
    line_items = EXCLUDED.line_items,
    due_date = CURRENT_DATE,
    updated_at = now(),
    status = CASE
      WHEN platform_school_invoices.status = 'paid' THEN 'paid'::platform_invoice_status
      ELSE EXCLUDED.status
    END
  RETURNING * INTO v_invoice;

  RETURN v_invoice;
END;
$$;

-- Passage en renouvellement : à payer AVANT la nouvelle période
CREATE OR REPLACE FUNCTION prepare_school_renewal_billing(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_offer organization_billing_offers%ROWTYPE;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Réservé à l''admin KonaData';
  END IF;

  v_amount := compute_school_annual_amount(p_org_id, false);

  UPDATE organizations SET billing_status = 'pending_renewal' WHERE id = p_org_id;

  UPDATE organization_billing_offers SET
    activation_amount_gnf = v_amount,
    status = 'awaiting_payment',
    priced_by = auth.uid(),
    priced_at = now()
  WHERE organization_id = p_org_id
  RETURNING * INTO v_offer;

  PERFORM refresh_school_platform_invoice(p_org_id);

  RETURN jsonb_build_object(
    'organization_id', p_org_id,
    'amount_gnf', v_amount,
    'payment_token', v_offer.payment_token,
    'status', 'awaiting_payment'
  );
END;
$$;

CREATE OR REPLACE FUNCTION ensure_school_renewal_state(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_until DATE;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_org_id AND type = 'school';
  IF NOT FOUND OR v_org.billing_status = 'pending_payment' THEN RETURN; END IF;

  v_until := (v_org.settings->>'platform_subscription_valid_until')::DATE;
  IF v_org.billing_status = 'active' AND v_until IS NOT NULL AND v_until < CURRENT_DATE THEN
    UPDATE organizations SET billing_status = 'pending_renewal' WHERE id = p_org_id;
    UPDATE organization_billing_offers SET
      activation_amount_gnf = compute_school_annual_amount(p_org_id, false),
      status = 'awaiting_payment'
    WHERE organization_id = p_org_id AND status = 'paid';
  END IF;
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
  v_valid_from DATE := CURRENT_DATE;
  v_valid_until DATE := (CURRENT_DATE + INTERVAL '1 year')::DATE;
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_amount NUMERIC;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  SELECT * INTO v_offer FROM organization_billing_offers WHERE organization_id = p_org_id;

  IF v_offer.status <> 'paid' THEN
    RAISE EXCEPTION 'Offre non payée';
  END IF;

  IF v_org.type = 'school' THEN
    v_amount := v_offer.activation_amount_gnf;
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM school_students WHERE organization_id = p_org_id AND enrollment_status = 'enrolled';

    UPDATE organizations SET
      billing_status = 'active',
      settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
        'platform_billing_period', 'annual',
        'platform_annual_base_gnf', v_offer.monthly_base_gnf,
        'platform_per_student_annual_gnf', v_offer.per_enrolled_student_gnf,
        'platform_per_student_gnf', v_offer.per_enrolled_student_gnf,
        'platform_subscription_valid_from', v_valid_from,
        'platform_subscription_valid_until', v_valid_until,
        'last_annual_payment_at', now()
      )
    WHERE id = p_org_id;

    INSERT INTO platform_school_invoices (
      organization_id, period_year, period_month,
      amount_gnf, student_count, line_items, status, due_date, paid_at, notes
    ) VALUES (
      p_org_id, v_year, 0, v_amount, v_count,
      jsonb_build_array(jsonb_build_object(
        'type', 'annual_upfront',
        'label', 'Abonnement annuel payé avant activation / renouvellement',
        'fee_gnf', v_amount
      )),
      'paid', v_valid_from, now(),
      'Paiement en début de période — accès débloqué'
    )
    ON CONFLICT (organization_id, period_year, period_month)
    DO UPDATE SET
      amount_gnf = EXCLUDED.amount_gnf,
      status = 'paid',
      paid_at = now(),
      due_date = v_valid_from,
      notes = EXCLUDED.notes,
      updated_at = now();

    RETURN;
  END IF;

  UPDATE organizations SET
    billing_status = 'active',
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
      'platform_monthly_base_gnf', v_offer.monthly_base_gnf,
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
  v_until DATE;
BEGIN
  IF p_org_id IS NULL THEN RETURN true; END IF;
  IF is_platform_admin() THEN RETURN true; END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND OR NOT COALESCE(v_org.is_active, true) THEN RETURN false; END IF;

  IF v_org.billing_status IN ('pending_payment', 'pending_renewal', 'suspended') THEN
    RETURN false;
  END IF;

  IF v_org.type = 'school' THEN
    PERFORM ensure_school_renewal_state(p_org_id);
    SELECT billing_status, (settings->>'platform_subscription_valid_until')::DATE
    INTO v_org.billing_status, v_until
    FROM organizations WHERE id = p_org_id;

    IF v_org.billing_status <> 'active' THEN RETURN false; END IF;
    IF v_until IS NULL OR v_until < CURRENT_DATE THEN RETURN false; END IF;
    RETURN true;
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
  v_is_school BOOLEAN;
  v_upfront NUMERIC;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'Réservé à l''admin KonaData'; END IF;

  SELECT (o.type = 'school'), CASE WHEN o.type = 'school' THEN 'annual'::platform_billing_period ELSE 'monthly'::platform_billing_period END
  INTO v_is_school, v_period FROM organizations o WHERE o.id = p_org_id;

  IF v_is_school THEN
    v_upfront := GREATEST(0, p_activation);
    IF v_upfront = 0 THEN
      v_upfront := GREATEST(0, p_monthly_base) + GREATEST(0, p_per_student) * COALESCE(
        (SELECT declared_expected_students FROM organization_billing_offers WHERE organization_id = p_org_id),
        0
      );
    END IF;
  ELSE
    v_upfront := GREATEST(0, p_activation);
  END IF;

  UPDATE organization_billing_offers SET
    activation_amount_gnf = v_upfront,
    monthly_base_gnf = GREATEST(0, p_monthly_base),
    per_enrolled_student_gnf = GREATEST(0, p_per_student),
    billing_period = v_period,
    ceo_notes = COALESCE(p_notes, ceo_notes) ||
      CASE WHEN v_is_school THEN E' — Paiement annuel obligatoire avant activation/renouvellement.' ELSE '' END,
    status = 'awaiting_payment',
    priced_by = auth.uid(),
    priced_at = now()
  WHERE organization_id = p_org_id
  RETURNING * INTO v_offer;

  IF NOT FOUND THEN RAISE EXCEPTION 'Offre introuvable'; END IF;
  RETURN v_offer;
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
  v_base NUMERIC := 0;
  v_per_student NUMERIC := 0;
  v_upfront NUMERIC := 0;
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
    v_base := 3600000;
    v_per_student := 300000;
    v_upfront := v_base + (COALESCE(p_declared_expected_students, 0) * v_per_student);
  ELSIF v_plan.id IS NOT NULL THEN
    v_upfront := v_plan.monthly_price_gnf;
    v_base := v_plan.monthly_price_gnf;
  ELSE
    v_upfront := 1000000;
    v_base := 1000000;
  END IF;

  INSERT INTO organization_billing_offers (
    organization_id, status, sector_plan_id, billing_period,
    activation_amount_gnf, monthly_base_gnf, per_enrolled_student_gnf,
    declared_expected_students, declared_city, declared_phone,
    ceo_notes
  ) VALUES (
    v_org_id, 'draft', v_plan.id, v_period,
    v_upfront, v_base, v_per_student,
    p_declared_expected_students, p_declared_city, p_phone,
    CASE WHEN p_type = 'school'
      THEN 'Abonnement annuel à régler avant activation du compte (début de période).'
      ELSE NULL END
  );

  UPDATE profiles SET organization_id = v_org_id, role = 'org_admin' WHERE id = v_user_id;
  RETURN v_org_id;
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
  v_org organizations%ROWTYPE;
BEGIN
  IF NOT is_platform_admin() AND NOT (is_org_admin() AND belongs_to_org(p_org_id)) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  SELECT * INTO v_offer FROM organization_billing_offers WHERE organization_id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offre introuvable'; END IF;
  IF v_offer.status NOT IN ('awaiting_payment', 'draft') THEN
    RAISE EXCEPTION 'Offre déjà traitée ou en attente de tarification CEO';
  END IF;
  IF v_org.type = 'school' AND v_offer.activation_amount_gnf <= 0 THEN
    RAISE EXCEPTION 'Montant annuel non défini — le CEO doit fixer le tarif avant paiement';
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

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'billing_status', 'active'
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
  v_upfront_due NUMERIC;
BEGIN
  IF NOT (is_platform_admin() OR belongs_to_org(p_org_id)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  SELECT * INTO v_offer FROM organization_billing_offers WHERE organization_id = p_org_id;

  IF v_org.type = 'school' THEN
    PERFORM ensure_school_renewal_state(p_org_id);
    SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  END IF;

  v_access := organization_platform_access_ok(p_org_id);

  IF v_org.billing_status IN ('pending_payment', 'pending_renewal') THEN
    v_upfront_due := COALESCE(v_offer.activation_amount_gnf, compute_school_annual_amount(p_org_id, v_org.billing_status = 'pending_payment'));
    RETURN jsonb_build_object(
      'model', CASE WHEN v_org.type = 'school' THEN 'annual_school_subscription' ELSE 'monthly_subscription' END,
      'access_allowed', false,
      'billing_status', v_org.billing_status,
      'billing_period', 'annual',
      'upfront_annual_due_gnf', v_upfront_due,
      'offer', jsonb_build_object(
        'status', v_offer.status,
        'activation_amount_gnf', v_offer.activation_amount_gnf,
        'annual_base_gnf', v_offer.monthly_base_gnf,
        'per_enrolled_student_gnf', v_offer.per_enrolled_student_gnf,
        'payment_token', v_offer.payment_token,
        'ceo_notes', v_offer.ceo_notes
      )
    );
  END IF;

  IF v_org.type = 'school' THEN
    SELECT * INTO v_invoice FROM platform_school_invoices
    WHERE organization_id = p_org_id AND period_month = 0
    ORDER BY period_year DESC LIMIT 1;

    RETURN jsonb_build_object(
      'model', 'annual_school_subscription',
      'access_allowed', v_access,
      'billing_status', v_org.billing_status,
      'billing_period', 'annual',
      'payment_timing', 'upfront_before_access',
      'default_tuition_fee_gnf', COALESCE((v_org.settings->>'tuition_fee_gnf')::NUMERIC, 1500000),
      'platform_annual_base_gnf', COALESCE((v_org.settings->>'platform_annual_base_gnf')::NUMERIC, v_offer.monthly_base_gnf, 0),
      'platform_per_student_gnf', org_platform_per_student_fee(p_org_id),
      'subscription_valid_from', v_org.settings->>'platform_subscription_valid_from',
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
      'status', v_sub.status,
      'current_period_end', v_sub.current_period_end,
      'plan_name', v_plan.name,
      'monthly_price_gnf', v_plan.monthly_price_gnf
    ) ELSE NULL END
  );
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
    'annual_upfront_due_gnf', v_offer.activation_amount_gnf,
    'monthly_base_gnf', v_offer.monthly_base_gnf,
    'annual_base_gnf', v_offer.monthly_base_gnf,
    'per_enrolled_student_gnf', v_offer.per_enrolled_student_gnf,
    'declared_expected_students', v_offer.declared_expected_students,
    'ceo_notes', v_offer.ceo_notes,
    'payment_required_before_access', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION compute_school_annual_amount(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION prepare_school_renewal_billing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_school_renewal_state(UUID) TO authenticated;
