-- Profil candidat fiable (contourne les erreurs RLS / mauvais onglet inscription).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_path TEXT
    CHECK (onboarding_path IS NULL OR onboarding_path IN ('learner', 'staff', 'director'));

COMMENT ON COLUMN profiles.onboarding_path IS
  'Parcours choisi à l''inscription : learner = candidat/élève sans création d''org.';

CREATE OR REPLACE FUNCTION ensure_learner_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Non authentifié');
  END IF;

  UPDATE profiles
  SET
    role = 'candidate',
    organization_id = NULL,
    onboarding_path = 'learner'
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_learner_profile() TO authenticated;
