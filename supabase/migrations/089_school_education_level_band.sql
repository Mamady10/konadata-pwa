-- Palier pédagogique (primaire / collège / lycée / université) pour classes et matières.
-- Aligne la création du catalogue avec les périodes de notation (trimestres / semestres).

ALTER TABLE school_classes
  ADD COLUMN IF NOT EXISTS education_level_band TEXT;

ALTER TABLE school_subjects
  ADD COLUMN IF NOT EXISTS education_level_band TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_classes_education_level_band_check'
  ) THEN
    ALTER TABLE school_classes
      ADD CONSTRAINT school_classes_education_level_band_check
      CHECK (
        education_level_band IS NULL
        OR education_level_band IN ('primaire', 'college', 'lycee', 'universite')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_subjects_education_level_band_check'
  ) THEN
    ALTER TABLE school_subjects
      ADD CONSTRAINT school_subjects_education_level_band_check
      CHECK (
        education_level_band IS NULL
        OR education_level_band IN ('primaire', 'college', 'lycee', 'universite')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_school_classes_education_level_band
  ON school_classes (organization_id, education_level_band);

CREATE INDEX IF NOT EXISTS idx_school_subjects_education_level_band
  ON school_subjects (organization_id, education_level_band);
