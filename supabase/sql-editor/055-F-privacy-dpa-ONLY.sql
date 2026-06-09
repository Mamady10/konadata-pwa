-- Copie de supabase/migrations/055_organization_privacy_dpa.sql pour SQL Editor

-- Confidentialité org : désactivation KonaAI + acceptation DPA

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
    'current_dpa_version', '2026-06-01'
  );
END;
$$;

CREATE OR REPLACE FUNCTION set_organization_kona_ai_disabled(p_disabled BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
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
      'kona_ai_disabled', COALESCE(p_disabled, false),
      'kona_ai_disabled_at', CASE WHEN COALESCE(p_disabled, false) THEN now()::TEXT ELSE NULL END,
      'kona_ai_disabled_by', CASE WHEN COALESCE(p_disabled, false) THEN auth.uid()::TEXT ELSE NULL END
    )
  WHERE id = v_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'kona_ai_disabled', COALESCE(p_disabled, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION accept_organization_dpa(p_version TEXT DEFAULT '2026-06-01')
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
      'dpa_version', v_version,
      'dpa_accepted_at', now(),
      'dpa_accepted_by', auth.uid()
    )
  WHERE id = v_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'dpa_version', v_version,
    'dpa_accepted_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_organization_privacy_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_organization_kona_ai_disabled(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_organization_dpa(TEXT) TO authenticated;
