-- ============================================================
-- KonaData v2 — Entités partagées (noyau commun)
-- ============================================================

-- ─── PERSONNES (entité normalisée cross-modules) ───────────────

CREATE TABLE core_persons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  kind            person_kind NOT NULL,
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  date_of_birth   DATE,
  gender          TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT core_persons_name_not_empty CHECK (char_length(trim(full_name)) > 0)
);

CREATE INDEX idx_core_persons_org ON core_persons(organization_id);
CREATE INDEX idx_core_persons_profile ON core_persons(profile_id);
CREATE INDEX idx_core_persons_kind ON core_persons(organization_id, kind);

CREATE TRIGGER trg_core_persons_updated
  BEFORE UPDATE ON core_persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE core_persons IS
  'Registre unifié des personnes (élèves, enseignants, bénéficiaires, ouvriers). Évite la duplication inter-modules.';

-- ─── DOCUMENTS (Storage + métadonnées IA) ──────────────────────

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  file_name       TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  file_size       BIGINT,
  mime_type       TEXT,
  status          document_status NOT NULL DEFAULT 'uploading',
  category        document_category,
  ai_confidence   NUMERIC(5,2),
  extracted_data  JSONB NOT NULL DEFAULT '{}',
  tags            TEXT[] NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_extractions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_name      TEXT NOT NULL,
  field_value     TEXT,
  confidence      NUMERIC(5,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_document_extractions_org ON document_extractions(organization_id);
CREATE INDEX idx_document_extractions_doc ON document_extractions(document_id);

CREATE TRIGGER trg_documents_updated
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Propagation organization_id sur extractions
CREATE OR REPLACE FUNCTION sync_extraction_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT organization_id INTO NEW.organization_id
  FROM documents WHERE id = NEW.document_id;
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'document_id invalide';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_document_extractions_org
  BEFORE INSERT OR UPDATE OF document_id ON document_extractions
  FOR EACH ROW EXECUTE FUNCTION sync_extraction_org_id();

-- ─── Trigger générique : organization_id cohérent ──────────────

CREATE OR REPLACE FUNCTION assert_same_org_from_person()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_person_org UUID;
BEGIN
  SELECT organization_id INTO v_person_org FROM core_persons WHERE id = NEW.person_id;
  IF v_person_org IS NULL OR v_person_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'person_id doit appartenir à la même organisation';
  END IF;
  RETURN NEW;
END;
$$;
