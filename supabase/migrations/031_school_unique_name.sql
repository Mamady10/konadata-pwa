-- Noms d'établissements scolaires uniques (insensible à la casse) + garde à la création.

CREATE OR REPLACE FUNCTION normalize_school_org_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(COALESCE(p_name, '')));
$$;

CREATE OR REPLACE FUNCTION school_org_name_taken(p_name TEXT, p_exclude_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organizations o
    WHERE o.type = 'school'
      AND normalize_school_org_name(o.name) = normalize_school_org_name(p_name)
      AND (p_exclude_id IS NULL OR o.id <> p_exclude_id)
  );
$$;

GRANT EXECUTE ON FUNCTION school_org_name_taken(TEXT, UUID) TO authenticated, anon;

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

  IF trim(COALESCE(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Le nom de l''organisation est requis';
  END IF;

  IF p_type = 'school' AND school_org_name_taken(p_name, NULL) THEN
    RAISE EXCEPTION 'Un établissement scolaire porte déjà ce nom. Choisissez un nom distinct (ex. ajoutez la ville).';
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
