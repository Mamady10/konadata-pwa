-- Copie de supabase/migrations/052_school_grade_evaluations.sql pour SQL Editor

-- Évaluations groupées : grille de notes + pièces jointes (Excel, PDF, scans)

CREATE TABLE IF NOT EXISTS school_grade_evaluations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES school_classes(id) ON DELETE CASCADE,
  subject_id      UUID NOT NULL REFERENCES school_subjects(id) ON DELETE CASCADE,
  exam_type       TEXT NOT NULL,
  semester        TEXT NOT NULL DEFAULT 'S1',
  academic_year   TEXT NOT NULL,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_grade_evaluations_unique
    UNIQUE (organization_id, class_id, subject_id, exam_type, semester, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_school_grade_evaluations_org ON school_grade_evaluations (organization_id);
CREATE INDEX IF NOT EXISTS idx_school_grade_evaluations_class ON school_grade_evaluations (class_id, subject_id);

CREATE TABLE IF NOT EXISTS school_grade_evaluation_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id   UUID NOT NULL REFERENCES school_grade_evaluations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_grade_evaluation_documents_unique UNIQUE (evaluation_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_school_grade_eval_docs_eval ON school_grade_evaluation_documents (evaluation_id);

ALTER TABLE school_grade_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_grade_evaluation_documents ENABLE ROW LEVEL SECURITY;

-- Puis exécuter les policies du fichier migrations/052 si besoin (ou migration complète via CLI).
