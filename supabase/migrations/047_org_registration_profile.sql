-- Dossier d'inscription organisation (CEO) + création org enrichie

ALTER TABLE organization_billing_offers
  ADD COLUMN IF NOT EXISTS application_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN organization_billing_offers.application_profile IS
  'Informations saisies à l''inscription (analyse CEO avant tarification)';

CREATE OR REPLACE FUNCTION create_organization_with_owner(
  p_name TEXT,
  p_type organization_type,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_declared_expected_students INTEGER DEFAULT NULL,
  p_declared_city TEXT DEFAULT NULL,
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
  v_plan platform_billing_plans%ROWTYPE;
  v_base NUMERIC := 0;
  v_per_student NUMERIC := 0;
  v_upfront NUMERIC := 0;
  v_period platform_billing_period := 'monthly';
  v_profile JSONB := COALESCE(p_application_profile, '{}'::jsonb);
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
        'application_profile', v_profile,
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
    application_profile, ceo_notes
  ) VALUES (
    v_org_id, 'draft', v_plan.id, v_period,
    v_upfront, v_base, v_per_student,
    p_declared_expected_students, p_declared_city, p_phone,
    v_profile,
    CASE WHEN p_type = 'school'
      THEN 'Dossier reçu — tarif annuel à valider par KonaData avant paiement.'
      ELSE 'Dossier reçu — tarif d''activation à valider par KonaData.' END
  );

  UPDATE profiles SET organization_id = v_org_id, role = 'org_admin' WHERE id = v_user_id;
  RETURN v_org_id;
END;
$$;
