-- Le directeur ne peut payer qu'après validation CEO (statut awaiting_payment).
-- Le CEO (platform_admin) peut encore enregistrer un paiement sur draft si besoin.

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
