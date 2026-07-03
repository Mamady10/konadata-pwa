-- ============================================================
-- KonaData v2 — PME : assignation des boutiques aux gérants
-- À COLLER TEL QUEL dans Supabase → SQL Editor → Run.
-- Ajoute la ressource 'pme_boutique' à collaborator_assignments.
-- Idempotent (IF NOT EXISTS) : ré-exécutable.
-- ============================================================

ALTER TYPE assignment_resource_type ADD VALUE IF NOT EXISTS 'pme_boutique';
