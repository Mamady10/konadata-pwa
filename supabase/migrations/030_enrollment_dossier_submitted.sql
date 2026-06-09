-- Date de dépôt du dossier complet par le candidat (visible scolarité / direction / comptable).

ALTER TABLE school_enrollments
  ADD COLUMN IF NOT EXISTS dossier_submitted_at TIMESTAMPTZ;

COMMENT ON COLUMN school_enrollments.dossier_submitted_at IS
  'Horodatage lorsque le candidat confirme avoir joint toutes les pièces demandées.';
