-- Types d'évaluation retenus pour le calcul du bulletin (choix directeur).

ALTER TABLE school_report_cards
  ADD COLUMN IF NOT EXISTS included_exam_types JSONB;

COMMENT ON COLUMN school_report_cards.included_exam_types IS
  'Types d''évaluation (exam_type) inclus dans la moyenne et le PDF. NULL = toutes les notes de la période.';
