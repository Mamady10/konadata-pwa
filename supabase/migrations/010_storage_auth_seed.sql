-- ============================================================
-- KonaData v2 — Storage, Auth RPC, données démo
-- ============================================================

-- ─── Storage bucket documents ────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_documents_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = get_user_organization_id()::text
  );

CREATE POLICY storage_documents_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = get_user_organization_id()::text
  );

CREATE POLICY storage_documents_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = get_user_organization_id()::text
  );

CREATE POLICY storage_documents_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = get_user_organization_id()::text
    AND is_org_admin()
  );

CREATE POLICY storage_platform_admin ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND is_platform_admin());

-- ─── RPC : création organisation + directeur ─────────────────────

CREATE OR REPLACE FUNCTION create_organization_with_owner(
  p_name TEXT,
  p_type organization_type,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF get_user_organization_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Vous êtes déjà rattaché à une organisation';
  END IF;

  INSERT INTO organizations (name, type, email, phone)
  VALUES (trim(p_name), p_type, p_email, p_phone)
  RETURNING id INTO v_org_id;

  UPDATE profiles SET
    organization_id = v_org_id,
    role = 'org_admin'
  WHERE id = v_user_id;

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_organization_with_owner(TEXT, organization_type, TEXT, TEXT) TO authenticated;

-- ─── RPC : configuration utilisateur démo ────────────────────────

CREATE OR REPLACE FUNCTION setup_demo_user(
  p_email TEXT,
  p_org_id UUID,
  p_role app_role,
  p_full_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET
    organization_id = p_org_id,
    full_name = p_full_name,
    role = p_role
  WHERE lower(email) = lower(p_email);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil introuvable pour %', p_email;
  END IF;
END;
$$;

-- ─── Données démo (organisations) ────────────────────────────────

INSERT INTO organizations (id, name, type, email, phone, address) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Institut Supérieur de Conakry', 'school', 'contact@isc.gn', '+224 622 00 00 01', 'Conakry, Guinée'),
  ('11111111-1111-1111-1111-111111111102', 'Fondation Développement Guinée', 'ngo', 'info@fdg.gn', '+224 622 00 00 02', 'Conakry, Guinée'),
  ('11111111-1111-1111-1111-111111111103', 'Guinée BTP SA', 'btp', 'contact@guineebtp.gn', '+224 622 00 00 03', 'Conakry, Guinée')
ON CONFLICT (id) DO NOTHING;

-- Personnes + école ISC (extrait)
INSERT INTO core_persons (id, organization_id, kind, full_name, email) VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'teacher', 'Dr. Alpha Bah', 'alpha.bah@isc.gn'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'student', 'Ousmane Keita', 'ousmane@isc.gn'),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 'student', 'Hawa Diallo', 'hawa@isc.gn')
ON CONFLICT (id) DO NOTHING;

INSERT INTO school_classes (organization_id, name, level, academic_year) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Licence 1 Informatique', 'L1', '2025-2026'),
  ('11111111-1111-1111-1111-111111111101', 'Licence 2 Gestion', 'L2', '2025-2026');

INSERT INTO school_subjects (organization_id, name, code, coefficient) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Programmation', 'INFO101', 3),
  ('11111111-1111-1111-1111-111111111101', 'Comptabilité', 'GEST201', 2);

INSERT INTO school_teachers (organization_id, person_id, specialty) VALUES
  ('11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222201', 'Informatique');

INSERT INTO school_students (organization_id, person_id, matricule, enrollment_status, enrollment_date) VALUES
  ('11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222202', 'ISC-2025-001', 'enrolled', '2025-09-15'),
  ('11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222203', 'ISC-2025-002', 'enrolled', '2025-09-15');

-- ─── VÉRIFICATION FINALE (affiche des résultats dans SQL Editor) ─

SELECT 'KonaData schema installé avec succès' AS message;

SELECT table_name, 'OK' AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'organizations', 'profiles', 'core_persons', 'documents',
    'school_students', 'school_enrollments', 'ngo_projects', 'btp_sites'
  )
ORDER BY table_name;

SELECT COUNT(*) AS total_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
