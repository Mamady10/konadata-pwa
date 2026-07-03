-- ============================================================
-- KonaData v2 — PME : assignation des boutiques aux gérants
-- Réutilise la table générique collaborator_assignments en
-- ajoutant la ressource 'pme_boutique' à l'enum.
-- Idempotent : ré-exécutable sans risque.
-- ============================================================

ALTER TYPE assignment_resource_type ADD VALUE IF NOT EXISTS 'pme_boutique';
