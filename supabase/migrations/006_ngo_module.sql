-- ============================================================
-- KonaData v2 — Module ONG
-- ============================================================

CREATE TABLE ngo_programs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  budget          NUMERIC(15,2),
  currency        TEXT DEFAULT 'GNF',
  start_date      DATE,
  end_date        DATE,
  donor           TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ngo_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  program_id      UUID REFERENCES ngo_programs(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  region          TEXT,
  locality        TEXT,
  budget          NUMERIC(15,2),
  spent           NUMERIC(15,2) DEFAULT 0,
  currency        TEXT DEFAULT 'GNF',
  status          project_status DEFAULT 'planning',
  progress_pct    NUMERIC(5,2) DEFAULT 0,
  start_date      DATE,
  end_date        DATE,
  beneficiaries   INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ngo_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES ngo_projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  planned_date    DATE,
  completed_date  DATE,
  is_completed    BOOLEAN DEFAULT false,
  participants    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ngo_indicators (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES ngo_projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  target_value    NUMERIC(15,2),
  current_value   NUMERIC(15,2) DEFAULT 0,
  unit            TEXT,
  frequency       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ngo_surveys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES ngo_projects(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  questions       JSONB NOT NULL DEFAULT '[]',
  status          survey_status DEFAULT 'draft',
  region          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ngo_survey_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id       UUID NOT NULL REFERENCES ngo_surveys(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  respondent_id   TEXT,
  answers         JSONB NOT NULL DEFAULT '{}',
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),
  locality        TEXT,
  synced_at       TIMESTAMPTZ,
  is_offline      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ngo_beneficiaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id       UUID REFERENCES core_persons(id) ON DELETE SET NULL,
  project_id      UUID REFERENCES ngo_projects(id) ON DELETE SET NULL,
  region          TEXT,
  locality        TEXT,
  category        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ngo_projects_org ON ngo_projects(organization_id);
CREATE INDEX idx_ngo_beneficiaries_org ON ngo_beneficiaries(organization_id);

CREATE TRIGGER trg_ngo_projects_updated
  BEFORE UPDATE ON ngo_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
