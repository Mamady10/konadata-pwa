-- Bons catégorie + mouvements stock (après 100-btp-financial-tracking-ONLY.sql)

ALTER TABLE btp_delivery_notes
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN (
    'materials', 'equipment', 'consumables', 'tools', 'other'
  )),
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE btp_stock
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN (
    'materials', 'equipment', 'consumables', 'tools', 'other'
  ));

CREATE TABLE IF NOT EXISTS btp_stock_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stock_id          UUID NOT NULL REFERENCES btp_stock(id) ON DELETE CASCADE,
  movement_type     TEXT NOT NULL CHECK (movement_type IN ('in', 'out')),
  quantity          NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  site_id           UUID REFERENCES btp_sites(id) ON DELETE SET NULL,
  personnel_id      UUID REFERENCES btp_personnel(id) ON DELETE SET NULL,
  requester_name    TEXT,
  delivery_note_id  UUID REFERENCES btp_delivery_notes(id) ON DELETE SET NULL,
  notes             TEXT,
  movement_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_btp_stock_movements_stock ON btp_stock_movements (stock_id, movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_btp_stock_movements_org ON btp_stock_movements (organization_id, movement_date DESC);

ALTER TABLE btp_stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS btp_stock_movements_all ON btp_stock_movements;
CREATE POLICY btp_stock_movements_all ON btp_stock_movements FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());
