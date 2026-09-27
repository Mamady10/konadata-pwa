-- ============================================================
-- KonaData — CORRECTIF URGENT connexion (après la migration 121)
--
-- btp_quote_access avait une clé étrangère vers organizations ET vers profiles
-- dans sa clé primaire : l'API Supabase y voyait un 2e lien profiles <-> organizations
-- et refusait la requête « profiles + organizations(type) » faite à chaque connexion
-- (erreur PGRST201). Résultat : tout le monde était renvoyé vers la création
-- d'organisation. Aucune donnée n'est modifiée par ce correctif.
-- Idempotent : ré-exécutable sans risque.
-- ============================================================

ALTER TABLE IF EXISTS btp_quote_access
  DROP CONSTRAINT IF EXISTS btp_quote_access_organization_id_fkey;

-- L'appartenance à l'organisation reste contrôlée par les politiques RLS (belongs_to_org)
-- et la suppression d'un membre supprime ses accès (profile_id ON DELETE CASCADE).

NOTIFY pgrst, 'reload schema';
