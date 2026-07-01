-- École : documents restreints + fil d'annonces vie scolaire

CREATE OR REPLACE FUNCTION can_manage_school_documents()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(
    'platform_admin', 'org_admin', 'deputy_director',
    'registrar', 'accountant'
  )
$$;

GRANT EXECUTE ON FUNCTION can_manage_school_documents() TO authenticated;

-- Annonces / événements vie scolaire (lecture élèves/parents via portail)
CREATE TABLE IF NOT EXISTS school_announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'announcement'
    CHECK (category IN ('announcement', 'event', 'holiday', 'results')),
  event_date      DATE,
  visible_to_parents BOOLEAN NOT NULL DEFAULT true,
  visible_to_students BOOLEAN NOT NULL DEFAULT true,
  published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_announcements_org_published
  ON school_announcements (organization_id, published_at DESC);

ALTER TABLE school_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_announcements_select ON school_announcements;
CREATE POLICY school_announcements_select ON school_announcements FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id)
    AND is_school_org()
    AND (
      is_platform_admin()
      OR is_org_admin()
      OR has_role('deputy_director', 'registrar', 'accountant', 'teacher')
      OR (has_role('student', 'candidate') AND visible_to_students)
    )
  );

DROP POLICY IF EXISTS school_announcements_write ON school_announcements;
CREATE POLICY school_announcements_write ON school_announcements FOR ALL TO authenticated
  USING (
    belongs_to_org(organization_id)
    AND is_school_org()
    AND has_role('platform_admin', 'org_admin', 'deputy_director', 'registrar')
  )
  WITH CHECK (
    belongs_to_org(organization_id)
    AND is_school_org()
    AND has_role('platform_admin', 'org_admin', 'deputy_director', 'registrar')
  );

-- Documents org : établissement = personnel administratif uniquement (pas élèves/candidats)
DROP POLICY IF EXISTS documents_select ON documents;

CREATE POLICY documents_select ON documents FOR SELECT TO authenticated
  USING (
    belongs_to_org(organization_id)
    AND (
      is_platform_admin()
      OR is_org_admin()
      OR (
        is_ngo_org()
        AND has_role('ngo_staff')
        AND EXISTS (
          SELECT 1 FROM ngo_project_documents npd
          WHERE npd.document_id = documents.id
            AND is_assigned_to_ngo_project(npd.project_id)
        )
      )
      OR (
        is_btp_org()
        AND has_role('btp_staff')
        AND EXISTS (
          SELECT 1 FROM btp_site_documents bsd
          WHERE bsd.document_id = documents.id
            AND is_assigned_to_btp_site(bsd.site_id)
        )
      )
      OR (is_ngo_org() AND NOT has_role('ngo_staff'))
      OR (is_btp_org() AND NOT has_role('btp_staff'))
      OR (is_school_org() AND can_manage_school_documents())
      OR (NOT is_ngo_org() AND NOT is_btp_org() AND NOT is_school_org())
    )
  );
