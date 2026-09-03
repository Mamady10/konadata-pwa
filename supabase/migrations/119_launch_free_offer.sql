-- Offre de lancement KonaData (une seule fois par organisation)
-- - Établissements scolaires : 12 mois gratuits
-- - ONG / BTP / PME : 6 mois gratuits
-- - Fenêtre de souscription : 2 mois à compter de la création de l'organisation
-- - Après la période gratuite : abonnement payant obligatoire

DO $$
BEGIN
  ALTER TABLE organization_billing_offers DROP CONSTRAINT IF EXISTS organization_billing_offers_access_mode_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE organization_billing_offers
  ADD CONSTRAINT organization_billing_offers_access_mode_check
  CHECK (access_mode IN ('annual', 'trial_30d', 'launch_free'));

COMMENT ON COLUMN organization_billing_offers.access_mode IS
  'annual = abonnement ; trial_30d = essai 30 jours (école) ; launch_free = offre de lancement (12/6 mois, une fois)';

CREATE OR REPLACE FUNCTION launch_offer_free_months(p_org_type organization_type)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_org_type = 'school' THEN 12 ELSE 6 END;
$$;

CREATE OR REPLACE FUNCTION launch_offer_claim_deadline(p_created_at TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_created_at::DATE + INTERVAL '2 months')::DATE;
$$;

CREATE OR REPLACE FUNCTION organization_launch_offer_status(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_claimed TIMESTAMPTZ;
  v_deadline DATE;
  v_months INTEGER;
  v_eligible BOOLEAN;
  v_survey_only BOOLEAN;
BEGIN
  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Organisation introuvable');
  END IF;

  v_survey_only := organization_is_survey_only(p_org_id);
  IF v_survey_only THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'already_claimed', false,
      'reason', 'Organisation enquêtes uniquement'
    );
  END IF;

  v_claimed := NULLIF(v_org.settings->>'launch_offer_claimed_at', '')::TIMESTAMPTZ;
  v_deadline := launch_offer_claim_deadline(v_org.created_at);
  v_months := launch_offer_free_months(v_org.type);
  v_eligible :=
    v_claimed IS NULL
    AND v_org.billing_status = 'pending_payment'
    AND CURRENT_DATE <= v_deadline;

  RETURN jsonb_build_object(
    'eligible', v_eligible,
    'already_claimed', v_claimed IS NOT NULL,
    'claimed_at', v_claimed,
    'claim_deadline', v_deadline,
    'free_months', v_months,
    'free_until', v_org.settings->>'launch_offer_free_until',
    'access_mode', v_org.settings->>'platform_access_mode',
    'org_type', v_org.type,
    'one_time', true,
    'label', CASE
      WHEN v_org.type = 'school' THEN 'Offre de lancement — 12 mois gratuits (écoles)'
      ELSE 'Offre de lancement — 6 mois gratuits'
    END,
    'reason', CASE
      WHEN v_claimed IS NOT NULL THEN 'Offre déjà utilisée (une seule fois)'
      WHEN v_org.billing_status <> 'pending_payment' THEN 'Organisation déjà activée ou renouvellement en cours'
      WHEN CURRENT_DATE > v_deadline THEN 'Fenêtre de souscription expirée (2 mois après inscription)'
      ELSE NULL
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION claim_launch_free_offer(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_offer organization_billing_offers%ROWTYPE;
  v_status JSONB;
  v_months INTEGER;
  v_valid_from DATE := CURRENT_DATE;
  v_valid_until DATE;
  v_plan_id UUID;
  v_notes TEXT;
BEGIN
  IF NOT is_platform_admin() AND NOT (is_org_admin() AND belongs_to_org(p_org_id)) THEN
    RAISE EXCEPTION 'Non autorisé — réservé au directeur de l''organisation';
  END IF;

  v_status := organization_launch_offer_status(p_org_id);
  IF NOT COALESCE((v_status->>'eligible')::BOOLEAN, false) THEN
    RAISE EXCEPTION '%', COALESCE(v_status->>'reason', 'Offre de lancement non disponible');
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id FOR UPDATE;
  SELECT * INTO v_offer FROM organization_billing_offers WHERE organization_id = p_org_id;

  IF v_org.settings ? 'launch_offer_claimed_at'
     AND NULLIF(v_org.settings->>'launch_offer_claimed_at', '') IS NOT NULL THEN
    RAISE EXCEPTION 'Offre de lancement déjà utilisée (une seule fois)';
  END IF;

  v_months := launch_offer_free_months(v_org.type);
  v_valid_until := (v_valid_from + (v_months || ' months')::INTERVAL)::DATE;
  v_notes := format(
    'Offre de lancement KonaData — %s mois gratuits (souscription unique, fenêtre 2 mois). Après cette période, abonnement payant obligatoire.',
    v_months
  );

  IF v_offer.id IS NOT NULL THEN
    UPDATE organization_billing_offers SET
      status = 'paid',
      access_mode = 'launch_free',
      activation_amount_gnf = 0,
      activation_months = v_months,
      billing_period = 'monthly',
      ceo_notes = CASE
        WHEN ceo_notes IS NULL OR trim(ceo_notes) = '' THEN v_notes
        ELSE ceo_notes || E'\n' || v_notes
      END,
      payment_reference = 'LAUNCH_FREE_OFFER',
      paid_at = now(),
      paid_recorded_by = auth.uid(),
      updated_at = now()
    WHERE organization_id = p_org_id;
  END IF;

  IF v_org.type = 'school' THEN
    UPDATE organizations SET
      billing_status = 'active',
      settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
        'platform_billing_period', 'monthly',
        'platform_access_mode', 'launch_free',
        'platform_subscription_valid_from', v_valid_from,
        'platform_subscription_valid_until', v_valid_until,
        'launch_offer_claimed_at', now(),
        'launch_offer_free_until', v_valid_until,
        'launch_offer_free_months', v_months,
        'trial_started_at', NULL
      ),
      updated_at = now()
    WHERE id = p_org_id;
  ELSE
    UPDATE organizations SET
      billing_status = 'active',
      settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
        'platform_billing_period', 'monthly',
        'platform_access_mode', 'launch_free',
        'launch_offer_claimed_at', now(),
        'launch_offer_free_until', v_valid_until,
        'launch_offer_free_months', v_months
      ),
      updated_at = now()
    WHERE id = p_org_id;

    IF v_org.type IN ('ngo', 'btp', 'business') THEN
      SELECT id INTO v_plan_id FROM platform_billing_plans
      WHERE sector = v_org.type AND is_active
      ORDER BY monthly_price_gnf
      LIMIT 1;

      IF v_plan_id IS NOT NULL THEN
        INSERT INTO organization_subscriptions (
          organization_id, plan_id, status,
          current_period_start, current_period_end, trial_ends_at, metadata
        ) VALUES (
          p_org_id,
          COALESCE(v_offer.sector_plan_id, v_plan_id),
          'active',
          now(),
          (v_valid_until::TIMESTAMPTZ + INTERVAL '1 day' - INTERVAL '1 second'),
          NULL,
          jsonb_build_object(
            'launch_free', true,
            'free_months', v_months,
            'claimed_at', now()
          )
        )
        ON CONFLICT (organization_id) DO UPDATE SET
          status = 'active',
          current_period_start = now(),
          current_period_end = EXCLUDED.current_period_end,
          trial_ends_at = NULL,
          metadata = COALESCE(organization_subscriptions.metadata, '{}'::jsonb)
            || jsonb_build_object('launch_free', true, 'free_months', v_months),
          updated_at = now();
      END IF;
    END IF;
  END IF;

  INSERT INTO platform_billing_payments (
    organization_id, kind, amount_gnf, reference, recorded_by
  ) VALUES (
    p_org_id, 'subscription_renewal', 0, 'LAUNCH_FREE_OFFER', auth.uid()
  );

  BEGIN
    PERFORM apply_organization_ai_plan_from_offer(p_org_id);
  EXCEPTION
    WHEN undefined_function THEN NULL;
    WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', p_org_id,
    'billing_status', 'active',
    'access_mode', 'launch_free',
    'free_months', v_months,
    'free_until', v_valid_until,
    'one_time', true,
    'message', format(
      'Offre de lancement activée : %s mois gratuits jusqu''au %s. Après cette date, un abonnement payant sera requis.',
      v_months,
      to_char(v_valid_until, 'DD/MM/YYYY')
    )
  );
END;
$$;

-- Enrichir le statut facturation pour exposer l'offre de lancement
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
  v_launch JSONB;
BEGIN
  IF NOT (is_platform_admin() OR belongs_to_org(p_org_id)) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
  SELECT * INTO v_offer FROM organization_billing_offers WHERE organization_id = p_org_id;
  v_launch := organization_launch_offer_status(p_org_id);

  IF v_org.billing_status = 'suspended' THEN
    RETURN jsonb_build_object(
      'model', CASE WHEN v_org.type = 'school' THEN 'monthly_school_subscription' ELSE 'monthly_subscription' END,
      'access_allowed', false,
      'billing_status', 'suspended',
      'ceo_suspend_reason', v_org.settings->>'ceo_suspend_reason',
      'subscription_valid_until', v_org.settings->>'platform_subscription_valid_until',
      'launch_offer', v_launch,
      'offer', jsonb_build_object(
        'status', v_offer.status,
        'access_mode', COALESCE(v_offer.access_mode, v_org.settings->>'platform_access_mode', 'annual')
      )
    );
  END IF;

  IF v_org.type = 'school' THEN
    PERFORM ensure_school_renewal_state(p_org_id);
    SELECT * INTO v_org FROM organizations WHERE id = p_org_id;
    v_launch := organization_launch_offer_status(p_org_id);
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
      'launch_offer', v_launch,
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
      'launch_offer', v_launch,
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
    'launch_offer', v_launch,
    'subscription', CASE WHEN v_sub.id IS NOT NULL THEN jsonb_build_object(
      'status', v_sub.status,
      'current_period_end', v_sub.current_period_end,
      'plan_name', v_plan.name,
      'monthly_price_gnf', v_plan.monthly_price_gnf,
      'trial_ends_at', v_sub.trial_ends_at
    ) ELSE NULL END,
    'offer', jsonb_build_object(
      'access_mode', COALESCE(v_org.settings->>'platform_access_mode', v_offer.access_mode, 'annual')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION launch_offer_free_months(organization_type) TO authenticated;
GRANT EXECUTE ON FUNCTION launch_offer_claim_deadline(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION organization_launch_offer_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_launch_free_offer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_organization_billing_status(UUID) TO authenticated;

COMMENT ON FUNCTION claim_launch_free_offer(UUID) IS
  'Active l''offre de lancement (12 mois écoles / 6 mois autres), une seule fois, dans les 2 mois suivant l''inscription.';
