-- P2 établissement : présences structurées (emploi du temps = school_schedules existant)
-- RLS : même modèle que school_schedules (belongs_to_org, is_school_org, can_write_school_academic)

CREATE TABLE IF NOT EXISTS school_attendance_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL,
  subject_id      UUID REFERENCES school_subjects(id) ON DELETE SET NULL,
  notes           TEXT,
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'capture')),
  document_id     UUID REFERENCES documents(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS school_attendance_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES school_attendance_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  remark          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_school_attendance_sessions_org_date
  ON school_attendance_sessions(organization_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_school_attendance_records_session
  ON school_attendance_records(session_id);

CREATE INDEX IF NOT EXISTS idx_school_attendance_records_student
  ON school_attendance_records(organization_id, student_id);

ALTER TABLE school_attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_attendance_sessions_select ON school_attendance_sessions;
DROP POLICY IF EXISTS school_attendance_sessions_write ON school_attendance_sessions;
DROP POLICY IF EXISTS school_attendance_records_select ON school_attendance_records;
DROP POLICY IF EXISTS school_attendance_records_write ON school_attendance_records;

CREATE POLICY school_attendance_sessions_select ON school_attendance_sessions
  FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org());

CREATE POLICY school_attendance_sessions_write ON school_attendance_sessions
  FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

CREATE POLICY school_attendance_records_select ON school_attendance_records
  FOR SELECT TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org());

CREATE POLICY school_attendance_records_write ON school_attendance_records
  FOR ALL TO authenticated
  USING (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic())
  WITH CHECK (belongs_to_org(organization_id) AND is_school_org() AND can_write_school_academic());

COMMENT ON TABLE school_attendance_sessions IS 'Séance de présence (classe + date)';
COMMENT ON TABLE school_attendance_records IS 'Présence/absence par élève pour une séance';
