-- Barème et coefficient par session d'évaluation (classe × matière × type × période)

ALTER TABLE school_grade_evaluations
  ADD COLUMN IF NOT EXISTS max_score NUMERIC(5, 2) NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS coefficient NUMERIC(4, 2) NOT NULL DEFAULT 1;

ALTER TABLE school_grade_evaluations
  DROP CONSTRAINT IF EXISTS school_grade_evaluations_coefficient_positive;

ALTER TABLE school_grade_evaluations
  ADD CONSTRAINT school_grade_evaluations_coefficient_positive
    CHECK (coefficient > 0);

ALTER TABLE school_grade_evaluations
  DROP CONSTRAINT IF EXISTS school_grade_evaluations_max_score_positive;

ALTER TABLE school_grade_evaluations
  ADD CONSTRAINT school_grade_evaluations_max_score_positive
    CHECK (max_score > 0);

COMMENT ON COLUMN school_grade_evaluations.max_score IS
  'Barème de l''évaluation (ex. 10 primaire, 20 collège/lycée).';
COMMENT ON COLUMN school_grade_evaluations.coefficient IS
  'Poids de cette évaluation dans la moyenne de la matière.';
