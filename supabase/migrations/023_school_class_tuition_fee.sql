-- Frais de scolarité par classe (GNF). NULL = utiliser le défaut organisation (settings.tuition_fee_gnf).

ALTER TABLE school_classes
  ADD COLUMN IF NOT EXISTS tuition_fee_gnf NUMERIC(14, 2);

COMMENT ON COLUMN school_classes.tuition_fee_gnf IS 'Frais annuels par élève pour cette classe (GNF). NULL = défaut org.';
