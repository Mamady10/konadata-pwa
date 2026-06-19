-- Suivi financier BTP (dépenses, pointage MO, contrats sous-traitance)
-- À exécuter dans Supabase SQL Editor après 099-btp-planning-refs-ONLY.sql

CREATE TABLE IF NOT EXISTS btp_site_expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id           UUID NOT NULL REFERENCES btp_sites(id) ON DELETE CASCADE,
  category          TEXT NOT NULL CHECK (category IN (
    'labor', 'materials', 'equipment', 'subcontract', 'overhead', 'other'
  )),
  amount            NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  expense_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  description       TEXT,
  reference         TEXT,
  supplier          TEXT,
  document_id       UUID REFERENCES documents(id) ON DELETE SET NULL,
  contract_id       UUID REFERENCES btp_contracts(id) ON DELETE SET NULL,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_btp_site_expenses_site ON btp_site_expenses (site_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_btp_site_expenses_org ON btp_site_expenses (organization_id);

CREATE TABLE IF NOT EXISTS btp_labor_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id           UUID NOT NULL REFERENCES btp_sites(id) ON DELETE CASCADE,
  personnel_id      UUID NOT NULL REFERENCES btp_personnel(id) ON DELETE CASCADE,
  work_date         DATE NOT NULL,
  days              NUMERIC(4,2) NOT NULL DEFAULT 1 CHECK (days > 0),
  daily_rate        NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT btp_labor_entries_unique UNIQUE (personnel_id, site_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_btp_labor_entries_site ON btp_labor_entries (site_id, work_date);

ALTER TABLE btp_contracts
  ADD COLUMN IF NOT EXISTS contract_type TEXT NOT NULL DEFAULT 'subcontract'
    CHECK (contract_type IN ('client', 'subcontract', 'supplier')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0;

ALTER TABLE btp_site_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_labor_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS btp_site_expenses_all ON btp_site_expenses;
CREATE POLICY btp_site_expenses_all ON btp_site_expenses FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

DROP POLICY IF EXISTS btp_labor_entries_all ON btp_labor_entries;
CREATE POLICY btp_labor_entries_all ON btp_labor_entries FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());
