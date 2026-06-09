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
