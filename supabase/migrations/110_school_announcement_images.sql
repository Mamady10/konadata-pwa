-- Vie scolaire : images jointes aux publications (annonces, événements, résultats)
-- Le fichier est stocké dans le bucket privé `documents` sous {orgId}/announcements/...
-- image_path contient la clé Storage ; les URLs signées sont générées côté serveur.

ALTER TABLE school_announcements
  ADD COLUMN IF NOT EXISTS image_path TEXT;
