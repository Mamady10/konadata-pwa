-- Après saisie terrain (btp_daily_progress), met à jour l'avancement affiché sur le chantier.

CREATE OR REPLACE FUNCTION sync_btp_site_physical_from_daily()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.physical_pct IS NOT NULL THEN
    UPDATE btp_sites
    SET physical_progress = NEW.physical_pct
    WHERE id = NEW.site_id
      AND organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_btp_daily_progress_sync_site ON btp_daily_progress;

CREATE TRIGGER trg_btp_daily_progress_sync_site
  AFTER INSERT ON btp_daily_progress
  FOR EACH ROW
  EXECUTE FUNCTION sync_btp_site_physical_from_daily();
