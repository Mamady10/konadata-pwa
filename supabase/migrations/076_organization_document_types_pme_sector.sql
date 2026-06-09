-- Étendre les secteurs documentaires au module PME

ALTER TABLE organization_document_types
  DROP CONSTRAINT IF EXISTS organization_document_types_sector_check;

ALTER TABLE organization_document_types
  ADD CONSTRAINT organization_document_types_sector_check
  CHECK (sector IN ('school', 'ngo', 'btp', 'pme'));

ALTER TABLE organization_ai_document_templates
  DROP CONSTRAINT IF EXISTS organization_ai_document_templates_sector_check;

ALTER TABLE organization_ai_document_templates
  ADD CONSTRAINT organization_ai_document_templates_sector_check
  CHECK (sector IN ('school', 'ngo', 'btp', 'pme'));
