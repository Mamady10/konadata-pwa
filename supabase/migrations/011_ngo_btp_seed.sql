-- Données démo ONG (FDG) + BTP (Guinée BTP SA)

-- ─── ONG : Fondation Développement Guinée ────────────────────────

INSERT INTO ngo_programs (id, organization_id, name, description, budget, donor) VALUES
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111102', 'Programme Eau et Assainissement', 'Accès à l''eau potable en zones rurales', 3500000000, 'UNICEF'),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111102', 'Programme Éducation', 'Scolarisation des enfants défavorisés', 2100000000, 'Banque Mondiale')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ngo_projects (organization_id, program_id, name, region, locality, budget, spent, status, progress_pct, beneficiaries) VALUES
  ('11111111-1111-1111-1111-111111111102', '33333333-3333-3333-3333-333333333301', 'Projet Eau Potable Labé', 'Labé', 'Labé Centre', 850000000, 382500000, 'active', 45, 450),
  ('11111111-1111-1111-1111-111111111102', '33333333-3333-3333-3333-333333333302', 'Éducation Rurale Kankan', 'Kankan', 'Kankan Ville', 620000000, 446400000, 'active', 72, 380),
  ('11111111-1111-1111-1111-111111111102', NULL, 'Santé Communautaire Matoto', 'Conakry', 'Matoto', 1200000000, 1056000000, 'active', 88, 620),
  ('11111111-1111-1111-1111-111111111102', NULL, 'Agriculture Durable Kindia', 'Kindia', 'Kindia Ville', 450000000, 157500000, 'active', 35, 210);

INSERT INTO core_persons (id, organization_id, kind, full_name, gender, email) VALUES
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111102', 'beneficiary', 'Aissatou Condé', 'F', NULL),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111102', 'beneficiary', 'Sekou Bangoura', 'M', NULL),
  ('44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111102', 'beneficiary', 'Fanta Camara', 'F', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ngo_beneficiaries (organization_id, person_id, region, locality, category) VALUES
  ('11111111-1111-1111-1111-111111111102', '44444444-4444-4444-4444-444444444401', 'Labé', 'Labé Centre', 'Famille'),
  ('11111111-1111-1111-1111-111111111102', '44444444-4444-4444-4444-444444444402', 'Kankan', 'Kankan Ville', 'Enfant'),
  ('11111111-1111-1111-1111-111111111102', '44444444-4444-4444-4444-444444444403', 'Conakry', 'Matoto', 'Femme enceinte');

INSERT INTO ngo_surveys (organization_id, title, status, region, questions) VALUES
  ('11111111-1111-1111-1111-111111111102', 'Besoins eau potable Labé', 'active', 'Labé', '[{"id":"q1","text":"Avez-vous accès à l''eau potable?","type":"yes_no"}]'),
  ('11111111-1111-1111-1111-111111111102', 'Impact éducation Kankan', 'active', 'Kankan', '[{"id":"q1","text":"Votre enfant est-il scolarisé?","type":"yes_no"}]'),
  ('11111111-1111-1111-1111-111111111102', 'Santé maternelle Matoto', 'closed', 'Conakry', '[{"id":"q1","text":"Suivi prénatal régulier?","type":"yes_no"}]');

-- ─── BTP : Guinée BTP SA ─────────────────────────────────────────

INSERT INTO btp_sites (organization_id, name, location, budget, spent, status, physical_progress, financial_progress, delay_days) VALUES
  ('11111111-1111-1111-1111-111111111103', 'Route RN1 - Labé', 'Labé', 4500000000, 3240000000, 'active', 72, 68, 0),
  ('11111111-1111-1111-1111-111111111103', 'Pont Kaloum', 'Conakry', 8200000000, 3690000000, 'active', 45, 42, 7),
  ('11111111-1111-1111-1111-111111111103', 'Bâtiment ISC', 'Conakry', 2100000000, 1848000000, 'active', 88, 85, 0),
  ('11111111-1111-1111-1111-111111111103', 'Voirie Matam', 'Conakry', 1800000000, 1008000000, 'active', 56, 52, 3);

INSERT INTO core_persons (id, organization_id, kind, full_name, phone) VALUES
  ('55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111103', 'worker', 'Mamadou Diallo', '+224 622 11 01'),
  ('55555555-5555-5555-5555-555555555502', '11111111-1111-1111-1111-111111111103', 'worker', 'Ibrahima Camara', '+224 622 11 02')
ON CONFLICT (id) DO NOTHING;

INSERT INTO btp_personnel (organization_id, person_id, role, daily_rate, is_active)
SELECT '11111111-1111-1111-1111-111111111103', id, 'Chef d''équipe', 250000, true
FROM core_persons WHERE id = '55555555-5555-5555-5555-555555555501';

INSERT INTO btp_personnel (organization_id, person_id, role, daily_rate, is_active)
SELECT '11111111-1111-1111-1111-111111111103', id, 'Maçon', 180000, true
FROM core_persons WHERE id = '55555555-5555-5555-5555-555555555502';

INSERT INTO btp_equipment (organization_id, name, type, status) VALUES
  ('11111111-1111-1111-1111-111111111103', 'Bulldozer CAT D6', 'Engin terrassement', 'operational'),
  ('11111111-1111-1111-1111-111111111103', 'Camion benne', 'Transport', 'operational');

INSERT INTO btp_stock (organization_id, item_name, unit, quantity, min_threshold) VALUES
  ('11111111-1111-1111-1111-111111111103', 'Ciment CPJ 42.5', 'sacs', 120, 50),
  ('11111111-1111-1111-1111-111111111103', 'Fer à béton 12mm', 'tonnes', 8, 5),
  ('11111111-1111-1111-1111-111111111103', 'Gravier', 'm³', 45, 20);

INSERT INTO btp_delivery_notes (organization_id, reference, supplier, total_amount, delivery_date, items) VALUES
  ('11111111-1111-1111-1111-111111111103', 'BL-2026-0142', 'Guinée Matériaux SA', 45000000, '2026-05-28', '[{"item":"Ciment","qty":200}]'),
  ('11111111-1111-1111-1111-111111111103', 'BL-2026-0138', 'Metal Conakry', 28500000, '2026-05-25', '[{"item":"Fer à béton","qty":5}]');

INSERT INTO btp_fuel_logs (organization_id, site_id, liters, cost, logged_at, is_anomaly)
SELECT '11111111-1111-1111-1111-111111111103', id, 450, 6750000, now() - interval '2 days', false
FROM btp_sites WHERE organization_id = '11111111-1111-1111-1111-111111111103' AND name = 'Route RN1 - Labé' LIMIT 1;

INSERT INTO btp_fuel_logs (organization_id, site_id, liters, cost, logged_at, is_anomaly)
SELECT '11111111-1111-1111-1111-111111111103', id, 820, 12300000, now() - interval '1 day', true
FROM btp_sites WHERE organization_id = '11111111-1111-1111-1111-111111111103' AND name = 'Pont Kaloum' LIMIT 1;
