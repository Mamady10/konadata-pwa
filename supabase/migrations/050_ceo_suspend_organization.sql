-- Suspension manuelle CEO (litige, etc.) — même si abonnement encore valide

CREATE OR REPLACE FUNCTION platform_admin_suspend_organization(
  p_org_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_reason TEXT := NULLIF(trim(p_reason), '');
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Réservé à l''admin KonaData';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organisation introuvable'; END IF;

  IF v_org.billing_status = 'suspended' THEN
    RETURN jsonb_build_object('success', true, 'already_suspended', true);
  END IF;

  UPDATE organizations SET
    billing_status = 'suspended',
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
      'ceo_suspend_reason', COALESCE(v_reason, 'Accès suspendu par KonaData.'),
      'ceo_suspended_at', now(),
      'ceo_suspended_by', auth.uid()::TEXT,
      'billing_status_before_suspend', v_org.billing_status::TEXT
    )
  WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'billing_status', 'suspended'
  );
END;
$$;

CREATE OR REPLACE FUNCTION platform_admin_restore_organization_access(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_prev TEXT;
  v_until DATE;
  v_new_status organization_billing_status := 'active';
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Réservé à l''admin KonaData';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organisation introuvable'; END IF;

  IF v_org.billing_status <> 'suspended' THEN
    RETURN jsonb_build_object('success', true, 'was_not_suspended', true);
  END IF;

  v_prev := v_org.settings->>'billing_status_before_suspend';

  IF v_prev IN ('pending_payment', 'pending_renewal') THEN
    v_new_status := v_prev::organization_billing_status;
  ELSIF v_org.type = 'school' THEN
    v_until := (v_org.settings->>'platform_subscription_valid_until')::DATE;
    IF v_until IS NOT NULL AND v_until < CURRENT_DATE THEN
      v_new_status := 'pending_renewal';
    ELSE
      v_new_status := 'active';
    END IF;
  ELSE
    v_new_status := COALESCE(NULLIF(v_prev, ''), 'active')::organization_billing_status;
    IF v_new_status = 'suspended' THEN v_new_status := 'active'; END IF;
  END IF;

  UPDATE organizations SET
    billing_status = v_new_status,
    settings = COALESCE(settings, '{}'::jsonb)
      - 'ceo_suspend_reason'
      - 'ceo_suspended_at'
      - 'ceo_suspended_by'
      - 'billing_status_before_suspend'
  WHERE id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'billing_status', v_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION platform_admin_suspend_organization(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_admin_restore_organization_access(UUID) TO authenticated;

-- Statut facturation : message clair en cas de suspension CEO
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

  IF v_org.billing_status = 'suspended' THEN
    RETURN jsonb_build_object(
      'model', CASE WHEN v_org.type = 'school' THEN 'annual_school_subscription' ELSE 'monthly_subscription' END,
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
