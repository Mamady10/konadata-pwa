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
