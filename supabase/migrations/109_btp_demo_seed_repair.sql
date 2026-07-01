-- Réparation données démo BTP (Guinée BTP SA) si absentes en production

DO $$
DECLARE
  v_org UUID := '11111111-1111-1111-1111-111111111103';
  v_count INT;
BEGIN
  SELECT COUNT(*)::int INTO v_count FROM btp_sites WHERE organization_id = v_org;
  IF v_count > 0 THEN
    RAISE NOTICE 'BTP demo seed: % chantier(s) déjà présents — ignoré', v_count;
    RETURN;
  END IF;

  INSERT INTO btp_sites (organization_id, name, location, budget, spent, status, physical_progress, financial_progress, delay_days) VALUES
    (v_org, 'Route RN1 - Labé', 'Labé', 4500000000, 3240000000, 'active', 72, 68, 0),
    (v_org, 'Pont Kaloum', 'Conakry', 8200000000, 3690000000, 'active', 45, 42, 7),
    (v_org, 'Bâtiment ISC', 'Conakry', 2100000000, 1848000000, 'active', 88, 85, 0),
    (v_org, 'Voirie Matam', 'Conakry', 1800000000, 1008000000, 'active', 56, 52, 3);

  INSERT INTO core_persons (id, organization_id, kind, full_name, phone) VALUES
    ('55555555-5555-5555-5555-555555555501', v_org, 'worker', 'Mamadou Diallo', '+224 622 11 01'),
    ('55555555-5555-5555-5555-555555555502', v_org, 'worker', 'Ibrahima Camara', '+224 622 11 02')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO btp_personnel (organization_id, person_id, role, daily_rate, is_active)
  SELECT v_org, id, 'Chef d''équipe', 250000, true
  FROM core_persons WHERE id = '55555555-5555-5555-5555-555555555501'
  AND NOT EXISTS (
    SELECT 1 FROM btp_personnel WHERE organization_id = v_org AND person_id = '55555555-5555-5555-5555-555555555501'
  );

  INSERT INTO btp_personnel (organization_id, person_id, role, daily_rate, is_active)
  SELECT v_org, id, 'Maçon', 180000, true
  FROM core_persons WHERE id = '55555555-5555-5555-5555-555555555502'
  AND NOT EXISTS (
    SELECT 1 FROM btp_personnel WHERE organization_id = v_org AND person_id = '55555555-5555-5555-5555-555555555502'
  );

  INSERT INTO btp_equipment (organization_id, name, type, status) VALUES
    (v_org, 'Bulldozer CAT D6', 'Engin terrassement', 'operational'),
    (v_org, 'Camion benne', 'Transport', 'operational');

  INSERT INTO btp_stock (organization_id, item_name, unit, quantity, min_threshold) VALUES
    (v_org, 'Ciment CPJ 42.5', 'sacs', 120, 50),
    (v_org, 'Fer à béton 12mm', 'tonnes', 8, 5),
    (v_org, 'Gravier', 'm³', 45, 20);

  INSERT INTO btp_delivery_notes (organization_id, reference, supplier, total_amount, delivery_date, items) VALUES
    (v_org, 'BL-2026-0142', 'Guinée Matériaux SA', 45000000, '2026-05-28', '[{"item":"Ciment","qty":200}]'),
    (v_org, 'BL-2026-0138', 'Metal Conakry', 28500000, '2026-05-25', '[{"item":"Fer à béton","qty":5}]');

  INSERT INTO btp_fuel_logs (organization_id, site_id, liters, cost, logged_at, is_anomaly)
  SELECT v_org, id, 450, 6750000, now() - interval '2 days', false
  FROM btp_sites WHERE organization_id = v_org AND name = 'Route RN1 - Labé' LIMIT 1;

  INSERT INTO btp_fuel_logs (organization_id, site_id, liters, cost, logged_at, is_anomaly)
  SELECT v_org, id, 820, 12300000, now() - interval '1 day', true
  FROM btp_sites WHERE organization_id = v_org AND name = 'Pont Kaloum' LIMIT 1;

  RAISE NOTICE 'BTP demo seed: données insérées pour Guinée BTP SA';
END $$;
