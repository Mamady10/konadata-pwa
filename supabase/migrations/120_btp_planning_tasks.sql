-- Planning BTP par tâches (début / fin / durée) + avancement par tâche

ALTER TABLE btp_site_planning_refs
  DROP CONSTRAINT IF EXISTS btp_site_planning_refs_source_type_check;

ALTER TABLE btp_site_planning_refs
  ADD CONSTRAINT btp_site_planning_refs_source_type_check
  CHECK (source_type IN ('linear', 'milestones', 'ms_project', 'tasks'));

COMMENT ON COLUMN btp_site_planning_refs.tasks IS
  'Tâches (MS Project ou saisies KonaData) : uid, name, startDate, finishDate, durationDays, weight (= durée).';

ALTER TABLE btp_daily_progress
  ADD COLUMN IF NOT EXISTS task_progress JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN btp_daily_progress.task_progress IS
  'Avancement par tâche au jour du relevé : [{uid, name, pct, weight}]. physical_pct = global (calculé ou saisi).';
