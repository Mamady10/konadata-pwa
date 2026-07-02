-- Vie scolaire : images jointes aux publications (annonces, événements, résultats)
-- À exécuter dans Supabase SQL Editor.
-- Le fichier est stocké dans le bucket privé `documents` sous {orgId}/announcements/...

ALTER TABLE school_announcements
  ADD COLUMN IF NOT EXISTS image_path TEXT;
