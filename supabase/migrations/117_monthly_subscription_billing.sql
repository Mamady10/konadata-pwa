-- Abonnement mensuel pour tous les secteurs (écoles incluses) + paiement de plusieurs mois à la fois

ALTER TABLE organization_billing_offers
  ADD COLUMN IF NOT EXISTS activation_months INTEGER NOT NULL DEFAULT 1
    CHECK (activation_months >= 1 AND activation_months <= 36);

COMMENT ON COLUMN organization_billing_offers.activation_months IS
  'Nombre de mois couverts par le montant d''activation / renouvellement via lien de paiement';

-- Montant mensuel école = forfait mensuel + (élèves inscrits × tarif / élève / mois)
CREATE OR REPLACE FUNCTION compute_school_monthly_amount(
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
  v_billing_period TEXT;
BEGIN
  SELECT COALESCE(settings->>'platform_billing_period', 'monthly')
  INTO v_billing_period
  FROM organizations WHERE id = p_org_id;

  SELECT COALESCE(
    (settings->>'platform_monthly_base_gnf')::NUMERIC,
    CASE
      WHEN v_billing_period = 'annual'
        THEN COALESCE((settings->>'platform_annual_base_gnf')::NUMERIC, 0) / 12
      ELSE COALESCE((settings->>'platform_annual_base_gnf')::NUMERIC, 0)
    END,
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

  RETURN GREATEST(0, v_base) + (v_count * GREATEST(0, v_unit));
END;
$$;

-- Rétrocompatibilité (devis annuel = 12 × mensuel)
CREATE OR REPLACE FUNCTION compute_school_annual_amount(
  p_org_id UUID,
  p_use_declared BOOLEAN DEFAULT false
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT compute_school_monthly_amount(p_org_id, p_use_declared) * 12;
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
  v_monthly NUMERIC;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_org_id AND type = 'school';
  IF NOT FOUND OR v_org.billing_status = 'pending_payment' THEN RETURN; END IF;

  v_until := (v_org.settings->>'platform_subscription_valid_until')::DATE;
  IF v_org.billing_status = 'active' AND v_until IS NOT NULL AND v_until < CURRENT_DATE THEN
    v_monthly := compute_school_monthly_amount(p_org_id, false);
    UPDATE organizations SET billing_status = 'pending_renewal' WHERE id = p_org_id;
    UPDATE organization_billing_offers SET
      activation_amount_gnf = v_monthly * GREATEST(activation_months, 1),
      status = 'awaiting_payment'
    WHERE organization_id = p_org_id AND status = 'paid';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION prepare_school_renewal_billing(
  p_org_id UUID,
  p_months INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount NUMERIC;
  v_monthly NUMERIC;
  v_months INTEGER := GREATEST(COALESCE(p_months, 1), 1);
  v_offer organization_billing_offers%ROWTYPE;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Réservé à l''admin KonaData';
  END IF;

  v_monthly := compute_school_monthly_amount(p_org_id, false);
  v_amount := v_monthly * v_months;

  UPDATE organizations SET billing_status = 'pending_renewal' WHERE id = p_org_id;

  UPDATE organization_billing_offers SET
    activation_amount_gnf = v_amount,
    activation_months = v_months,
    status = 'awaiting_payment',
    priced_by = auth.uid(),
    priced_at = now()
  WHERE organization_id = p_org_id
  RETURNING * INTO v_offer;

  RETURN jsonb_build_object(
    'organization_id', p_org_id,
    'amount_gnf', v_amount,
    'activation_months', v_months,
    'monthly_amount_gnf', v_monthly,
    'payment_token', v_offer.payment_token,
    'status', 'awaiting_payment'
  );
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
  v_valid_until DATE;
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_month INTEGER := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
  v_amount NUMERIC;
  v_count INTEGER;
  v_mode TEXT;
  v_months INTEGER;
  v_prev_until DATE;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  SELECT * INTO v_offer FROM organization_billing_offers WHERE organization_id = p_org_id;

  IF v_offer.status <> 'paid' THEN
    RAISE EXCEPTION 'Offre non payée';
  END IF;

  v_mode := COALESCE(v_offer.access_mode, 'annual');

  IF v_org.type = 'school' THEN
    v_amount := v_offer.activation_amount_gnf;
    v_months := GREATEST(COALESCE(v_offer.activation_months, 1), 1);
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM school_students WHERE organization_id = p_org_id AND enrollment_status = 'enrolled';

    IF v_mode = 'trial_30d' THEN
      v_valid_until := (CURRENT_DATE + INTERVAL '30 days')::DATE;
    ELSE
      v_prev_until := (v_org.settings->>'platform_subscription_valid_until')::DATE;
      v_valid_until := (GREATEST(COALESCE(v_prev_until, CURRENT_DATE), CURRENT_DATE)
        + (v_months || ' months')::INTERVAL)::DATE;
    END IF;

    UPDATE organizations SET
      billing_status = 'active',
      settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
        'platform_billing_period', CASE WHEN v_mode = 'trial_30d' THEN 'trial_30d' ELSE 'monthly' END,
        'platform_access_mode', v_mode,
        'platform_monthly_base_gnf', v_offer.monthly_base_gnf,
        'platform_annual_base_gnf', v_offer.monthly_base_gnf * 12,
        'platform_per_student_gnf', v_offer.per_enrolled_student_gnf,
        'platform_per_student_annual_gnf', v_offer.per_enrolled_student_gnf * 12,
        'platform_subscription_valid_from', v_valid_from,
        'platform_subscription_valid_until', v_valid_until,
        'last_monthly_payment_at', CASE WHEN v_mode <> 'trial_30d' THEN now() ELSE NULL END,
        'trial_started_at', CASE WHEN v_mode = 'trial_30d' THEN now() ELSE NULL END
      )
    WHERE id = p_org_id;

    IF v_mode <> 'trial_30d' THEN
      INSERT INTO platform_school_invoices (
        organization_id, period_year, period_month,
        amount_gnf, student_count, line_items, status, due_date, paid_at, notes
      ) VALUES (
        p_org_id, v_year, v_month, v_amount, v_count,
        jsonb_build_array(jsonb_build_object(
          'type', 'monthly_prepaid',
          'label', format('Abonnement %s mois (paiement plateforme)', v_months),
          'fee_gnf', v_amount,
          'months', v_months
        )),
        'paid', v_valid_from, now(),
        'Paiement abonnement mensuel — accès débloqué'
      )
      ON CONFLICT (organization_id, period_year, period_month)
      DO UPDATE SET
        amount_gnf = EXCLUDED.amount_gnf,
        status = 'paid',
        paid_at = now(),
        due_date = v_valid_from,
        notes = EXCLUDED.notes,
        line_items = EXCLUDED.line_items,
        updated_at = now();
    END IF;

    PERFORM apply_organization_ai_plan_from_offer(p_org_id);
    RETURN;
  END IF;

  UPDATE organizations SET
    billing_status = 'active',
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
      'platform_monthly_base_gnf', v_offer.monthly_base_gnf,
      'platform_billing_period', 'monthly'
    )
  WHERE id = p_org_id;

  v_months := GREATEST(COALESCE(v_offer.activation_months, 1), 1);

  IF v_org.type IN ('ngo', 'btp', 'business') THEN
    SELECT id INTO v_plan_id FROM platform_billing_plans
    WHERE sector = v_org.type AND is_active ORDER BY monthly_price_gnf LIMIT 1;

    IF v_plan_id IS NOT NULL THEN
      INSERT INTO organization_subscriptions (
        organization_id, plan_id, status,
        current_period_start, current_period_end
      ) VALUES (
        p_org_id, COALESCE(v_offer.sector_plan_id, v_plan_id), 'active',
        now(), now() + (v_months || ' months')::INTERVAL
      )
      ON CONFLICT (organization_id) DO UPDATE SET
        status = 'active',
        current_period_start = now(),
        current_period_end = GREATEST(organization_subscriptions.current_period_end, now())
          + (v_months || ' months')::INTERVAL,
        updated_at = now();
    END IF;
  END IF;

  PERFORM apply_organization_ai_plan_from_offer(p_org_id);
END;
$$;

CREATE OR REPLACE FUNCTION platform_admin_set_billing_offer(
  p_org_id UUID,
  p_activation NUMERIC,
  p_monthly_base NUMERIC,
  p_per_student NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_access_mode TEXT DEFAULT 'annual',
  p_ai_plan_tier TEXT DEFAULT NULL,
  p_ai_monthly_credits INTEGER DEFAULT NULL,
  p_ai_max_requests_per_day INTEGER DEFAULT NULL,
  p_activation_months INTEGER DEFAULT 1
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
  v_mode TEXT := COALESCE(NULLIF(trim(p_access_mode), ''), 'annual');
  v_ai_tier TEXT;
  v_trial_limits platform_ai_plan_limits%ROWTYPE;
  v_monthly NUMERIC;
  v_months INTEGER := GREATEST(COALESCE(p_activation_months, 1), 1);
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'Réservé à l''admin KonaData'; END IF;
  IF v_mode NOT IN ('annual', 'trial_30d') THEN
    RAISE EXCEPTION 'access_mode invalide';
  END IF;

  SELECT (o.type = 'school'), 'monthly'::platform_billing_period
  INTO v_is_school, v_period FROM organizations o WHERE o.id = p_org_id;

  IF v_mode = 'trial_30d' AND NOT v_is_school THEN
    RAISE EXCEPTION 'Essai 30 jours réservé aux établissements scolaires';
  END IF;

  IF v_is_school THEN
    IF v_mode = 'trial_30d' THEN
      v_upfront := GREATEST(0, p_activation);
      v_months := 0;
    ELSE
      v_monthly := GREATEST(0, p_monthly_base) + GREATEST(0, p_per_student) * COALESCE(
        (SELECT declared_expected_students FROM organization_billing_offers WHERE organization_id = p_org_id),
        0
      );
      v_upfront := GREATEST(0, p_activation);
      IF v_upfront = 0 THEN
        v_upfront := v_monthly * v_months;
      ELSIF v_monthly > 0 THEN
        v_months := GREATEST(1, ROUND(v_upfront / v_monthly)::INTEGER);
      END IF;
    END IF;
  ELSE
    v_upfront := GREATEST(0, p_activation);
    v_mode := 'annual';
    IF v_upfront = 0 THEN
      v_upfront := GREATEST(0, p_monthly_base) * v_months;
    END IF;
  END IF;

  IF v_mode = 'trial_30d' THEN
    SELECT * INTO v_trial_limits FROM platform_ai_plan_limits WHERE tier = 'trial';
    v_ai_tier := 'trial';
  ELSE
    v_ai_tier := COALESCE(NULLIF(trim(p_ai_plan_tier), ''), 'standard');
  END IF;

  IF v_ai_tier NOT IN ('essentiel', 'trial', 'standard', 'premium', 'platform') THEN
    v_ai_tier := 'standard';
  END IF;

  UPDATE organization_billing_offers SET
    activation_amount_gnf = v_upfront,
    activation_months = CASE WHEN v_mode = 'trial_30d' THEN 1 ELSE v_months END,
    monthly_base_gnf = GREATEST(0, p_monthly_base),
    per_enrolled_student_gnf = GREATEST(0, p_per_student),
    billing_period = v_period,
    access_mode = v_mode,
    ai_plan_tier = v_ai_tier,
    ai_monthly_credits = CASE
      WHEN v_mode = 'trial_30d' THEN COALESCE(p_ai_monthly_credits, v_trial_limits.monthly_credits)
      ELSE COALESCE(p_ai_monthly_credits, ai_monthly_credits)
    END,
    ai_max_requests_per_day = CASE
      WHEN v_mode = 'trial_30d' THEN COALESCE(p_ai_max_requests_per_day, v_trial_limits.max_requests_per_day)
      ELSE COALESCE(p_ai_max_requests_per_day, ai_max_requests_per_day)
    END,
    ceo_notes = COALESCE(p_notes, ceo_notes) ||
      CASE
        WHEN v_mode = 'trial_30d' THEN E' — Essai 30 jours KonaData (accès module, puis abonnement mensuel).'
        WHEN v_is_school THEN format(E' — Abonnement mensuel (%s mois à régler avant accès / renouvellement).', v_months)
        WHEN v_months > 1 THEN format(E' — Activation couvrant %s mois d''abonnement.', v_months)
        ELSE ''
      END,
    status = 'awaiting_payment',
    priced_by = auth.uid(),
    priced_at = now()
  WHERE organization_id = p_org_id
  RETURNING * INTO v_offer;

  IF NOT FOUND THEN RAISE EXCEPTION 'Offre introuvable'; END IF;
  RETURN v_offer;
END;
$$;

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
  v_org organizations%ROWTYPE;
  v_sub organization_subscriptions%ROWTYPE;
  v_plan platform_billing_plans%ROWTYPE;
  v_amount NUMERIC;
  v_monthly NUMERIC;
  v_new_end TIMESTAMPTZ;
  v_new_until DATE;
  v_months INTEGER := GREATEST(COALESCE(p_months, 1), 1);
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_month INTEGER := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
  v_count INTEGER;
BEGIN
  IF NOT (is_org_admin() AND belongs_to_org(p_org_id)) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organisation introuvable'; END IF;

  IF v_org.type = 'school' THEN
    IF v_org.billing_status = 'pending_payment' THEN
      RAISE EXCEPTION 'Utilisez le lien de paiement pour l''activation initiale';
    END IF;

    v_monthly := compute_school_monthly_amount(p_org_id, false);
    v_amount := COALESCE(p_amount_gnf, v_monthly * v_months);
    v_new_until := (GREATEST(
      COALESCE((v_org.settings->>'platform_subscription_valid_until')::DATE, CURRENT_DATE),
      CURRENT_DATE
    ) + (v_months || ' months')::INTERVAL)::DATE;

    SELECT COUNT(*)::INTEGER INTO v_count
    FROM school_students WHERE organization_id = p_org_id AND enrollment_status = 'enrolled';

    UPDATE organizations SET
      billing_status = 'active',
      settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
        'platform_billing_period', 'monthly',
        'platform_subscription_valid_until', v_new_until,
        'last_monthly_payment_at', now()
      )
    WHERE id = p_org_id;

    UPDATE organization_billing_offers SET status = 'paid'
    WHERE organization_id = p_org_id AND status = 'awaiting_payment';

    INSERT INTO platform_billing_payments (
      organization_id, kind, amount_gnf, reference, recorded_by
    ) VALUES (
      p_org_id, 'subscription_renewal', v_amount, p_reference, auth.uid()
    );

    INSERT INTO platform_school_invoices (
      organization_id, period_year, period_month,
      amount_gnf, student_count, line_items, status, due_date, paid_at, notes
    ) VALUES (
      p_org_id, v_year, v_month, v_amount, v_count,
      jsonb_build_array(jsonb_build_object(
        'type', 'monthly_renewal',
        'label', format('Renouvellement %s mois', v_months),
        'fee_gnf', v_amount,
        'months', v_months
      )),
      'paid', CURRENT_DATE, now(),
      'Renouvellement abonnement mensuel'
    )
    ON CONFLICT (organization_id, period_year, period_month)
    DO UPDATE SET
      amount_gnf = platform_school_invoices.amount_gnf + EXCLUDED.amount_gnf,
      paid_at = now(),
      status = 'paid',
      line_items = platform_school_invoices.line_items || EXCLUDED.line_items,
      updated_at = now();

    RETURN jsonb_build_object(
      'success', true,
      'subscription_valid_until', v_new_until,
      'amount_gnf', v_amount
    );
  END IF;

  SELECT * INTO v_sub FROM organization_subscriptions WHERE organization_id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Abonnement introuvable'; END IF;

  SELECT * INTO v_plan FROM platform_billing_plans WHERE id = v_sub.plan_id;
  v_monthly := COALESCE(v_plan.monthly_price_gnf, 0);
  v_amount := COALESCE(p_amount_gnf, v_monthly * v_months);
  v_new_end := GREATEST(v_sub.current_period_end, now()) + (v_months || ' months')::INTERVAL;

  UPDATE organization_subscriptions SET
    status = 'active',
    current_period_start = now(),
    current_period_end = v_new_end,
    trial_ends_at = NULL,
    grace_until = NULL,
    updated_at = now()
  WHERE organization_id = p_org_id;

  UPDATE organizations SET billing_status = 'active' WHERE id = p_org_id;

  INSERT INTO platform_billing_payments (
    organization_id, kind, subscription_id, amount_gnf, reference, recorded_by
  ) VALUES (
    p_org_id, 'subscription_renewal', v_sub.id, v_amount, p_reference, auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'current_period_end', v_new_end, 'amount_gnf', v_amount);
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
    'activation_months', v_offer.activation_months,
    'monthly_base_gnf', v_offer.monthly_base_gnf,
    'annual_base_gnf', CASE WHEN v_offer.billing_period = 'annual' THEN v_offer.monthly_base_gnf ELSE v_offer.monthly_base_gnf * 12 END,
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
  v_upfront_due NUMERIC;
  v_share_token BOOLEAN;
  v_monthly NUMERIC;
  v_months INTEGER;
BEGIN
  IF NOT (is_platform_admin() OR belongs_to_org(p_org_id)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  SELECT * INTO v_offer FROM organization_billing_offers WHERE organization_id = p_org_id;

  IF v_org.billing_status = 'suspended' THEN
    RETURN jsonb_build_object(
      'model', CASE WHEN v_org.type = 'school' THEN 'monthly_school_subscription' ELSE 'monthly_subscription' END,
      'access_allowed', false,
      'billing_status', 'suspended',
      'ceo_suspend_reason', v_org.settings->>'ceo_suspend_reason',
      'subscription_valid_until', v_org.settings->>'platform_subscription_valid_until',
      'offer', jsonb_build_object(
        'status', v_offer.status,
        'access_mode', COALESCE(v_offer.access_mode, 'annual')
      )
    );
  END IF;

  IF v_org.type = 'school' THEN
    PERFORM ensure_school_renewal_state(p_org_id);
    SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  END IF;

  v_access := organization_platform_access_ok(p_org_id);
  v_share_token := is_platform_admin() OR v_offer.status = 'awaiting_payment';
  v_monthly := CASE WHEN v_org.type = 'school' THEN compute_school_monthly_amount(p_org_id, false) ELSE 0 END;
  v_months := GREATEST(COALESCE(v_offer.activation_months, 1), 1);

  IF v_org.billing_status IN ('pending_payment', 'pending_renewal') THEN
    v_upfront_due := COALESCE(
      v_offer.activation_amount_gnf,
      v_monthly * v_months
    );
    RETURN jsonb_build_object(
      'model', CASE WHEN v_org.type = 'school' THEN 'monthly_school_subscription' ELSE 'monthly_subscription' END,
      'access_allowed', false,
      'billing_status', v_org.billing_status,
      'billing_period', 'monthly',
      'upfront_due_gnf', v_upfront_due,
      'monthly_price_gnf', v_monthly,
      'offer', jsonb_build_object(
        'status', v_offer.status,
        'activation_amount_gnf', v_offer.activation_amount_gnf,
        'activation_months', v_offer.activation_months,
        'monthly_base_gnf', v_offer.monthly_base_gnf,
        'per_enrolled_student_gnf', v_offer.per_enrolled_student_gnf,
        'payment_token', CASE WHEN v_share_token THEN v_offer.payment_token ELSE NULL END,
        'ceo_notes', v_offer.ceo_notes,
        'access_mode', COALESCE(v_offer.access_mode, 'annual')
      )
    );
  END IF;

  IF v_org.type = 'school' THEN
    SELECT * INTO v_invoice FROM platform_school_invoices
    WHERE organization_id = p_org_id
    ORDER BY period_year DESC, period_month DESC LIMIT 1;

    RETURN jsonb_build_object(
      'model', 'monthly_school_subscription',
      'access_allowed', v_access,
      'billing_status', v_org.billing_status,
      'billing_period', 'monthly',
      'payment_timing', 'monthly_prepaid',
      'default_tuition_fee_gnf', COALESCE((v_org.settings->>'tuition_fee_gnf')::NUMERIC, 1500000),
      'platform_monthly_base_gnf', COALESCE(
        (v_org.settings->>'platform_monthly_base_gnf')::NUMERIC,
        v_offer.monthly_base_gnf,
        0
      ),
      'platform_per_student_gnf', org_platform_per_student_fee(p_org_id),
      'monthly_price_gnf', v_monthly,
      'subscription_valid_from', v_org.settings->>'platform_subscription_valid_from',
      'subscription_valid_until', v_org.settings->>'platform_subscription_valid_until',
      'current_invoice', CASE WHEN v_invoice.id IS NOT NULL THEN to_jsonb(v_invoice) ELSE NULL END,
      'offer', jsonb_build_object(
        'access_mode', COALESCE(v_org.settings->>'platform_access_mode', v_offer.access_mode, 'annual')
      )
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

UPDATE organization_billing_offers o
SET billing_period = 'monthly'
FROM organizations org
WHERE org.id = o.organization_id AND org.type = 'school' AND o.billing_period = 'annual';

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

  IF v_offer.status IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'Offre déjà traitée';
  END IF;

  IF NOT is_platform_admin() AND v_offer.status <> 'awaiting_payment' THEN
    RAISE EXCEPTION 'Le tarif doit être validé par KonaData avant le paiement';
  END IF;

  IF is_platform_admin() AND v_offer.status NOT IN ('awaiting_payment', 'draft') THEN
    RAISE EXCEPTION 'Offre non payable';
  END IF;

  IF v_org.type = 'school' AND v_offer.access_mode <> 'trial_30d' AND v_offer.activation_amount_gnf <= 0 THEN
    RAISE EXCEPTION 'Montant mensuel non défini — le CEO doit fixer le tarif avant paiement';
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

GRANT EXECUTE ON FUNCTION compute_school_monthly_amount(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION prepare_school_renewal_billing(UUID, INTEGER) TO authenticated;
