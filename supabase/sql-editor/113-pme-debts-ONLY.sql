-- ============================================================
-- KonaData v2 — Module PME : Crédits / Dettes clients
-- À COLLER TEL QUEL dans Supabase → SQL Editor → Run.
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE) : ré-exécutable sans risque.
-- ============================================================

-- ─── Table des dettes (crédits accordés aux clients) ──────────
CREATE TABLE IF NOT EXISTS pme_debts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES pme_customers(id) ON DELETE SET NULL,
  debtor_name     TEXT NOT NULL,
  description     TEXT,
  original_amount NUMERIC(15,2) NOT NULL CHECK (original_amount >= 0),
  amount_paid     NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'partial', 'paid')),
  due_date        DATE,
  incurred_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Table des paiements reçus sur une dette ─────────────────
CREATE TABLE IF NOT EXISTS pme_debt_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  debt_id         UUID NOT NULL REFERENCES pme_debts(id) ON DELETE CASCADE,
  amount          NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  method          payment_method,
  note            TEXT,
  paid_at         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pme_debts_org ON pme_debts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pme_debts_customer ON pme_debts(customer_id);
CREATE INDEX IF NOT EXISTS idx_pme_debt_payments_debt ON pme_debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_pme_debt_payments_org ON pme_debt_payments(organization_id, paid_at DESC);

-- ─── Recalcul automatique du montant payé + statut ───────────
CREATE OR REPLACE FUNCTION pme_recompute_debt(p_debt_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid    NUMERIC(15,2);
  v_total   NUMERIC(15,2);
  v_status  TEXT;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM pme_debt_payments WHERE debt_id = p_debt_id;

  SELECT original_amount INTO v_total
    FROM pme_debts WHERE id = p_debt_id;

  IF v_total IS NULL THEN
    RETURN;
  END IF;

  IF v_paid <= 0 THEN
    v_status := 'open';
  ELSIF v_paid >= v_total THEN
    v_status := 'paid';
  ELSE
    v_status := 'partial';
  END IF;

  UPDATE pme_debts
     SET amount_paid = v_paid,
         status = v_status,
         updated_at = now()
   WHERE id = p_debt_id;
END $$;

CREATE OR REPLACE FUNCTION pme_debt_payment_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM pme_recompute_debt(OLD.debt_id);
    RETURN OLD;
  END IF;
  PERFORM pme_recompute_debt(NEW.debt_id);
  IF TG_OP = 'UPDATE' AND OLD.debt_id <> NEW.debt_id THEN
    PERFORM pme_recompute_debt(OLD.debt_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pme_debt_payment_sync ON pme_debt_payments;
CREATE TRIGGER trg_pme_debt_payment_sync
  AFTER INSERT OR UPDATE OR DELETE ON pme_debt_payments
  FOR EACH ROW EXECUTE FUNCTION pme_debt_payment_sync();

-- Resynchronise le statut si le montant initial de la dette change
CREATE OR REPLACE FUNCTION pme_debt_amount_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.original_amount IS DISTINCT FROM OLD.original_amount THEN
    PERFORM pme_recompute_debt(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_pme_debt_amount_sync ON pme_debts;
CREATE TRIGGER trg_pme_debt_amount_sync
  AFTER UPDATE ON pme_debts
  FOR EACH ROW EXECUTE FUNCTION pme_debt_amount_sync();

DROP TRIGGER IF EXISTS trg_pme_debts_updated ON pme_debts;
CREATE TRIGGER trg_pme_debts_updated
  BEFORE UPDATE ON pme_debts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE pme_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pme_debt_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pme_debts_all ON pme_debts;
CREATE POLICY pme_debts_all ON pme_debts FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role());

DROP POLICY IF EXISTS pme_debt_payments_all ON pme_debt_payments;
CREATE POLICY pme_debt_payments_all ON pme_debt_payments FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_pme_org() AND is_pme_staff_role());
