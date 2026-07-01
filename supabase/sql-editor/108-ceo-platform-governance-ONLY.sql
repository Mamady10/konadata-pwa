-- CEO: métriques usage, finances, renommage org, CGU, paiements

-- ─── CGU (conditions générales) ─────────────────────────────────

CREATE OR REPLACE FUNCTION accept_organization_cgu(p_version TEXT DEFAULT '2026-06-01')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_version TEXT := COALESCE(NULLIF(trim(p_version), ''), '2026-06-01');
BEGIN
  v_org_id := get_user_organization_id();
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Aucune organisation');
  END IF;
  IF NOT (is_org_admin() OR is_platform_admin()) THEN
    RETURN jsonb_build_object('error', 'Réservé au directeur ou à la direction');
  END IF;
  IF NOT belongs_to_org(v_org_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  UPDATE organizations SET
    settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
      'cgu_version', v_version,
      'cgu_accepted_at', now(),
      'cgu_accepted_by', auth.uid()
    )
  WHERE id = v_org_id;

  RETURN jsonb_build_object('success', true, 'cgu_version', v_version);
END;
$$;

CREATE OR REPLACE FUNCTION organization_cgu_accepted(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (settings->>'cgu_version') IS NOT NULL AND (settings->>'cgu_accepted_at') IS NOT NULL
     FROM organizations WHERE id = p_org_id),
    false
  );
$$;

-- ─── Confidentialité : inclure CGU ──────────────────────────────

CREATE OR REPLACE FUNCTION get_organization_privacy_settings(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
BEGIN
  IF NOT belongs_to_org(p_org_id) AND NOT is_platform_admin() THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  SELECT COALESCE(settings, '{}'::jsonb) INTO v_settings
  FROM organizations WHERE id = p_org_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Organisation introuvable');
  END IF;

  RETURN jsonb_build_object(
    'kona_ai_disabled', COALESCE((v_settings->>'kona_ai_disabled')::BOOLEAN, false),
    'dpa_version', v_settings->>'dpa_version',
    'dpa_accepted_at', v_settings->>'dpa_accepted_at',
    'dpa_accepted_by', v_settings->>'dpa_accepted_by',
    'current_dpa_version', '2026-06-01',
    'cgu_version', v_settings->>'cgu_version',
    'cgu_accepted_at', v_settings->>'cgu_accepted_at',
    'cgu_accepted_by', v_settings->>'cgu_accepted_by',
    'current_cgu_version', '2026-06-01'
  );
END;
$$;

-- ─── Renommage organisation ─────────────────────────────────────

CREATE OR REPLACE FUNCTION org_admin_update_organization_name(p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_name TEXT := trim(p_name);
  v_type organization_type;
BEGIN
  v_org_id := get_user_organization_id();
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Aucune organisation');
  END IF;
  IF NOT is_org_admin() THEN
    RETURN jsonb_build_object('error', 'Réservé au directeur de l''organisation');
  END IF;
  IF v_name = '' THEN
    RETURN jsonb_build_object('error', 'Le nom ne peut pas être vide');
  END IF;

  SELECT type INTO v_type FROM organizations WHERE id = v_org_id;
  IF v_type = 'school' AND school_org_name_taken(v_name, v_org_id) THEN
    RETURN jsonb_build_object('error', 'Un établissement porte déjà ce nom');
  END IF;

  UPDATE organizations SET name = v_name WHERE id = v_org_id;

  RETURN jsonb_build_object('success', true, 'name', v_name);
END;
$$;

CREATE OR REPLACE FUNCTION platform_admin_update_organization_name(
  p_org_id UUID,
  p_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT := trim(p_name);
  v_type organization_type;
BEGIN
  IF NOT is_platform_admin() THEN
    RETURN jsonb_build_object('error', 'Réservé à l''admin KonaData');
  END IF;
  IF v_name = '' THEN
    RETURN jsonb_build_object('error', 'Le nom ne peut pas être vide');
  END IF;

  SELECT type INTO v_type FROM organizations WHERE id = p_org_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Organisation introuvable');
  END IF;
  IF v_type = 'school' AND school_org_name_taken(v_name, p_org_id) THEN
    RETURN jsonb_build_object('error', 'Un établissement porte déjà ce nom');
  END IF;

  UPDATE organizations SET name = v_name WHERE id = p_org_id;

  RETURN jsonb_build_object('success', true, 'name', v_name);
END;
$$;

-- ─── Usage par organisation (CEO) ───────────────────────────────

CREATE OR REPLACE FUNCTION get_organizations_usage_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administrateur plateforme';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.org_name)
    FROM (
      SELECT
        o.id AS org_id,
        o.name AS org_name,
        o.type::text AS org_type,
        o.billing_status::text AS billing_status,
        (SELECT COUNT(*)::int FROM profiles p WHERE p.organization_id = o.id AND p.is_active = true) AS user_count,
        (SELECT COUNT(*)::int FROM school_students s WHERE s.organization_id = o.id) AS student_count,
        (SELECT COUNT(*)::int FROM ngo_projects np WHERE np.organization_id = o.id) AS project_count,
        (SELECT COUNT(*)::int FROM btp_sites bs WHERE bs.organization_id = o.id) AS site_count,
        (
          SELECT COALESCE(SUM(amount_gnf), 0)
          FROM platform_billing_payments bp
          WHERE bp.organization_id = o.id
        ) AS platform_payments_gnf,
        (
          SELECT COALESCE(SUM(amount_gnf), 0)
          FROM ngo_survey_charges nsc
          WHERE nsc.organization_id = o.id AND nsc.status = 'paid'
        ) AS survey_payments_gnf,
        organization_cgu_accepted(o.id) AS cgu_accepted,
        ((o.settings->>'dpa_accepted_at') IS NOT NULL) AS dpa_accepted
      FROM organizations o
      WHERE o.is_active = true
    ) t
  ), '[]'::jsonb);
END;
$$;

-- ─── Finances plateforme (CEO) ──────────────────────────────────

CREATE OR REPLACE FUNCTION get_platform_billing_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_platform NUMERIC;
  v_surveys NUMERIC;
  v_count INT;
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administrateur plateforme';
  END IF;

  SELECT COALESCE(SUM(amount_gnf), 0), COUNT(*)::int
  INTO v_platform, v_count
  FROM platform_billing_payments;

  SELECT COALESCE(SUM(amount_gnf), 0) INTO v_surveys
  FROM ngo_survey_charges
  WHERE status = 'paid';

  RETURN jsonb_build_object(
    'platform_payments_gnf', v_platform,
    'survey_payments_gnf', v_surveys,
    'total_revenue_gnf', v_platform + v_surveys,
    'payment_count', v_count,
    'by_month', (
      SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.month DESC), '[]'::jsonb)
      FROM (
        SELECT
          to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month,
          SUM(amount_gnf)::numeric AS amount_gnf,
          COUNT(*)::int AS count
        FROM platform_billing_payments
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 12
      ) m
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION list_platform_billing_payments(p_limit INT DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administrateur plateforme';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(r) ORDER BY r.paid_at DESC)
    FROM (
      SELECT
        bp.id,
        bp.organization_id,
        o.name AS org_name,
        bp.kind::text,
        bp.amount_gnf,
        bp.reference,
        bp.paid_at,
        bp.payment_method::text
      FROM platform_billing_payments bp
      JOIN organizations o ON o.id = bp.organization_id
      ORDER BY bp.paid_at DESC
      LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    ) r
  ), '[]'::jsonb);
END;
$$;

-- ─── Directeurs par org (CEO — récupération compte) ───────────────

CREATE OR REPLACE FUNCTION list_organization_directors_for_ceo(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_platform_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administrateur plateforme';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(d) ORDER BY d.created_at)
    FROM (
      SELECT id, full_name, email, phone, created_at
      FROM profiles
      WHERE organization_id = p_org_id
        AND role = 'org_admin'
        AND is_active = true
    ) d
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION accept_organization_cgu(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION organization_cgu_accepted(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION org_admin_update_organization_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_admin_update_organization_name(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_organizations_usage_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_billing_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION list_platform_billing_payments(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION list_organization_directors_for_ceo(UUID) TO authenticated;
