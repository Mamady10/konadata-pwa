-- Données de référence planifié pour les chantiers démo Guinée BTP SA

UPDATE btp_sites SET
  client = 'Ministère des Infrastructures',
  contract_ref = 'M-2024-INF-0847',
  start_date = '2026-01-15',
  end_date = '2026-11-30',
  description = 'Pont à tablier métallique — 2 travées, 120 m',
  moa_recipient = 'M. Camara — Représentant MOA',
  planned_avg_workers = 18,
  planned_monthly_fuel_liters = 2000,
  budget_alert_pct = 90,
  budget_breakdown = '{"labor":25,"materials":40,"equipment":15,"subcontract":10,"overhead":10}'::jsonb
WHERE organization_id = '11111111-1111-1111-1111-111111111103'
  AND name = 'Pont Kaloum';

UPDATE btp_sites SET
  start_date = '2025-09-01',
  end_date = '2026-08-31',
  client = 'Ministère des Infrastructures',
  planned_avg_workers = 22,
  budget_alert_pct = 90
WHERE organization_id = '11111111-1111-1111-1111-111111111103'
  AND name = 'Route RN1 - Labé';

INSERT INTO btp_site_milestones (organization_id, site_id, label, target_physical_pct, planned_date, sort_order)
SELECT
  s.organization_id,
  s.id,
  m.label,
  m.pct,
  m.dt::date,
  m.ord
FROM btp_sites s
CROSS JOIN (
  VALUES
    ('Fondations', 15::numeric, '2026-04-30', 0),
    ('Structure', 45::numeric, '2026-07-31', 1),
    ('Tablier', 75::numeric, '2026-09-30', 2),
    ('Finitions', 100::numeric, '2026-11-15', 3)
) AS m(label, pct, dt, ord)
WHERE s.organization_id = '11111111-1111-1111-1111-111111111103'
  AND s.name = 'Pont Kaloum'
  AND NOT EXISTS (
    SELECT 1 FROM btp_site_milestones ms WHERE ms.site_id = s.id
  );
