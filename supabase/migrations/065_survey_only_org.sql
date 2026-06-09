-- ============================================================
-- Organisation « sondage uniquement » — sans abonnement plateforme
-- ============================================================

CREATE OR REPLACE FUNCTION create_survey_only_organization_with_owner(
  p_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_declared_city TEXT DEFAULT NULL,
  p_contact_name TEXT DEFAULT NULL,
  p_contact_title TEXT DEFAULT NULL,
  p_application_profile JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_profile JSONB := COALESCE(p_application_profile, '{}'::jsonb) || jsonb_build_object(
    'intent', 'survey_only',
    'organization_summary', COALESCE(p_application_profile->>'organization_summary', 'Inscription sondage uniquement')
  );
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentification requise'; END IF;
  IF get_user_organization_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Vous êtes déjà rattaché à une organisation';
  END IF;
  IF trim(COALESCE(p_name, '')) = '' THEN RAISE EXCEPTION 'Le nom de l''organisation est requis'; END IF;

  INSERT INTO organizations (name, type, email, phone, billing_status, settings)
  VALUES (
    trim(p_name),
    'ngo',
    p_email,
    p_phone,
    'active',
    jsonb_build_object(
      'onboarding', jsonb_build_object(
        'intent', 'survey_only',
        'declared_city', p_declared_city,
        'contact_name', p_contact_name,
        'contact_title', p_contact_title,
        'application_profile', v_profile,
        'submitted_at', now()
      ),
      'platform_billing_mode', 'survey_only',
      'ngo_surveys', jsonb_build_object(
        'enabled', true,
        'require_survey_payment', true,
        'max_active_surveys', 5
      )
    )
  )
  RETURNING id INTO v_org_id;

  INSERT INTO organization_billing_offers (
    organization_id, status, billing_period,
    activation_amount_gnf, monthly_base_gnf,
    declared_city, declared_phone, application_profile, ceo_notes
  ) VALUES (
    v_org_id,
    'paid',
    'monthly',
    0,
    0,
    p_declared_city,
    p_phone,
    v_profile,
    'Compte sondage uniquement — pas d''abonnement plateforme. Facturation par campagne.'
  );

  UPDATE profiles SET organization_id = v_org_id, role = 'org_admin' WHERE id = v_user_id;
  RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION organization_is_survey_only(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT settings->'onboarding'->>'intent' = 'survey_only'
     FROM organizations WHERE id = p_org_id),
    false
  );
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

  IF organization_is_survey_only(p_org_id) THEN
    RETURN true;
  END IF;

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

GRANT EXECUTE ON FUNCTION create_survey_only_organization_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION organization_is_survey_only(UUID) TO authenticated;
