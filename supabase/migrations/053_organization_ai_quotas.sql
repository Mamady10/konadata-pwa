-- Quotas KonaAI par organisation (crédits mensuels, vision, anti-abus journalier)

CREATE TYPE ai_plan_tier AS ENUM (
  'essentiel',
  'trial',
  'standard',
  'premium',
  'platform'
);

COMMENT ON TYPE ai_plan_tier IS
  'essentiel=0 IA ; trial=essai 30j ; standard=offre active ; premium=forfait élevé ; platform=interne KonaData';

CREATE TABLE platform_ai_plan_limits (
  tier                    ai_plan_tier PRIMARY KEY,
  label                   TEXT NOT NULL,
  monthly_credits         INTEGER NOT NULL DEFAULT 0 CHECK (monthly_credits >= 0),
  max_requests_per_day    INTEGER NOT NULL DEFAULT 0 CHECK (max_requests_per_day >= 0),
  vision_enabled          BOOLEAN NOT NULL DEFAULT false,
  max_vision_pages_month  INTEGER NOT NULL DEFAULT 0 CHECK (max_vision_pages_month >= 0),
  description             TEXT,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform_ai_plan_limits (tier, label, monthly_credits, max_requests_per_day, vision_enabled, max_vision_pages_month, description)
VALUES
  ('essentiel', 'Essentiel (sans IA)', 0, 0, false, 0,
   'Tableau de bord et saisie manuelle — pas d''appels OpenAI.'),
  ('trial', 'Essai 30 jours', 150, 30, true, 15,
   'Découverte KonaAI : chat, quelques OCR et rapports.'),
  ('standard', 'Standard', 800, 80, true, 40,
   'Usage courant : chat, rapports, scans enseignants.'),
  ('premium', 'Premium', 3000, 200, true, 150,
   'Établissements actifs : bulletins scan, rapports, Data Factory.'),
  ('platform', 'Plateforme KonaData', 50000, 1000, true, 5000,
   'Comptes internes / démo CEO — quasi illimité.')
ON CONFLICT (tier) DO UPDATE SET
  label = EXCLUDED.label,
  monthly_credits = EXCLUDED.monthly_credits,
  max_requests_per_day = EXCLUDED.max_requests_per_day,
  vision_enabled = EXCLUDED.vision_enabled,
  max_vision_pages_month = EXCLUDED.max_vision_pages_month,
  description = EXCLUDED.description,
  updated_at = now();

CREATE TABLE organization_ai_quotas (
  organization_id           UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  tier_override             ai_plan_tier,
  bonus_credits             INTEGER NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0),
  monthly_credits_override  INTEGER CHECK (monthly_credits_override IS NULL OR monthly_credits_override >= 0),
  vision_enabled_override   BOOLEAN,
  max_requests_per_day_override INTEGER CHECK (max_requests_per_day_override IS NULL OR max_requests_per_day_override >= 0),
  hard_block_at_limit       BOOLEAN NOT NULL DEFAULT true,
  ceo_notes                 TEXT,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_org_ai_quotas_updated
  BEFORE UPDATE ON organization_ai_quotas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE organization_ai_usage (
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_yyyy_mm    TEXT NOT NULL,
  credits_used      INTEGER NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  requests_count    INTEGER NOT NULL DEFAULT 0 CHECK (requests_count >= 0),
  vision_pages      INTEGER NOT NULL DEFAULT 0 CHECK (vision_pages >= 0),
  tokens_input      BIGINT NOT NULL DEFAULT 0,
  tokens_output     BIGINT NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, period_yyyy_mm)
);

CREATE TABLE organization_ai_usage_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  operation       TEXT NOT NULL,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  tokens_input    INTEGER,
  tokens_output   INTEGER,
  vision_pages    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_events_org_created ON organization_ai_usage_events (organization_id, created_at DESC);
CREATE INDEX idx_ai_usage_events_period ON organization_ai_usage_events (organization_id, created_at);

-- ─── Résolution palier effectif ───────────────────────────────

CREATE OR REPLACE FUNCTION resolve_organization_ai_tier(p_org_id UUID)
RETURNS ai_plan_tier
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier ai_plan_tier;
  v_override ai_plan_tier;
  v_billing organizations.billing_status%TYPE;
  v_access TEXT;
  v_type organization_type;
  v_settings JSONB;
BEGIN
  SELECT o.billing_status, o.type, o.settings
  INTO v_billing, v_type, v_settings
  FROM organizations o WHERE o.id = p_org_id;

  IF NOT FOUND THEN
    RETURN 'essentiel';
  END IF;

  SELECT q.tier_override INTO v_override
  FROM organization_ai_quotas q WHERE q.organization_id = p_org_id;

  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  IF (v_settings->>'ai_plan_tier') IS NOT NULL THEN
    BEGIN
      RETURN (v_settings->>'ai_plan_tier')::ai_plan_tier;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF v_billing IN ('pending_payment', 'suspended') THEN
    RETURN 'essentiel';
  END IF;

  SELECT COALESCE(obo.access_mode, v_settings->>'platform_access_mode', 'annual')
  INTO v_access
  FROM organization_billing_offers obo
  WHERE obo.organization_id = p_org_id;

  IF v_access = 'trial_30d' THEN
    RETURN 'trial';
  END IF;

  IF (v_settings->>'ai_premium')::BOOLEAN IS TRUE
     OR (v_settings->>'subscription_tier') = 'premium' THEN
    RETURN 'premium';
  END IF;

  RETURN 'standard';
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_organization_ai_tier(UUID) TO authenticated;

-- ─── Statut quota (lecture directeur) ─────────────────────────

CREATE OR REPLACE FUNCTION get_organization_ai_quota_status(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier ai_plan_tier;
  v_limits platform_ai_plan_limits%ROWTYPE;
  v_quota organization_ai_quotas%ROWTYPE;
  v_usage organization_ai_usage%ROWTYPE;
  v_period TEXT;
  v_monthly INTEGER;
  v_bonus INTEGER;
  v_daily_limit INTEGER;
  v_daily_used INTEGER;
  v_vision_enabled BOOLEAN;
  v_vision_max INTEGER;
BEGIN
  IF NOT belongs_to_org(p_org_id) AND NOT is_platform_admin() THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  v_tier := resolve_organization_ai_tier(p_org_id);
  SELECT * INTO v_limits FROM platform_ai_plan_limits WHERE tier = v_tier;
  SELECT * INTO v_quota FROM organization_ai_quotas WHERE organization_id = p_org_id;

  v_period := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  SELECT * INTO v_usage
  FROM organization_ai_usage
  WHERE organization_id = p_org_id AND period_yyyy_mm = v_period;

  v_monthly := COALESCE(v_quota.monthly_credits_override, v_limits.monthly_credits);
  v_bonus := COALESCE(v_quota.bonus_credits, 0);
  v_daily_limit := COALESCE(v_quota.max_requests_per_day_override, v_limits.max_requests_per_day);
  v_vision_enabled := COALESCE(v_quota.vision_enabled_override, v_limits.vision_enabled);
  v_vision_max := v_limits.max_vision_pages_month;

  SELECT COUNT(*)::INTEGER INTO v_daily_used
  FROM organization_ai_usage_events e
  WHERE e.organization_id = p_org_id
    AND e.created_at >= date_trunc('day', now());

  RETURN jsonb_build_object(
    'tier', v_tier::TEXT,
    'tier_label', v_limits.label,
    'period', v_period,
    'monthly_credits', v_monthly,
    'bonus_credits', v_bonus,
    'credits_total', v_monthly + v_bonus,
    'credits_used', COALESCE(v_usage.credits_used, 0),
    'credits_remaining', GREATEST(0, v_monthly + v_bonus - COALESCE(v_usage.credits_used, 0)),
    'requests_today', v_daily_used,
    'max_requests_per_day', v_daily_limit,
    'vision_enabled', v_vision_enabled,
    'vision_pages_used', COALESCE(v_usage.vision_pages, 0),
    'vision_pages_limit', v_vision_max,
    'hard_block', COALESCE(v_quota.hard_block_at_limit, true),
    'description', v_limits.description
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_organization_ai_quota_status(UUID) TO authenticated;

-- ─── Consommation atomique ────────────────────────────────────

CREATE OR REPLACE FUNCTION consume_organization_ai_credits(
  p_org_id UUID,
  p_operation TEXT,
  p_credits INTEGER,
  p_profile_id UUID DEFAULT NULL,
  p_tokens_in INTEGER DEFAULT 0,
  p_tokens_out INTEGER DEFAULT 0,
  p_vision_pages INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status JSONB;
  v_tier ai_plan_tier;
  v_limits platform_ai_plan_limits%ROWTYPE;
  v_quota organization_ai_quotas%ROWTYPE;
  v_period TEXT;
  v_monthly INTEGER;
  v_bonus INTEGER;
  v_used INTEGER;
  v_daily_limit INTEGER;
  v_daily_used INTEGER;
  v_vision_enabled BOOLEAN;
  v_vision_used INTEGER;
  v_vision_max INTEGER;
  v_hard_block BOOLEAN;
BEGIN
  IF p_credits < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Crédits invalides');
  END IF;

  IF NOT belongs_to_org(p_org_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Organisation invalide');
  END IF;

  v_tier := resolve_organization_ai_tier(p_org_id);
  SELECT * INTO v_limits FROM platform_ai_plan_limits WHERE tier = v_tier;
  SELECT * INTO v_quota FROM organization_ai_quotas WHERE organization_id = p_org_id;

  v_period := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  v_monthly := COALESCE(v_quota.monthly_credits_override, v_limits.monthly_credits);
  v_bonus := COALESCE(v_quota.bonus_credits, 0);
  v_daily_limit := COALESCE(v_quota.max_requests_per_day_override, v_limits.max_requests_per_day);
  v_vision_enabled := COALESCE(v_quota.vision_enabled_override, v_limits.vision_enabled);
  v_vision_max := v_limits.max_vision_pages_month;
  v_hard_block := COALESCE(v_quota.hard_block_at_limit, true);

  SELECT COALESCE(credits_used, 0), COALESCE(vision_pages, 0)
  INTO v_used, v_vision_used
  FROM organization_ai_usage
  WHERE organization_id = p_org_id AND period_yyyy_mm = v_period;

  v_used := COALESCE(v_used, 0);
  v_vision_used := COALESCE(v_vision_used, 0);

  SELECT COUNT(*)::INTEGER INTO v_daily_used
  FROM organization_ai_usage_events e
  WHERE e.organization_id = p_org_id
    AND e.created_at >= date_trunc('day', now());

  IF v_monthly + v_bonus = 0 AND p_credits > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Votre offre ne inclut pas KonaAI (OpenAI). Passez à Standard ou Premium.',
      'tier', v_tier::TEXT
    );
  END IF;

  IF p_vision_pages > 0 AND NOT v_vision_enabled THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'L''OCR manuscrit (Vision) n''est pas inclus dans votre offre.',
      'tier', v_tier::TEXT
    );
  END IF;

  IF v_hard_block AND v_daily_limit > 0 AND v_daily_used >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('Limite journalière atteinte (%s requêtes). Réessayez demain.', v_daily_limit),
      'tier', v_tier::TEXT
    );
  END IF;

  IF v_hard_block AND p_vision_pages > 0 AND v_vision_max > 0
     AND v_vision_used + p_vision_pages > v_vision_max THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('Quota pages Vision épuisé (%s/%s ce mois).', v_vision_used, v_vision_max),
      'tier', v_tier::TEXT
    );
  END IF;

  IF v_hard_block AND p_credits > 0 AND v_used + p_credits > v_monthly + v_bonus THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format(
        'Crédits KonaAI épuisés (%s/%s). Renouvellement le mois prochain ou contactez KonaData.',
        v_used, v_monthly + v_bonus
      ),
      'tier', v_tier::TEXT,
      'credits_used', v_used,
      'credits_total', v_monthly + v_bonus
    );
  END IF;

  INSERT INTO organization_ai_usage (
    organization_id, period_yyyy_mm, credits_used, requests_count, vision_pages, tokens_input, tokens_output
  )
  VALUES (
    p_org_id, v_period, p_credits, 1, p_vision_pages, p_tokens_in, p_tokens_out
  )
  ON CONFLICT (organization_id, period_yyyy_mm) DO UPDATE SET
    credits_used = organization_ai_usage.credits_used + EXCLUDED.credits_used,
    requests_count = organization_ai_usage.requests_count + 1,
    vision_pages = organization_ai_usage.vision_pages + EXCLUDED.vision_pages,
    tokens_input = organization_ai_usage.tokens_input + EXCLUDED.tokens_input,
    tokens_output = organization_ai_usage.tokens_output + EXCLUDED.tokens_output,
    updated_at = now();

  INSERT INTO organization_ai_usage_events (
    organization_id, profile_id, operation, credits_charged, tokens_input, tokens_output, vision_pages
  )
  VALUES (
    p_org_id, p_profile_id, p_operation, p_credits, p_tokens_in, p_tokens_out, p_vision_pages
  );

  RETURN jsonb_build_object(
    'ok', true,
    'credits_charged', p_credits,
    'credits_used', v_used + p_credits,
    'credits_total', v_monthly + v_bonus,
    'tier', v_tier::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION consume_organization_ai_credits(UUID, TEXT, INTEGER, UUID, INTEGER, INTEGER, INTEGER) TO authenticated;

-- RLS
ALTER TABLE organization_ai_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_ai_quotas_select ON organization_ai_quotas FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) OR is_platform_admin());

CREATE POLICY org_ai_quotas_ceo ON organization_ai_quotas FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY org_ai_usage_select ON organization_ai_usage FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) OR is_platform_admin());

CREATE POLICY org_ai_events_select ON organization_ai_usage_events FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) OR is_platform_admin());
