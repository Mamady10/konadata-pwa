-- ============================================================
-- KonaData v2 — Module PME (commerce / gestion)
-- ============================================================

DO $$
BEGIN
  ALTER TYPE organization_type ADD VALUE 'business';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE app_role ADD VALUE 'pme_staff';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── Référentiels ─────────────────────────────────────────────

CREATE TABLE pme_customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  balance         NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pme_suppliers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  balance         NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pme_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  sku             TEXT,
  unit            TEXT DEFAULT 'unité',
  unit_price      NUMERIC(12,2) DEFAULT 0,
  stock_quantity  NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_stock       NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Opérations ───────────────────────────────────────────────

CREATE TABLE pme_sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES pme_customers(id) ON DELETE SET NULL,
  reference       TEXT NOT NULL,
  items           JSONB NOT NULL DEFAULT '[]',
  subtotal        NUMERIC(15,2) DEFAULT 0,
  total           NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_status  payment_status DEFAULT 'pending',
  payment_method  payment_method,
  sold_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pme_purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id     UUID REFERENCES pme_suppliers(id) ON DELETE SET NULL,
  reference       TEXT NOT NULL,
  items           JSONB NOT NULL DEFAULT '[]',
  total           NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_status  payment_status DEFAULT 'pending',
  payment_method  payment_method,
  purchased_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pme_expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category        TEXT NOT NULL DEFAULT 'general',
  description     TEXT,
  amount          NUMERIC(15,2) NOT NULL,
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pme_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  txn_type        TEXT NOT NULL CHECK (txn_type IN ('income', 'expense')),
  label           TEXT NOT NULL,
  amount          NUMERIC(15,2) NOT NULL,
  reference_type  TEXT,
  reference_id    UUID,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pme_customers_org ON pme_customers(organization_id);
CREATE INDEX idx_pme_suppliers_org ON pme_suppliers(organization_id);
CREATE INDEX idx_pme_products_org ON pme_products(organization_id);
CREATE INDEX idx_pme_sales_org ON pme_sales(organization_id, sold_at DESC);
CREATE INDEX idx_pme_purchases_org ON pme_purchases(organization_id, purchased_at DESC);
CREATE INDEX idx_pme_expenses_org ON pme_expenses(organization_id, expense_date DESC);
CREATE INDEX idx_pme_transactions_org ON pme_transactions(organization_id, recorded_at DESC);

CREATE TRIGGER trg_pme_customers_updated
  BEFORE UPDATE ON pme_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pme_suppliers_updated
  BEFORE UPDATE ON pme_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pme_products_updated
  BEFORE UPDATE ON pme_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
