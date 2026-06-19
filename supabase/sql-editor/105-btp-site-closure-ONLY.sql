-- Migration 105 — clôture chantier (SQL Editor)
ALTER TABLE btp_sites
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closure_comment TEXT,
  ADD COLUMN IF NOT EXISTS closure_report_id UUID REFERENCES organization_ai_generated_reports(id) ON DELETE SET NULL;
