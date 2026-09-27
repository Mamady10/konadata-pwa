-- ============================================================
-- KonaData — BTP : devis (lots, sections, lignes), catalogue de prix,
-- accès délégués par le directeur.
-- Idempotent : ré-exécutable sans risque.
-- ============================================================

-- ─── Accès délégués (le directeur autorise d'autres membres) ─────

-- Pas de clé étrangère vers organizations : avec profile_id dans la clé primaire,
-- l'API y verrait un 2e lien profiles <-> organizations (erreur PGRST201 à la connexion).
CREATE TABLE IF NOT EXISTS btp_quote_access (
  organization_id UUID NOT NULL,
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_btp_quote_access_profile ON btp_quote_access (profile_id);

CREATE OR REPLACE FUNCTION can_manage_btp_quotes()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_btp_org() AND (
    is_org_admin()
    OR EXISTS (
      SELECT 1 FROM btp_quote_access a
      WHERE a.profile_id = auth.uid()
        AND a.organization_id = get_user_organization_id()
    )
  )
$$;

GRANT EXECUTE ON FUNCTION can_manage_btp_quotes() TO authenticated;

ALTER TABLE btp_quote_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS btp_quote_access_select ON btp_quote_access;
CREATE POLICY btp_quote_access_select ON btp_quote_access FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND (is_org_admin() OR profile_id = auth.uid()));

DROP POLICY IF EXISTS btp_quote_access_write ON btp_quote_access;
CREATE POLICY btp_quote_access_write ON btp_quote_access FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_org_admin())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_org_admin());

-- ─── Devis ───────────────────────────────────────────────────────
-- lots : [{ id, title, kind: 'detailed'|'lump_sum', quantity, unit, lumpSumAmount,
--           lines: [{ id, section, designation, unit, quantity, unitPrice }] }]

CREATE TABLE IF NOT EXISTS btp_quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number          TEXT NOT NULL,
  version         INT NOT NULL DEFAULT 1,
  root_quote_id   UUID REFERENCES btp_quotes(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  client_name     TEXT,
  client_contact  TEXT,
  client_address  TEXT,
  location        TEXT,
  quote_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_days   INT NOT NULL DEFAULT 30 CHECK (validity_days >= 0),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'sent', 'accepted', 'refused', 'cancelled')),
  vat_enabled     BOOLEAN NOT NULL DEFAULT false,
  vat_rate        NUMERIC(5,2) NOT NULL DEFAULT 18 CHECK (vat_rate >= 0 AND vat_rate <= 100),
  notes           TEXT,
  lots            JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_ht        NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_ttc       NUMERIC(18,2) NOT NULL DEFAULT 0,
  site_id         UUID REFERENCES btp_sites(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at         TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT btp_quotes_number_version_unique UNIQUE (organization_id, number, version)
);

CREATE INDEX IF NOT EXISTS idx_btp_quotes_org ON btp_quotes (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_btp_quotes_root ON btp_quotes (root_quote_id);

ALTER TABLE btp_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS btp_quotes_select ON btp_quotes;
CREATE POLICY btp_quotes_select ON btp_quotes FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND can_manage_btp_quotes());

DROP POLICY IF EXISTS btp_quotes_insert ON btp_quotes;
CREATE POLICY btp_quotes_insert ON btp_quotes FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id) AND can_manage_btp_quotes());

DROP POLICY IF EXISTS btp_quotes_update ON btp_quotes;
CREATE POLICY btp_quotes_update ON btp_quotes FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id) AND can_manage_btp_quotes())
  WITH CHECK (belongs_to_org(organization_id) AND can_manage_btp_quotes());

DROP POLICY IF EXISTS btp_quotes_delete ON btp_quotes;
CREATE POLICY btp_quotes_delete ON btp_quotes FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_org_admin());

-- ─── Catalogue de prix (suggestions lors de la saisie) ───────────

CREATE TABLE IF NOT EXISTS btp_price_catalog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  designation     TEXT NOT NULL,
  unit            TEXT NOT NULL DEFAULT '',
  unit_price      NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  section         TEXT NOT NULL DEFAULT 'materials'
                  CHECK (section IN ('materials', 'equipment', 'labor', 'supervision')),
  updated_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_btp_price_catalog_unique
  ON btp_price_catalog (organization_id, lower(designation), lower(unit));

ALTER TABLE btp_price_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS btp_price_catalog_all ON btp_price_catalog;
CREATE POLICY btp_price_catalog_all ON btp_price_catalog FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND can_manage_btp_quotes())
  WITH CHECK (belongs_to_org(organization_id) AND can_manage_btp_quotes());
