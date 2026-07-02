-- Vie scolaire : plusieurs images par publication (max 50 côté application).
-- image_paths remplace/complète image_path (conservé pour compatibilité).

ALTER TABLE school_announcements
  ADD COLUMN IF NOT EXISTS image_paths TEXT[] NOT NULL DEFAULT '{}';

-- Reprise des images déjà publiées (colonne image_path unique) vers le tableau.
UPDATE school_announcements
SET image_paths = ARRAY[image_path]
WHERE image_path IS NOT NULL
  AND (image_paths IS NULL OR array_length(image_paths, 1) IS NULL);
