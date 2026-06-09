-- Abonnement KonaAI à l'inscription + validation CEO (crédits / requêtes)
-- Prérequis : migration 053 (organization_ai_quotas, ai_plan_tier)

ALTER TABLE organization_billing_offers
  ADD COLUMN IF NOT EXISTS ai_plan_tier TEXT
    CHECK (ai_plan_tier IS NULL OR ai_plan_tier IN ('essentiel', 'trial', 'standard', 'premium', 'platform')),
  ADD COLUMN IF NOT EXISTS ai_monthly_credits INTEGER
    CHECK (ai_monthly_credits IS NULL OR ai_monthly_credits >= 0),
  ADD COLUMN IF NOT EXISTS ai_max_requests_per_day INTEGER
    CHECK (ai_max_requests_per_day IS NULL OR ai_max_requests_per_day >= 0);

COMMENT ON COLUMN organization_billing_offers.ai_plan_tier IS
  'Palier KonaAI validé par le CEO (appliqué à l''activation / essai)';
COMMENT ON COLUMN organization_billing_offers.ai_monthly_credits IS
  'Crédits OpenAI mensuels pour l''organisation';
COMMENT ON COLUMN organization_billing_offers.ai_max_requests_per_day IS
  'Plafond anti-abus : requêtes IA par jour';

-- Applique le palier IA de l''offre vers quotas + settings (après paiement / essai)
CREATE OR REPLACE FUNCTION apply_organization_ai_plan_from_offer(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer organization_billing_offers%ROWTYPE;
  v_tier TEXT;
  v_credits INTEGER;
  v_requests INTEGER;
  v_limits platform_ai_plan_limits%ROWTYPE;
BEGIN
  SELECT * INTO v_offer FROM organization_billing_offers WHERE organization_id = p_org_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_tier := COALESCE(v_offer.ai_plan_tier, 'standard');
  IF v_tier NOT IN ('essentiel', 'trial', 'standard', 'premium', 'platform') THEN
    v_tier := 'standard';
  END IF;

  SELECT * INTO v_limits FROM platform_ai_plan_limits WHERE tier = v_tier::ai_plan_tier;

  v_credits := COALESCE(v_offer.ai_monthly_credits, v_limits.monthly_credits);
  v_requests := COALESCE(v_offer.ai_max_requests_per_day, v_limits.max_requests_per_day);

  UPDATE organizations SET
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
      'ai_plan_tier', v_tier,
      'ai_premium', (v_tier = 'premium'),
      'subscription_tier', CASE WHEN v_tier = 'premium' THEN 'premium' ELSE 'standard' END
    )
  WHERE id = p_org_id;

  INSERT INTO organization_ai_quotas (
    organization_id,
    tier_override,
    monthly_credits_override,
    max_requests_per_day_override
  )
  VALUES (
    p_org_id,
    v_tier::ai_plan_tier,
    NULLIF(v_credits, v_limits.monthly_credits),
    NULLIF(v_requests, v_limits.max_requests_per_day)
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    tier_override = EXCLUDED.tier_override,
    monthly_credits_override = EXCLUDED.monthly_credits_override,
    max_requests_per_day_override = EXCLUDED.max_requests_per_day_override,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION apply_organization_ai_plan_from_offer(UUID) TO authenticated;

-- Activation après paiement : appliquer le palier IA
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
  v_amount NUMERIC;
  v_count INTEGER;
  v_mode TEXT;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  SELECT * INTO v_offer FROM organization_billing_offers WHERE organization_id = p_org_id;

  IF v_offer.status <> 'paid' THEN
    RAISE EXCEPTION 'Offre non payée';
  END IF;

  v_mode := COALESCE(v_offer.access_mode, 'annual');

  IF v_org.type = 'school' THEN
    v_amount := v_offer.activation_amount_gnf;
    SELECT COUNT(*)::INTEGER INTO v_count
    FROM school_students WHERE organization_id = p_org_id AND enrollment_status = 'enrolled';

    IF v_mode = 'trial_30d' THEN
      v_valid_until := (CURRENT_DATE + INTERVAL '30 days')::DATE;
    ELSE
      v_valid_until := (CURRENT_DATE + INTERVAL '1 year')::DATE;
    END IF;

    UPDATE organizations SET
      billing_status = 'active',
      settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
        'platform_billing_period', CASE WHEN v_mode = 'trial_30d' THEN 'trial_30d' ELSE 'annual' END,
        'platform_access_mode', v_mode,
        'platform_annual_base_gnf', v_offer.monthly_base_gnf,
        'platform_per_student_annual_gnf', v_offer.per_enrolled_student_gnf,
        'platform_per_student_gnf', v_offer.per_enrolled_student_gnf,
        'platform_subscription_valid_from', v_valid_from,
        'platform_subscription_valid_until', v_valid_until,
        'last_annual_payment_at', CASE WHEN v_mode = 'annual' THEN now() ELSE NULL END,
        'trial_started_at', CASE WHEN v_mode = 'trial_30d' THEN now() ELSE NULL END
      )
    WHERE id = p_org_id;

    IF v_mode = 'annual' THEN
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

  PERFORM apply_organization_ai_plan_from_offer(p_org_id);
END;
$$;

-- CEO : tarif + palier IA
CREATE OR REPLACE FUNCTION platform_admin_set_billing_offer(
  p_org_id UUID,
  p_activation NUMERIC,
  p_monthly_base NUMERIC,
  p_per_student NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_access_mode TEXT DEFAULT 'annual',
  p_ai_plan_tier TEXT DEFAULT NULL,
  p_ai_monthly_credits INTEGER DEFAULT NULL,
  p_ai_max_requests_per_day INTEGER DEFAULT NULL
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
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'Réservé à l''admin KonaData'; END IF;
  IF v_mode NOT IN ('annual', 'trial_30d') THEN
    RAISE EXCEPTION 'access_mode invalide';
  END IF;

  SELECT (o.type = 'school'), CASE WHEN o.type = 'school' THEN 'annual'::platform_billing_period ELSE 'monthly'::platform_billing_period END
  INTO v_is_school, v_period FROM organizations o WHERE o.id = p_org_id;

  IF v_mode = 'trial_30d' AND NOT v_is_school THEN
    RAISE EXCEPTION 'Essai 30 jours réservé aux établissements scolaires';
  END IF;

  IF v_is_school THEN
    IF v_mode = 'trial_30d' THEN
      v_upfront := GREATEST(0, p_activation);
    ELSE
      v_upfront := GREATEST(0, p_activation);
      IF v_upfront = 0 THEN
        v_upfront := GREATEST(0, p_monthly_base) + GREATEST(0, p_per_student) * COALESCE(
          (SELECT declared_expected_students FROM organization_billing_offers WHERE organization_id = p_org_id),
          0
        );
      END IF;
    END IF;
  ELSE
    v_upfront := GREATEST(0, p_activation);
    v_mode := 'annual';
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
        WHEN v_mode = 'trial_30d' THEN E' — Essai 30 jours KonaData (accès module, puis abonnement annuel).'
        WHEN v_is_school THEN E' — Paiement annuel obligatoire avant activation/renouvellement.'
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

-- Essai 30j : palier trial IA par défaut
CREATE OR REPLACE FUNCTION platform_admin_activate_school_trial(p_org_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_trial_limits platform_ai_plan_limits%ROWTYPE;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'Réservé à l''admin KonaData'; END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id AND type = 'school';
  IF NOT FOUND THEN RAISE EXCEPTION 'Établissement introuvable'; END IF;

  SELECT * INTO v_trial_limits FROM platform_ai_plan_limits WHERE tier = 'trial';

  UPDATE organization_billing_offers SET
    access_mode = 'trial_30d',
    activation_amount_gnf = 0,
    status = 'paid',
    ai_plan_tier = COALESCE(ai_plan_tier, 'trial'),
    ai_monthly_credits = COALESCE(ai_monthly_credits, v_trial_limits.monthly_credits),
    ai_max_requests_per_day = COALESCE(ai_max_requests_per_day, v_trial_limits.max_requests_per_day),
    ceo_notes = COALESCE(p_notes, 'Essai 30 jours activé par KonaData.'),
    priced_by = auth.uid(),
    priced_at = now()
  WHERE organization_id = p_org_id;

  PERFORM activate_organization_after_offer_payment(p_org_id);

  RETURN jsonb_build_object('success', true, 'access_mode', 'trial_30d');
END;
$$;
