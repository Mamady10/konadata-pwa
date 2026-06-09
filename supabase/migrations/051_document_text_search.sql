-- Phase B : texte extrait des PDF/Word/images pour recherche KonaAI

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_text TEXT;

COMMENT ON COLUMN documents.search_text IS
  'Texte extrait à l''upload (PDF, Word, Excel, OCR manuscrit) pour recherche et chat.';

CREATE INDEX IF NOT EXISTS idx_documents_org_has_search
  ON documents (organization_id, created_at DESC)
  WHERE search_text IS NOT NULL AND length(search_text) > 20;

CREATE INDEX IF NOT EXISTS idx_documents_fts_simple
  ON documents USING gin (to_tsvector('simple', coalesce(search_text, '')));

-- Recherche full-text (échoue gracieusement côté app si requête invalide)
CREATE OR REPLACE FUNCTION search_organization_documents(
  p_org_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 8
)
RETURNS TABLE (
  document_id UUID,
  file_name TEXT,
  excerpt TEXT,
  rank REAL
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_q TEXT := trim(coalesce(p_query, ''));
  v_tsquery tsquery;
BEGIN
  IF length(v_q) < 2 THEN
    RETURN;
  END IF;

  BEGIN
    v_tsquery := plainto_tsquery('simple', v_q);
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY
    SELECT
      d.id,
      d.file_name,
      left(coalesce(d.search_text, ''), 500),
      0.1::REAL
    FROM documents d
    WHERE d.organization_id = p_org_id
      AND d.search_text IS NOT NULL
      AND d.search_text ILIKE '%' || replace(v_q, '%', '') || '%'
    ORDER BY d.created_at DESC
    LIMIT greatest(1, least(coalesce(p_limit, 8), 20));
    RETURN;
  END;

  RETURN QUERY
  SELECT
    d.id,
    d.file_name,
    left(coalesce(d.search_text, ''), 500),
    ts_rank(
      to_tsvector('simple', coalesce(d.search_text, '')),
      v_tsquery
    )::REAL AS rank
  FROM documents d
  WHERE d.organization_id = p_org_id
    AND d.search_text IS NOT NULL
    AND length(d.search_text) > 0
    AND to_tsvector('simple', coalesce(d.search_text, '')) @@ v_tsquery
  ORDER BY rank DESC, d.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 8), 20));
END;
$$;

GRANT EXECUTE ON FUNCTION search_organization_documents(UUID, TEXT, INT) TO authenticated;

COMMENT ON FUNCTION search_organization_documents IS
  'Recherche dans les documents indexés de l''organisation (RLS documents).';
