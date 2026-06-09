-- ============================================================
-- KonaData v2 — Module BTP
-- ============================================================

CREATE TABLE btp_sites (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  location           TEXT,
  client             TEXT,
  contract_ref       TEXT,
  budget             NUMERIC(15,2),
  spent              NUMERIC(15,2) DEFAULT 0,
  currency           TEXT DEFAULT 'GNF',
  status             site_status DEFAULT 'planning',
  physical_progress  NUMERIC(5,2) DEFAULT 0,
  financial_progress NUMERIC(5,2) DEFAULT 0,
  start_date         DATE,
  end_date           DATE,
  delay_days         INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE btp_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id         UUID NOT NULL REFERENCES btp_sites(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  contractor      TEXT,
  amount          NUMERIC(15,2),
  signed_date     DATE,
  end_date        DATE,
  document_url    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE btp_personnel (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id         UUID REFERENCES btp_sites(id) ON DELETE SET NULL,
  person_id       UUID REFERENCES core_persons(id) ON DELETE SET NULL,
  role            TEXT,
  daily_rate      NUMERIC(12,2),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE btp_equipment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id         UUID REFERENCES btp_sites(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  type            TEXT,
  registration    TEXT,
  hours_used      NUMERIC(10,2) DEFAULT 0,
  status          TEXT DEFAULT 'operational',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE btp_stock (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id         UUID REFERENCES btp_sites(id) ON DELETE SET NULL,
  item_name       TEXT NOT NULL,
  unit            TEXT,
  quantity        NUMERIC(12,2) DEFAULT 0,
  min_threshold   NUMERIC(12,2) DEFAULT 0,
  alert_level     stock_alert_level DEFAULT 'normal',
  last_updated    TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE btp_delivery_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id         UUID REFERENCES btp_sites(id) ON DELETE SET NULL,
  reference       TEXT NOT NULL,
  supplier        TEXT,
  items           JSONB NOT NULL DEFAULT '[]',
  total_amount    NUMERIC(15,2),
  delivery_date   DATE,
  document_id     UUID REFERENCES documents(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE btp_fuel_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id         UUID NOT NULL REFERENCES btp_sites(id) ON DELETE CASCADE,
  equipment_id    UUID REFERENCES btp_equipment(id) ON DELETE SET NULL,
  liters          NUMERIC(10,2) NOT NULL,
  cost            NUMERIC(12,2),
  odometer        NUMERIC(10,2),
  logged_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_anomaly      BOOLEAN DEFAULT false,
  notes           TEXT,
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE btp_daily_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id         UUID NOT NULL REFERENCES btp_sites(id) ON DELETE CASCADE,
  progress_date   DATE NOT NULL,
  physical_pct    NUMERIC(5,2),
  workers_count   INTEGER,
  notes           TEXT,
  weather         TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_btp_sites_org ON btp_sites(organization_id);

CREATE TRIGGER trg_btp_sites_updated
  BEFORE UPDATE ON btp_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION update_stock_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity <= NEW.min_threshold * 0.5 THEN
    NEW.alert_level = 'critical';
  ELSIF NEW.quantity <= NEW.min_threshold THEN
    NEW.alert_level = 'warning';
  ELSE
    NEW.alert_level = 'normal';
  END IF;
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_btp_stock_alert
  BEFORE INSERT OR UPDATE ON btp_stock
  FOR EACH ROW EXECUTE FUNCTION update_stock_alert();
