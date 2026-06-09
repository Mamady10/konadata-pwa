-- Active les organisations seed pour les captures vidéo démo
-- (comptes auth créés via : npm run seed:demo)

UPDATE organizations SET
  is_active = true,
  billing_status = 'active',
  settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
    'platform_subscription_valid_until', '2027-12-31',
    'demo_video', true
  )
WHERE id IN (
  '11111111-1111-1111-1111-111111111101',
  '11111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111104'
);

-- Abonnements actifs ONG / BTP / PME (si plans présents)
INSERT INTO organization_subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
SELECT o.id, p.id, 'active', now(), now() + interval '1 year'
FROM organizations o
JOIN platform_billing_plans p ON p.sector = o.type AND p.is_active
WHERE o.id IN (
  '11111111-1111-1111-1111-111111111102',
  '11111111-1111-1111-1111-111111111103',
  '11111111-1111-1111-1111-111111111104'
)
ON CONFLICT (organization_id) DO UPDATE SET
  status = 'active',
  current_period_end = now() + interval '1 year';
