-- RPC audit RLS (appelable via service role depuis npm run audit:rls)

CREATE OR REPLACE FUNCTION audit_rls_tenant_isolation()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.audit_status DESC, t.table_name), '[]'::jsonb)
  INTO v_rows
  FROM (
    WITH tenant_tables AS (
      SELECT DISTINCT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND a.attname = 'organization_id'
        AND NOT a.attisdropped
    ),
    rls_on AS (
      SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    ),
    policies AS (
      SELECT
        tablename AS table_name,
        COUNT(*) FILTER (WHERE roles::text LIKE '%authenticated%') AS auth_policy_count,
        BOOL_OR(
          qual::text ILIKE '%belongs_to_org%'
          OR qual::text ILIKE '%get_user_organization_id%'
          OR with_check::text ILIKE '%belongs_to_org%'
          OR with_check::text ILIKE '%get_user_organization_id%'
        ) AS has_tenant_predicate
      FROM pg_policies
      WHERE schemaname = 'public'
      GROUP BY tablename
    )
    SELECT
      t.table_name,
      COALESCE(r.rls_enabled, false) AS rls_enabled,
      COALESCE(p.auth_policy_count, 0)::int AS authenticated_policies,
      COALESCE(p.has_tenant_predicate, false) AS has_tenant_predicate,
      CASE
        WHEN NOT COALESCE(r.rls_enabled, false) THEN 'FAIL_RLS_OFF'
        WHEN COALESCE(p.auth_policy_count, 0) = 0 THEN 'FAIL_NO_POLICY'
        WHEN NOT COALESCE(p.has_tenant_predicate, false) THEN 'WARN_NO_TENANT'
        ELSE 'OK'
      END AS audit_status
    FROM tenant_tables t
    LEFT JOIN rls_on r ON r.table_name = t.table_name
    LEFT JOIN policies p ON p.table_name = t.table_name
  ) t;

  RETURN jsonb_build_object('rows', v_rows, 'checked_at', now());
END;
$$;

REVOKE ALL ON FUNCTION audit_rls_tenant_isolation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION audit_rls_tenant_isolation() TO service_role;
