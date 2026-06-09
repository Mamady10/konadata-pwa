-- Coller dans Supabase → SQL Editor → Run
-- Vérifie que la migration 049 est appliquée

SELECT '049_check' AS step, EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'organization_billing_offers'
    AND column_name = 'access_mode'
) AS has_access_mode;

SELECT '049_check' AS step, EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'platform_billing_webhook_events'
) AS has_webhook_events_table;

SELECT '049_check' AS step, EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'process_billing_payment_webhook'
) AS has_webhook_rpc;

-- Offres testables (awaiting_payment = prêt pour webhook / paiement)
SELECT
  o.name AS organisation,
  obo.status,
  obo.access_mode,
  obo.activation_amount_gnf,
  obo.payment_token,
  o.billing_status
FROM organization_billing_offers obo
JOIN organizations o ON o.id = obo.organization_id
WHERE obo.status IN ('awaiting_payment', 'draft')
ORDER BY o.created_at DESC
LIMIT 5;
