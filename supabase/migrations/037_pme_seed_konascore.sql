-- ============================================================
-- Données démo PME + KonaScore commerce
-- ============================================================

INSERT INTO organizations (id, name, type, email, phone, address) VALUES
  ('11111111-1111-1111-1111-111111111104', 'Boutique Mamou Commerce', 'business', 'contact@mamou.gn', '+224 622 00 00 04', 'Mamou, Guinée')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address;

INSERT INTO pme_customers (id, organization_id, name, phone, balance, is_active) VALUES
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111104', 'Client Régulier Mamou', '+224 622 11 22 33', 0, true),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111104', 'Restaurant Le Palmier', '+224 622 44 55 66', 350000, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pme_suppliers (id, organization_id, name, phone, is_active) VALUES
  ('44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111104', 'Grossiste Conakry Riz', '+224 622 99 88 77', true),
  ('44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111104', 'Import Huiles Guinée', '+224 622 77 66 55', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pme_products (id, organization_id, name, sku, unit, unit_price, stock_quantity, min_stock) VALUES
  ('55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111104', 'Riz 25 kg', 'RIZ-25', 'sac', 185000, 42, 10),
  ('55555555-5555-5555-5555-555555555502', '11111111-1111-1111-1111-111111111104', 'Huile 5 L', 'HUI-5L', 'bidon', 95000, 28, 8),
  ('55555555-5555-5555-5555-555555555503', '11111111-1111-1111-1111-111111111104', 'Ciment 50 kg', 'CIM-50', 'sac', 75000, 8, 15)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pme_sales (id, organization_id, customer_id, reference, items, subtotal, total, payment_status, sold_at) VALUES
  ('66666666-6666-6666-6666-666666666601', '11111111-1111-1111-1111-111111111104', '33333333-3333-3333-3333-333333333301', 'VTE-2026-001',
   '[{"product":"Riz 25kg","qty":2,"unit_price":185000}]'::jsonb, 370000, 370000, 'paid', '2026-05-30T10:00:00Z'),
  ('66666666-6666-6666-6666-666666666602', '11111111-1111-1111-1111-111111111104', '33333333-3333-3333-3333-333333333302', 'VTE-2026-002',
   '[{"product":"Huile 5L","qty":5,"unit_price":95000}]'::jsonb, 475000, 475000, 'pending', '2026-05-29T14:30:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO pme_purchases (id, organization_id, supplier_id, reference, items, total, payment_status, purchased_at) VALUES
  ('77777777-7777-7777-7777-777777777701', '11111111-1111-1111-1111-111111111104', '44444444-4444-4444-4444-444444444401', 'ACH-2026-001',
   '[{"product":"Riz 25kg","qty":50}]'::jsonb, 8500000, 'paid', '2026-05-20T09:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO pme_expenses (id, organization_id, category, description, amount, expense_date) VALUES
  ('88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111104', 'loyer', 'Loyer boutique Mamou', 1200000, '2026-05-01'),
  ('88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111104', 'salaires', 'Salaire vendeur', 800000, '2026-05-15'),
  ('88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111104', 'transport', 'Transport marchandises', 325000, '2026-05-18')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION calculate_konascore(p_org_id UUID)
RETURNS konascore_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_financial   NUMERIC(5,2) := 75;
  v_data        NUMERIC(5,2) := 80;
  v_activity    NUMERIC(5,2) := 70;
  v_operations  NUMERIC(5,2) := 85;
  v_global      NUMERIC(5,2);
  v_level       konascore_level;
  v_org_type    organization_type;
  v_result      konascore_snapshots;
  v_revenue     NUMERIC;
  v_expenses    NUMERIC;
BEGIN
  SELECT type INTO v_org_type FROM organizations WHERE id = p_org_id;

  IF v_org_type = 'school' THEN
    SELECT COALESCE(
      (COUNT(*) FILTER (WHERE status = 'paid')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 75
    ) INTO v_financial FROM school_payments WHERE organization_id = p_org_id;
  ELSIF v_org_type = 'ngo' THEN
    SELECT COALESCE(100 - (SUM(spent) / NULLIF(SUM(budget), 0) * 100), 75)
    INTO v_financial FROM ngo_projects WHERE organization_id = p_org_id;
  ELSIF v_org_type = 'btp' THEN
    SELECT COALESCE(AVG(financial_progress), 75) INTO v_financial
    FROM btp_sites WHERE organization_id = p_org_id;
  ELSIF v_org_type = 'business' THEN
    SELECT COALESCE(SUM(total), 0) INTO v_revenue
    FROM pme_sales WHERE organization_id = p_org_id;
    SELECT COALESCE(SUM(amount), 0) INTO v_expenses
    FROM pme_expenses WHERE organization_id = p_org_id;
    IF v_revenue > 0 THEN
      v_financial := LEAST(100, GREATEST(0, ((v_revenue - v_expenses) / v_revenue) * 100 + 50));
    ELSE
      v_financial := 60;
    END IF;
  END IF;

  SELECT COALESCE(
    (COUNT(*) FILTER (WHERE status = 'classified')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 80
  ) INTO v_data FROM documents WHERE organization_id = p_org_id;

  SELECT LEAST(COUNT(*) * 2, 100) INTO v_activity
  FROM audit_logs
  WHERE organization_id = p_org_id AND created_at > now() - INTERVAL '30 days';

  SELECT LEAST(COUNT(*) * 5, 100) INTO v_operations
  FROM audit_logs WHERE organization_id = p_org_id;

  v_global := (v_financial + v_data + v_activity + v_operations) / 4;
  v_level := CASE
    WHEN v_global >= 85 THEN 'excellent'::konascore_level
    WHEN v_global >= 70 THEN 'good'::konascore_level
    WHEN v_global >= 50 THEN 'average'::konascore_level
    ELSE 'risky'::konascore_level
  END;

  INSERT INTO konascore_snapshots (
    organization_id, financial_health, data_quality,
    activity_regularity, operations_history, global_score, level
  ) VALUES (
    p_org_id, v_financial, v_data, v_activity, v_operations, v_global, v_level
  ) RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
