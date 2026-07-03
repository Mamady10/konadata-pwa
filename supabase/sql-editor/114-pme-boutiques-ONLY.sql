-- ============================================================
-- KonaData v2 — Module PME : Boutiques (points de vente)
-- À COLLER TEL QUEL dans Supabase → SQL Editor → Run.
-- Idempotent (IF NOT EXISTS / DROP ... IF EXISTS) : ré-exécutable.
-- ============================================================

CREATE TABLE IF NOT EXISTS pme_boutiques (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  phone           TEXT,
  manager         TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pme_boutiques_org ON pme_boutiques(organization_id);

DROP TRIGGER IF EXISTS trg_pme_boutiques_updated ON pme_boutiques;
CREATE TRIGGER trg_pme_boutiques_updated
  BEFORE UPDATE ON pme_boutiques
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE pme_sales     ADD COLUMN IF NOT EXISTS boutique_id UUID REFERENCES pme_boutiques(id) ON DELETE SET NULL;
ALTER TABLE pme_purchases ADD COLUMN IF NOT EXISTS boutique_id UUID REFERENCES pme_boutiques(id) ON DELETE SET NULL;
ALTER TABLE pme_expenses  ADD COLUMN IF NOT EXISTS boutique_id UUID REFERENCES pme_boutiques(id) ON DELETE SET NULL;
ALTER TABLE pme_products  ADD COLUMN IF NOT EXISTS boutique_id UUID REFERENCES pme_boutiques(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pme_sales_boutique ON pme_sales(boutique_id);
CREATE INDEX IF NOT EXISTS idx_pme_purchases_boutique ON pme_purchases(boutique_id);
CREATE INDEX IF NOT EXISTS idx_pme_expenses_boutique ON pme_expenses(boutique_id);
CREATE INDEX IF NOT EXISTS idx_pme_products_boutique ON pme_products(boutique_id);

ALTER TABLE pme_boutiques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pme_boutiques_all ON pme_boutiques;
CREATE POLICY pme_boutiques_all ON pme_boutiques FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role());
