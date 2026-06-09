-- ============================================================
-- KonaData v2 — SCHÉMA COMPLET
-- Projet Supabase : wrwhoqtxttthmqfocmab
--
-- INSTRUCTIONS SQL EDITOR :
-- 1. Si une exécution précédente a échoué, lancez d'abord full_schema_reset.sql
-- 2. Copiez TOUT ce fichier (Ctrl+A) et cliquez Run
-- 3. Les CREATE TABLE affichent "Success. No rows returned" — c'est NORMAL
-- 4. En bas du script, des SELECT affichent les tables créées
-- ============================================================

-- >>> FILE: 001_extensions_and_types.sql
-- ============================================================
-- KonaData v2 — Extensions & types
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Organisation (tenant) ───────────────────────────────────

CREATE TYPE organization_type AS ENUM ('school', 'ngo', 'btp');

-- ─── RBAC (rôles applicatifs) ────────────────────────────────

CREATE TYPE app_role AS ENUM (
  'platform_admin',   -- Admin plateforme KonaData
  'org_admin',        -- Directeur / responsable organisation
  'deputy_director',  -- Directeur adjoint
  'registrar',        -- Responsable scolarité
  'teacher',          -- Enseignant
  'student',          -- Élève inscrit
  'candidate',        -- Candidat (pré-inscription)
  'accountant',       -- Comptable
  'ngo_staff',        -- Staff ONG
  'btp_staff'         -- Staff BTP
);

-- ─── Types partagés (noyau commun) ───────────────────────────

CREATE TYPE person_kind AS ENUM (
  'teacher', 'student', 'candidate', 'beneficiary', 'worker', 'contact'
);

CREATE TYPE document_status AS ENUM (
  'uploading', 'processing', 'classified', 'archived', 'error'
);

CREATE TYPE document_category AS ENUM (
  'school_report', 'invoice', 'delivery_note', 'cv', 'questionnaire',
  'ngo_report', 'expense_report', 'fuel_report', 'other'
);

CREATE TYPE audit_action AS ENUM (
  'create', 'update', 'delete', 'login', 'logout', 'export', 'import', 'ai_query'
);

CREATE TYPE payment_status AS ENUM (
  'pending', 'partial', 'paid', 'overdue', 'cancelled'
);

CREATE TYPE payment_method AS ENUM (
  'orange_money', 'mtn_momo', 'bank_transfer', 'cash', 'other'
);

CREATE TYPE konascore_level AS ENUM (
  'excellent', 'good', 'average', 'risky'
);

-- ─── Types module École ──────────────────────────────────────

CREATE TYPE enrollment_status AS ENUM (
  'pending', 'admitted', 'rejected', 'enrolled', 'graduated', 'withdrawn'
);

-- ─── Types module ONG ────────────────────────────────────────

CREATE TYPE project_status AS ENUM (
  'planning', 'active', 'paused', 'completed', 'cancelled'
);

CREATE TYPE survey_status AS ENUM (
  'draft', 'active', 'closed', 'archived'
);

-- ─── Types module BTP ──────────────────────────────────────────

CREATE TYPE site_status AS ENUM (
  'planning', 'active', 'suspended', 'completed'
);

CREATE TYPE stock_alert_level AS ENUM (
  'normal', 'warning', 'critical'
);



-- >>> FILE: 002_core_platform.sql
-- ============================================================
-- KonaData v2 — Noyau plateforme (multi-tenant)
-- ============================================================

-- ─── ORGANIZATIONS (tenant racine) ───────────────────────────

CREATE TABLE organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  type       organization_type NOT NULL,
  email      TEXT,
  phone      TEXT,
  address    TEXT,
  logo_url   TEXT,
  settings   JSONB NOT NULL DEFAULT '{}',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX idx_organizations_type ON organizations(type);
CREATE INDEX idx_organizations_active ON organizations(is_active);

COMMENT ON TABLE organizations IS 'Tenant racine — chaque client (école, ONG, BTP) est une organisation isolée.';

-- ─── PROFILES (1:1 avec auth.users) ───────────────────────────

CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  full_name       TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  role            app_role NOT NULL DEFAULT 'candidate',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  avatar_url      TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_email_not_empty CHECK (char_length(trim(email)) > 0)
);

CREATE INDEX idx_profiles_organization ON profiles(organization_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE UNIQUE INDEX idx_profiles_email ON profiles(lower(email));

COMMENT ON TABLE profiles IS 'Extension métier de auth.users — RBAC et rattachement organisation.';

-- ─── Triggers updated_at ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Création automatique du profil à l''inscription Auth ─────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    'candidate'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Contrainte : organization_id obligatoire sauf plateforme ─

CREATE OR REPLACE FUNCTION enforce_profile_org_for_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role NOT IN ('platform_admin', 'candidate') AND NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id requis pour le rôle %', NEW.role;
  END IF;
  IF NEW.role = 'platform_admin' AND NEW.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'platform_admin ne doit pas être rattaché à une organisation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_enforce_org
  BEFORE INSERT OR UPDATE OF role, organization_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_profile_org_for_role();

-- ─── Audit & notifications (noyau) ─────────────────────────────

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action          audit_action NOT NULL,
  resource_type   TEXT,
  resource_id     UUID,
  details         JSONB NOT NULL DEFAULT '{}',
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'info',
  is_read         BOOLEAN NOT NULL DEFAULT false,
  link            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);



-- >>> FILE: 003_rls_helpers.sql
-- ============================================================
-- KonaData v2 — Fonctions RLS & RBAC (SECURITY DEFINER)
-- ============================================================

-- Identité courante
CREATE OR REPLACE FUNCTION auth_uid()
RETURNS UUID
LANGUAGE sql STABLE
AS $$ SELECT auth.uid() $$;

CREATE OR REPLACE FUNCTION is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$ SELECT auth.uid() IS NOT NULL $$;

-- Contexte utilisateur (depuis profiles)
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_user_org_type()
RETURNS organization_type
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.type
  FROM profiles p
  JOIN organizations o ON o.id = p.organization_id
  WHERE p.id = auth.uid()
$$;

-- ─── Contrôles rôle ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'platform_admin' AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION has_role(VARIADIC p_roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = ANY(p_roles) AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director')
$$;

CREATE OR REPLACE FUNCTION can_manage_users()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director', 'registrar')
$$;

CREATE OR REPLACE FUNCTION can_manage_finance()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'accountant')
$$;

-- ─── Accès organisation (multi-tenant) ─────────────────────────

CREATE OR REPLACE FUNCTION belongs_to_org(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    is_platform_admin()
    OR (
      is_authenticated()
      AND p_org_id IS NOT NULL
      AND p_org_id = get_user_organization_id()
    )
$$;

-- Aucun accès si l'utilisateur n'a pas d'organisation (sauf platform_admin)
CREATE OR REPLACE FUNCTION has_tenant_context()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_platform_admin() OR get_user_organization_id() IS NOT NULL
$$;

-- ─── Accès par type de module ──────────────────────────────────

CREATE OR REPLACE FUNCTION is_school_org()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_org_type() = 'school' OR is_platform_admin()
$$;

CREATE OR REPLACE FUNCTION is_ngo_org()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_org_type() = 'ngo' OR is_platform_admin()
$$;

CREATE OR REPLACE FUNCTION is_btp_org()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_org_type() = 'btp' OR is_platform_admin()
$$;

-- ─── Rôles module École ────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_school_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(
    'platform_admin', 'org_admin', 'deputy_director',
    'registrar', 'accountant', 'teacher'
  )
$$;

CREATE OR REPLACE FUNCTION can_write_school_academic()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(
    'platform_admin', 'org_admin', 'deputy_director',
    'registrar', 'teacher'
  )
$$;

CREATE OR REPLACE FUNCTION can_write_school_grades()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director', 'teacher')
$$;

CREATE OR REPLACE FUNCTION is_school_student_or_candidate()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('student', 'candidate')
$$;

-- ─── Rôles module ONG / BTP ─────────────────────────────────────

CREATE OR REPLACE FUNCTION is_ngo_staff_role()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director', 'ngo_staff')
$$;

CREATE OR REPLACE FUNCTION is_btp_staff_role()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role('platform_admin', 'org_admin', 'deputy_director', 'btp_staff')
$$;

-- Journal d'audit (nécessite get_user_organization_id)
CREATE OR REPLACE FUNCTION log_audit(
  p_action audit_action,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_log_id UUID;
BEGIN
  v_org_id := get_user_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Impossible d''écrire un audit sans organisation';
  END IF;
  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
  VALUES (v_org_id, auth.uid(), p_action, p_resource_type, p_resource_id, p_details)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;



-- >>> FILE: 004_shared_entities.sql
-- ============================================================
-- KonaData v2 — Entités partagées (noyau commun)
-- ============================================================

-- ─── PERSONNES (entité normalisée cross-modules) ───────────────

CREATE TABLE core_persons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  kind            person_kind NOT NULL,
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  date_of_birth   DATE,
  gender          TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT core_persons_name_not_empty CHECK (char_length(trim(full_name)) > 0)
);

CREATE INDEX idx_core_persons_org ON core_persons(organization_id);
CREATE INDEX idx_core_persons_profile ON core_persons(profile_id);
CREATE INDEX idx_core_persons_kind ON core_persons(organization_id, kind);

CREATE TRIGGER trg_core_persons_updated
  BEFORE UPDATE ON core_persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE core_persons IS
  'Registre unifié des personnes (élèves, enseignants, bénéficiaires, ouvriers). Évite la duplication inter-modules.';

-- ─── DOCUMENTS (Storage + métadonnées IA) ──────────────────────

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  file_name       TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  file_size       BIGINT,
  mime_type       TEXT,
  status          document_status NOT NULL DEFAULT 'uploading',
  category        document_category,
  ai_confidence   NUMERIC(5,2),
  extracted_data  JSONB NOT NULL DEFAULT '{}',
  tags            TEXT[] NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_extractions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_name      TEXT NOT NULL,
  field_value     TEXT,
  confidence      NUMERIC(5,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_document_extractions_org ON document_extractions(organization_id);
CREATE INDEX idx_document_extractions_doc ON document_extractions(document_id);

CREATE TRIGGER trg_documents_updated
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Propagation organization_id sur extractions
CREATE OR REPLACE FUNCTION sync_extraction_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT organization_id INTO NEW.organization_id
  FROM documents WHERE id = NEW.document_id;
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'document_id invalide';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_document_extractions_org
  BEFORE INSERT OR UPDATE OF document_id ON document_extractions
  FOR EACH ROW EXECUTE FUNCTION sync_extraction_org_id();

-- ─── Trigger générique : organization_id cohérent ──────────────

CREATE OR REPLACE FUNCTION assert_same_org_from_person()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_person_org UUID;
BEGIN
  SELECT organization_id INTO v_person_org FROM core_persons WHERE id = NEW.person_id;
  IF v_person_org IS NULL OR v_person_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'person_id doit appartenir à la même organisation';
  END IF;
  RETURN NEW;
END;
$$;



-- >>> FILE: 005_school_module.sql
-- ============================================================
-- KonaData v2 — Module Établissements scolaires
-- ============================================================

CREATE TABLE school_classes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  level           TEXT,
  academic_year   TEXT NOT NULL,
  capacity        INTEGER DEFAULT 40,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE school_subjects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  code            TEXT,
  coefficient     NUMERIC(4,2) DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE school_teachers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id       UUID NOT NULL REFERENCES core_persons(id) ON DELETE RESTRICT,
  specialty       TEXT,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE school_students (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id         UUID NOT NULL REFERENCES core_persons(id) ON DELETE RESTRICT,
  matricule         TEXT,
  class_id          UUID REFERENCES school_classes(id) ON DELETE SET NULL,
  enrollment_status enrollment_status DEFAULT 'pending',
  enrollment_date   DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, matricule)
);

CREATE TABLE school_enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id      UUID REFERENCES school_students(id) ON DELETE CASCADE,
  class_id        UUID REFERENCES school_classes(id) ON DELETE SET NULL,
  academic_year   TEXT NOT NULL,
  status          enrollment_status DEFAULT 'pending',
  applicant_name  TEXT,
  applicant_email TEXT,
  applicant_phone TEXT,
  documents       JSONB NOT NULL DEFAULT '[]',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE school_grades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES school_subjects(id) ON DELETE CASCADE,
  class_id        UUID REFERENCES school_classes(id) ON DELETE SET NULL,
  exam_type       TEXT NOT NULL,
  score           NUMERIC(5,2),
  max_score       NUMERIC(5,2) DEFAULT 20,
  semester        TEXT,
  academic_year   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE school_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  amount          NUMERIC(15,2) NOT NULL,
  currency        TEXT DEFAULT 'GNF',
  payment_method  payment_method,
  status          payment_status DEFAULT 'pending',
  reference       TEXT,
  paid_at         TIMESTAMPTZ,
  due_date        DATE,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE school_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES school_subjects(id) ON DELETE CASCADE,
  teacher_id      UUID REFERENCES school_teachers(id) ON DELETE SET NULL,
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  room            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE school_student_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id      UUID REFERENCES school_students(id) ON DELETE CASCADE,
  enrollment_id   UUID REFERENCES school_enrollments(id) ON DELETE CASCADE,
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL DEFAULT 'other',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE school_report_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  class_id        UUID REFERENCES school_classes(id) ON DELETE SET NULL,
  semester        TEXT NOT NULL,
  academic_year   TEXT NOT NULL,
  average_score   NUMERIC(5,2),
  rank            INTEGER,
  file_path       TEXT,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by    UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_school_students_org ON school_students(organization_id);
CREATE INDEX idx_school_payments_org ON school_payments(organization_id);
CREATE INDEX idx_school_grades_student ON school_grades(student_id);

CREATE TRIGGER trg_school_students_updated
  BEFORE UPDATE ON school_students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_school_teachers_same_org
  BEFORE INSERT OR UPDATE ON school_teachers
  FOR EACH ROW EXECUTE FUNCTION assert_same_org_from_person();

CREATE TRIGGER trg_school_students_same_org
  BEFORE INSERT OR UPDATE ON school_students
  FOR EACH ROW EXECUTE FUNCTION assert_same_org_from_person();

-- Helpers RLS élève
CREATE OR REPLACE FUNCTION owns_person(p_person_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM core_persons cp
    WHERE cp.id = p_person_id AND cp.profile_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION owns_school_student(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM school_students ss
    JOIN core_persons cp ON cp.id = ss.person_id
    WHERE ss.id = p_student_id AND cp.profile_id = auth.uid()
  )
$$;



-- >>> FILE: 006_ngo_module.sql
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



-- >>> FILE: 007_btp_module.sql
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



-- >>> FILE: 008_konascore.sql
-- ============================================================
-- KonaData v2 — KonaScore
-- ============================================================

CREATE TABLE konascore_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  financial_health    NUMERIC(5,2) NOT NULL DEFAULT 0,
  data_quality        NUMERIC(5,2) NOT NULL DEFAULT 0,
  activity_regularity NUMERIC(5,2) NOT NULL DEFAULT 0,
  operations_history  NUMERIC(5,2) NOT NULL DEFAULT 0,
  global_score        NUMERIC(5,2) NOT NULL DEFAULT 0,
  level               konascore_level NOT NULL DEFAULT 'average',
  details             JSONB NOT NULL DEFAULT '{}',
  calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_konascore_org ON konascore_snapshots(organization_id, calculated_at DESC);

CREATE OR REPLACE FUNCTION calculate_konascore(p_org_id UUID)
RETURNS konascore_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_financial   NUMERIC(5,2) := 75;
  v_data        NUMERIC(5,2) := 80;
  v_activity    NUMERIC(5,2) := 70;
  v_operations  NUMERIC(5,2) := 85;
  v_global      NUMERIC(5,2);
  v_level       konascore_level;
  v_org_type    organization_type;
  v_result      konascore_snapshots;
BEGIN
  SELECT type INTO v_org_type FROM organizations WHERE id = p_org_id;

  IF v_org_type = 'school' THEN
    SELECT COALESCE(
      (COUNT(*) FILTER (WHERE status = 'paid')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 75
    ) INTO v_financial FROM school_payments WHERE organization_id = p_org_id;
  ELSIF v_org_type = 'ngo' THEN
    SELECT COALESCE(100 - (SUM(spent) / NULLIF(SUM(budget), 0) * 100), 75)
    INTO v_financial FROM ngo_projects WHERE organization_id = p_org_id;
  ELSIF v_org_type = 'btp' THEN
    SELECT COALESCE(AVG(financial_progress), 75) INTO v_financial
    FROM btp_sites WHERE organization_id = p_org_id;
  END IF;

  SELECT COALESCE(
    (COUNT(*) FILTER (WHERE status = 'classified')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 80
  ) INTO v_data FROM documents WHERE organization_id = p_org_id;

  SELECT LEAST(COUNT(*) * 2, 100) INTO v_activity
  FROM audit_logs
  WHERE organization_id = p_org_id AND created_at > now() - INTERVAL '30 days';

  SELECT LEAST(COUNT(*) * 5, 100) INTO v_operations
  FROM audit_logs WHERE organization_id = p_org_id;

  v_global := (v_financial + v_data + v_activity + v_operations) / 4;
  v_level := CASE
    WHEN v_global >= 85 THEN 'excellent'::konascore_level
    WHEN v_global >= 70 THEN 'good'::konascore_level
    WHEN v_global >= 50 THEN 'average'::konascore_level
    ELSE 'risky'::konascore_level
  END;

  INSERT INTO konascore_snapshots (
    organization_id, financial_health, data_quality,
    activity_regularity, operations_history, global_score, level
  ) VALUES (
    p_org_id, v_financial, v_data, v_activity, v_operations, v_global, v_level
  ) RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;



-- >>> FILE: 009_rls_policies.sql
-- ============================================================
-- KonaData v2 — Row Level Security (toutes les tables)
-- Aucune politique pour le rôle anon = accès public bloqué
-- ============================================================

-- ─── Activer RLS ───────────────────────────────────────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ngo_beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_daily_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE konascore_snapshots ENABLE ROW LEVEL SECURITY;

-- ─── ORGANIZATIONS ─────────────────────────────────────────────

CREATE POLICY org_select ON organizations FOR SELECT TO authenticated
  USING (is_platform_admin() OR id = get_user_organization_id());

CREATE POLICY org_update ON organizations FOR UPDATE TO authenticated
  USING (is_org_admin() AND belongs_to_org(id))
  WITH CHECK (is_org_admin() AND belongs_to_org(id));

-- ─── PROFILES ────────────────────────────────────────────────────

CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR id = auth.uid()
    OR (organization_id = get_user_organization_id() AND has_tenant_context())
  );

CREATE POLICY profiles_update_self ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_manage_org ON profiles FOR ALL TO authenticated
  USING (can_manage_users() AND belongs_to_org(organization_id))
  WITH CHECK (can_manage_users() AND belongs_to_org(organization_id));

-- ─── AUDIT & NOTIFICATIONS ───────────────────────────────────────

CREATE POLICY audit_select ON audit_logs FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id));

CREATE POLICY audit_insert ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id));

CREATE POLICY notif_select ON notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND belongs_to_org(organization_id))
  );

CREATE POLICY notif_update ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notif_insert ON notifications FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id) AND is_org_admin());

-- ─── Macro : tables scopées organisation ─────────────────────────

-- core_persons
CREATE POLICY core_persons_select ON core_persons FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id));
CREATE POLICY core_persons_write ON core_persons FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id) AND (is_org_admin() OR can_manage_users()));
CREATE POLICY core_persons_update ON core_persons FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id) AND (is_org_admin() OR can_manage_users()))
  WITH CHECK (belongs_to_org(organization_id));
CREATE POLICY core_persons_delete ON core_persons FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_org_admin());

-- documents
CREATE POLICY documents_select ON documents FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id));
CREATE POLICY documents_insert ON documents FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id) AND has_tenant_context());
CREATE POLICY documents_update ON documents FOR UPDATE TO authenticated
  USING (belongs_to_org(organization_id))
  WITH CHECK (belongs_to_org(organization_id));
CREATE POLICY documents_delete ON documents FOR DELETE TO authenticated
  USING (belongs_to_org(organization_id) AND is_org_admin());

CREATE POLICY extractions_all ON document_extractions FOR ALL TO authenticated
  USING (belongs_to_org(organization_id))
  WITH CHECK (belongs_to_org(organization_id));

-- konascore
CREATE POLICY konascore_select ON konascore_snapshots FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id));
CREATE POLICY konascore_insert ON konascore_snapshots FOR INSERT TO authenticated
  WITH CHECK (belongs_to_org(organization_id) AND is_org_admin());

-- ─── ÉCOLE ───────────────────────────────────────────────────────

CREATE POLICY school_classes_select ON school_classes FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org());
CREATE POLICY school_classes_write ON school_classes FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

CREATE POLICY school_subjects_select ON school_subjects FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org());
CREATE POLICY school_subjects_write ON school_subjects FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

CREATE POLICY school_teachers_select ON school_teachers FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org());
CREATE POLICY school_teachers_write ON school_teachers FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_manage_users())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_manage_users());

CREATE POLICY school_students_select ON school_students FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (is_school_staff() OR owns_school_student(id))
  );
CREATE POLICY school_students_write ON school_students FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

CREATE POLICY school_enrollments_select ON school_enrollments FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND is_school_staff());
CREATE POLICY school_enrollments_write ON school_enrollments FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

CREATE POLICY school_grades_select ON school_grades FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (is_school_staff() OR owns_school_student(student_id))
  );
CREATE POLICY school_grades_write ON school_grades FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_grades())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_grades());

CREATE POLICY school_payments_select ON school_payments FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (can_manage_finance() OR is_school_staff() OR owns_school_student(student_id))
  );
CREATE POLICY school_payments_write ON school_payments FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_manage_finance())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_manage_finance());

CREATE POLICY school_schedules_select ON school_schedules FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org());
CREATE POLICY school_schedules_write ON school_schedules FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

CREATE POLICY school_student_docs_all ON school_student_documents FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND is_school_staff())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND is_school_staff());

CREATE POLICY school_report_cards_select ON school_report_cards FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id) AND is_school_org()
    AND (is_school_staff() OR owns_school_student(student_id))
  );
CREATE POLICY school_report_cards_write ON school_report_cards FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

-- ─── ONG ─────────────────────────────────────────────────────────

CREATE POLICY ngo_programs_all ON ngo_programs FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

CREATE POLICY ngo_projects_all ON ngo_projects FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

CREATE POLICY ngo_activities_all ON ngo_activities FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

CREATE POLICY ngo_indicators_all ON ngo_indicators FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

CREATE POLICY ngo_surveys_all ON ngo_surveys FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

CREATE POLICY ngo_survey_responses_all ON ngo_survey_responses FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

CREATE POLICY ngo_beneficiaries_all ON ngo_beneficiaries FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_ngo_org() AND is_ngo_staff_role());

-- ─── BTP ─────────────────────────────────────────────────────────

CREATE POLICY btp_sites_all ON btp_sites FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_contracts_all ON btp_contracts FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_personnel_all ON btp_personnel FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_equipment_all ON btp_equipment FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_stock_all ON btp_stock FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_delivery_notes_all ON btp_delivery_notes FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_fuel_logs_all ON btp_fuel_logs FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());

CREATE POLICY btp_daily_progress_all ON btp_daily_progress FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role())
  WITH CHECK (belongs_to_org(organization_id) AND is_btp_org() AND is_btp_staff_role());



-- >>> FILE: 010_storage_auth_seed.sql
-- ============================================================
-- KonaData v2 — Storage, Auth RPC, données démo
-- ============================================================

-- ─── Storage bucket documents ────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_documents_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = get_user_organization_id()::text
  );

CREATE POLICY storage_documents_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = get_user_organization_id()::text
  );

CREATE POLICY storage_documents_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = get_user_organization_id()::text
  );

CREATE POLICY storage_documents_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = get_user_organization_id()::text
    AND is_org_admin()
  );

CREATE POLICY storage_platform_admin ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND is_platform_admin());

-- ─── RPC : création organisation + directeur ─────────────────────

CREATE OR REPLACE FUNCTION create_organization_with_owner(
  p_name TEXT,
  p_type organization_type,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF get_user_organization_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Vous êtes déjà rattaché à une organisation';
  END IF;

  INSERT INTO organizations (name, type, email, phone)
  VALUES (trim(p_name), p_type, p_email, p_phone)
  RETURNING id INTO v_org_id;

  UPDATE profiles SET
    organization_id = v_org_id,
    role = 'org_admin'
  WHERE id = v_user_id;

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_organization_with_owner(TEXT, organization_type, TEXT, TEXT) TO authenticated;

-- ─── RPC : configuration utilisateur démo ────────────────────────

CREATE OR REPLACE FUNCTION setup_demo_user(
  p_email TEXT,
  p_org_id UUID,
  p_role app_role,
  p_full_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET
    organization_id = p_org_id,
    full_name = p_full_name,
    role = p_role
  WHERE lower(email) = lower(p_email);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil introuvable pour %', p_email;
  END IF;
END;
$$;

-- ─── Données démo (organisations) ────────────────────────────────

INSERT INTO organizations (id, name, type, email, phone, address) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Institut Supérieur de Conakry', 'school', 'contact@isc.gn', '+224 622 00 00 01', 'Conakry, Guinée'),
  ('11111111-1111-1111-1111-111111111102', 'Fondation Développement Guinée', 'ngo', 'info@fdg.gn', '+224 622 00 00 02', 'Conakry, Guinée'),
  ('11111111-1111-1111-1111-111111111103', 'Guinée BTP SA', 'btp', 'contact@guineebtp.gn', '+224 622 00 00 03', 'Conakry, Guinée')
ON CONFLICT (id) DO NOTHING;

-- Personnes + école ISC (extrait)
INSERT INTO core_persons (id, organization_id, kind, full_name, email) VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'teacher', 'Dr. Alpha Bah', 'alpha.bah@isc.gn'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'student', 'Ousmane Keita', 'ousmane@isc.gn'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 'student', 'Hawa Diallo', 'hawa@isc.gn')
ON CONFLICT (id) DO NOTHING;

INSERT INTO school_classes (organization_id, name, level, academic_year) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Licence 1 Informatique', 'L1', '2025-2026'),
  ('11111111-1111-1111-1111-111111111101', 'Licence 2 Gestion', 'L2', '2025-2026');

INSERT INTO school_subjects (organization_id, name, code, coefficient) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Programmation', 'INFO101', 3),
  ('11111111-1111-1111-1111-111111111101', 'Comptabilité', 'GEST201', 2);

INSERT INTO school_teachers (organization_id, person_id, specialty) VALUES
  ('11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222201', 'Informatique');

INSERT INTO school_students (organization_id, person_id, matricule, enrollment_status, enrollment_date) VALUES
  ('11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222202', 'ISC-2025-001', 'enrolled', '2025-09-15'),
  ('11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222203', 'ISC-2025-002', 'enrolled', '2025-09-15');

-- ─── VÉRIFICATION FINALE (affiche des résultats dans SQL Editor) ─

SELECT 'KonaData schema installé avec succès' AS message;

SELECT table_name, 'OK' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'organizations', 'profiles', 'core_persons', 'documents',
    'school_students', 'school_enrollments', 'ngo_projects', 'btp_sites'
  )
ORDER BY table_name;

SELECT COUNT(*) AS total_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

