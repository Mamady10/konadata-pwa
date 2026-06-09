-- Rétro-remplissage palier + archivage matières

ALTER TABLE school_subjects
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Primaire
UPDATE school_classes
SET education_level_band = 'primaire'
WHERE education_level_band IS NULL
  AND level IS NOT NULL
  AND lower(level) ~ '(^|[^a-z])(cp|ce1|ce2|cm1|cm2|primaire|prim|fondamental|maternelle)([^a-z]|$)';

-- Collège
UPDATE school_classes
SET education_level_band = 'college'
WHERE education_level_band IS NULL
  AND level IS NOT NULL
  AND lower(level) ~ '(^|[^a-z])(7e|8e|9e|10e|7eme|8eme|9eme|10eme|college|coll|3eme|4eme|5eme|6eme|bepc)([^a-z]|$)';

-- Lycée
UPDATE school_classes
SET education_level_band = 'lycee'
WHERE education_level_band IS NULL
  AND level IS NOT NULL
  AND lower(level) ~ '(^|[^a-z])(lycee|lyc|terminale|seconde|premiere|11e|12e|11eme|12eme|cap|bac)([^a-z]|$)';

-- Université
UPDATE school_classes
SET education_level_band = 'universite'
WHERE education_level_band IS NULL
  AND level IS NOT NULL
  AND lower(level) ~ '(^|[^a-z])(l1|l2|l3|m1|m2|licence|master|doctorat|universite|faculte|bts|dut)([^a-z]|$)';

-- Défaut collège si niveau vide ou non reconnu
UPDATE school_classes
SET education_level_band = 'college'
WHERE education_level_band IS NULL;

UPDATE school_subjects
SET education_level_band = 'college'
WHERE education_level_band IS NULL;

CREATE INDEX IF NOT EXISTS idx_school_subjects_active
  ON school_subjects (organization_id, is_active);
