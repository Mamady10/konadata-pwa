-- ============================================================
-- KonaData v2 — KonaScore
-- ============================================================

CREATE TABLE konascore_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  financial_health    NUMERIC(5,2) NOT NULL DEFAULT 0,
  data_quality        NUMERIC(5,2) NOT NULL DEFAULT 0,
  activity_regularity NUMERIC(5,2) NOT NULL DEFAULT 0,
  operations_history  NUMERIC(5,2) NOT NULL DEFAULT 0,
  global_score        NUMERIC(5,2) NOT NULL DEFAULT 0,
  level               konascore_level NOT NULL DEFAULT 'average',
  details             JSONB NOT NULL DEFAULT '{}',
  calculated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_konascore_org ON konascore_snapshots(organization_id, calculated_at DESC);

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
