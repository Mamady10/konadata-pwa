-- Webhook paiement, essai 30 jours école, rappels renouvellement J-30 / J-7

ALTER TABLE organization_billing_offers
  ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'annual'
    CHECK (access_mode IN ('annual', 'trial_30d'));

COMMENT ON COLUMN organization_billing_offers.access_mode IS
  'annual = abonnement annuel ; trial_30d = essai 30 jours (école) avant facturation annuelle';

CREATE TABLE IF NOT EXISTS platform_billing_webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        TEXT NOT NULL DEFAULT 'orange_money',
  external_id     TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'processed',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);

CREATE TABLE IF NOT EXISTS platform_billing_renewal_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reminder_kind   TEXT NOT NULL CHECK (reminder_kind IN ('j30', 'j7')),
  valid_until     DATE NOT NULL,
  sent_to         TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reminder_kind, valid_until)
);

CREATE INDEX IF NOT EXISTS idx_renewal_reminders_org ON platform_billing_renewal_reminders(organization_id);

-- Activation après paiement (annual vs essai 30j)
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

CREATE OR REPLACE FUNCTION platform_admin_set_billing_offer(
  p_org_id UUID,
  p_activation NUMERIC,
  p_monthly_base NUMERIC,
  p_per_student NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_access_mode TEXT DEFAULT 'annual'
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

  UPDATE organization_billing_offers SET
    activation_amount_gnf = v_upfront,
    monthly_base_gnf = GREATEST(0, p_monthly_base),
    per_enrolled_student_gnf = GREATEST(0, p_per_student),
    billing_period = v_period,
    access_mode = v_mode,
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

-- Activer l'essai sans paiement (CEO uniquement)
CREATE OR REPLACE FUNCTION platform_admin_activate_school_trial(p_org_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'Réservé à l''admin KonaData'; END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id AND type = 'school';
  IF NOT FOUND THEN RAISE EXCEPTION 'Établissement introuvable'; END IF;

  UPDATE organization_billing_offers SET
    access_mode = 'trial_30d',
    activation_amount_gnf = 0,
    status = 'paid',
    ceo_notes = COALESCE(p_notes, 'Essai 30 jours activé par KonaData.'),
    priced_by = auth.uid(),
    priced_at = now()
  WHERE organization_id = p_org_id;

  PERFORM activate_organization_after_offer_payment(p_org_id);

  RETURN jsonb_build_object('success', true, 'access_mode', 'trial_30d');
END;
$$;

GRANT EXECUTE ON FUNCTION platform_admin_activate_school_trial(UUID, TEXT) TO authenticated;

-- Webhook Orange Money (service role / API)
CREATE OR REPLACE FUNCTION process_billing_payment_webhook(
  p_provider TEXT,
  p_external_id TEXT,
  p_payment_token TEXT,
  p_amount_gnf NUMERIC,
  p_status TEXT,
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
  v_existing UUID;
BEGIN
  IF trim(COALESCE(p_external_id, '')) = '' THEN
    RAISE EXCEPTION 'external_id requis';
  END IF;

  SELECT id INTO v_existing FROM platform_billing_webhook_events
  WHERE provider = COALESCE(NULLIF(trim(p_provider), ''), 'orange_money')
    AND external_id = trim(p_external_id);
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;

  IF lower(trim(COALESCE(p_status, ''))) NOT IN ('success', 'completed', 'paid', 'ok') THEN
    INSERT INTO platform_billing_webhook_events (provider, external_id, payload, status)
    VALUES (COALESCE(NULLIF(trim(p_provider), ''), 'orange_money'), trim(p_external_id),
      jsonb_build_object('status', p_status, 'token', p_payment_token), 'ignored');
    RETURN jsonb_build_object('success', false, 'reason', 'payment_not_successful');
  END IF;

  SELECT o.* INTO v_offer FROM organization_billing_offers o
  WHERE o.payment_token = trim(p_payment_token);
  IF NOT FOUND THEN RAISE EXCEPTION 'Offre introuvable pour ce token'; END IF;

  SELECT * INTO v_org FROM organizations WHERE id = v_offer.organization_id;

  IF v_offer.status <> 'awaiting_payment' THEN
    RAISE EXCEPTION 'Offre non payable (statut %)', v_offer.status;
  END IF;

  IF v_offer.activation_amount_gnf > 0 AND p_amount_gnf IS NOT NULL THEN
    IF abs(p_amount_gnf - v_offer.activation_amount_gnf) > GREATEST(1, v_offer.activation_amount_gnf * 0.01) THEN
      RAISE EXCEPTION 'Montant webhook (%) différent du montant validé (%)', p_amount_gnf, v_offer.activation_amount_gnf;
    END IF;
  END IF;

  UPDATE organization_billing_offers SET
    status = 'paid',
    payment_reference = COALESCE(p_reference, payment_reference),
    paid_at = now()
  WHERE organization_id = v_offer.organization_id;

  PERFORM activate_organization_after_offer_payment(v_offer.organization_id);

  INSERT INTO platform_billing_webhook_events (
    provider, external_id, organization_id, payload, status
  ) VALUES (
    COALESCE(NULLIF(trim(p_provider), ''), 'orange_money'),
    trim(p_external_id),
    v_offer.organization_id,
    jsonb_build_object(
      'payment_token', p_payment_token,
      'amount_gnf', p_amount_gnf,
      'reference', p_reference
    ),
    'processed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_offer.organization_id,
    'billing_status', 'active'
  );
END;
$$;

-- Cibles rappels email (J-30 ou J-7 avant valid_until)
CREATE OR REPLACE FUNCTION list_billing_renewal_reminder_targets(p_days_before INTEGER)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  director_email TEXT,
  director_name TEXT,
  valid_until DATE,
  reminder_kind TEXT,
  access_mode TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT := CASE WHEN p_days_before <= 7 THEN 'j7' ELSE 'j30' END;
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.name,
    p.email,
    COALESCE(p.full_name, split_part(p.email, '@', 1)),
    (o.settings->>'platform_subscription_valid_until')::DATE,
    v_kind,
    COALESCE(o.settings->>'platform_access_mode', 'annual')
  FROM organizations o
  JOIN profiles p ON p.organization_id = o.id AND p.role = 'org_admin'
  WHERE o.type = 'school'
    AND o.billing_status = 'active'
    AND (o.settings->>'platform_subscription_valid_until')::DATE = CURRENT_DATE + p_days_before
    AND NOT EXISTS (
      SELECT 1 FROM platform_billing_renewal_reminders r
      WHERE r.organization_id = o.id
        AND r.reminder_kind = v_kind
        AND r.valid_until = (o.settings->>'platform_subscription_valid_until')::DATE
    );
END;
$$;

CREATE OR REPLACE FUNCTION record_billing_renewal_reminder_sent(
  p_org_id UUID,
  p_kind TEXT,
  p_valid_until DATE,
  p_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO platform_billing_renewal_reminders (organization_id, reminder_kind, valid_until, sent_to)
  VALUES (p_org_id, p_kind, p_valid_until, p_email)
  ON CONFLICT (organization_id, reminder_kind, valid_until) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION process_billing_payment_webhook(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION list_billing_renewal_reminder_targets(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION record_billing_renewal_reminder_sent(UUID, TEXT, DATE, TEXT) TO service_role;

-- Expose access_mode dans le statut facturation (directeur)
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
  v_share_token := is_platform_admin() OR v_offer.status = 'awaiting_payment';

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
        'payment_token', CASE WHEN v_share_token THEN v_offer.payment_token ELSE NULL END,
        'ceo_notes', v_offer.ceo_notes,
        'access_mode', COALESCE(v_offer.access_mode, 'annual')
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
      'billing_period', COALESCE(v_org.settings->>'platform_billing_period', 'annual'),
      'payment_timing', 'upfront_before_access',
      'default_tuition_fee_gnf', COALESCE((v_org.settings->>'tuition_fee_gnf')::NUMERIC, 1500000),
      'platform_annual_base_gnf', COALESCE((v_org.settings->>'platform_annual_base_gnf')::NUMERIC, v_offer.monthly_base_gnf, 0),
      'platform_per_student_gnf', org_platform_per_student_fee(p_org_id),
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
