-- Évaluations groupées : grille de notes + pièces jointes (Excel, PDF, scans)

CREATE TABLE school_grade_evaluations (
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

CREATE INDEX idx_school_grade_evaluations_org ON school_grade_evaluations (organization_id);
CREATE INDEX idx_school_grade_evaluations_class ON school_grade_evaluations (class_id, subject_id);

CREATE TABLE school_grade_evaluation_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id   UUID NOT NULL REFERENCES school_grade_evaluations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_grade_evaluation_documents_unique UNIQUE (evaluation_id, document_id)
);

CREATE INDEX idx_school_grade_eval_docs_eval ON school_grade_evaluation_documents (evaluation_id);

COMMENT ON TABLE school_grade_evaluations IS
  'Session de saisie : une évaluation (classe × matière × type × semestre × année).';
COMMENT ON TABLE school_grade_evaluation_documents IS
  'Copies scannées, PDF ou photos de feuilles de notes liées à une évaluation.';

-- ─── RLS ─────────────────────────────────────────────────────

ALTER TABLE school_grade_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_grade_evaluation_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_grade_evaluations_select ON school_grade_evaluations
  FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id)
    AND is_school_org()
    AND (
      is_org_admin()
      OR teacher_can_grade(class_id, subject_id)
      OR can_write_school_grades()
    )
  );

CREATE POLICY school_grade_evaluations_write ON school_grade_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id)
    AND is_school_org()
    AND (
      is_org_admin()
      OR teacher_can_grade(class_id, subject_id)
    )
  );

CREATE POLICY school_grade_evaluations_update ON school_grade_evaluations
  FOR UPDATE TO authenticated
  USING (
    belongs_to_org(organization_id)
    AND is_school_org()
    AND (is_org_admin() OR teacher_can_grade(class_id, subject_id))
  )
  WITH CHECK (
    belongs_to_org(organization_id)
    AND is_school_org()
    AND (is_org_admin() OR teacher_can_grade(class_id, subject_id))
  );

CREATE POLICY school_grade_eval_docs_select ON school_grade_evaluation_documents
  FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id)
    AND is_school_org()
    AND EXISTS (
      SELECT 1 FROM school_grade_evaluations e
      WHERE e.id = evaluation_id
        AND (
          is_org_admin()
          OR teacher_can_grade(e.class_id, e.subject_id)
          OR can_write_school_grades()
        )
    )
  );

CREATE POLICY school_grade_eval_docs_write ON school_grade_evaluation_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    belongs_to_org(organization_id)
    AND is_school_org()
    AND EXISTS (
      SELECT 1 FROM school_grade_evaluations e
      WHERE e.id = evaluation_id
        AND (is_org_admin() OR teacher_can_grade(e.class_id, e.subject_id))
    )
  );

CREATE POLICY school_grade_eval_docs_delete ON school_grade_evaluation_documents
  FOR DELETE TO authenticated
  USING (
    belongs_to_org(organization_id)
    AND is_school_org()
    AND (
      is_org_admin()
      OR EXISTS (
        SELECT 1 FROM school_grade_evaluations e
        WHERE e.id = evaluation_id
          AND teacher_can_grade(e.class_id, e.subject_id)
      )
    )
  );
