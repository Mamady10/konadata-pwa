-- opening_spent séparé de spent (cache sync) + BL workflow + stock unicité par site

ALTER TABLE btp_sites
  ADD COLUMN IF NOT EXISTS opening_spent NUMERIC(15,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN btp_sites.opening_spent IS
  'Dépenses engagées avant suivi dans l''app (hors transactions enregistrées).';

-- Sites sans transactions trackées : conserver l''ancien spent comme opening_spent
UPDATE btp_sites s
SET opening_spent = COALESCE(s.spent, 0)
WHERE opening_spent = 0
  AND NOT EXISTS (SELECT 1 FROM btp_fuel_logs f WHERE f.site_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM btp_delivery_notes d WHERE d.site_id = s.id)
  AND NOT EXISTS (
    SELECT 1 FROM btp_site_expenses e WHERE e.site_id = s.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM btp_labor_entries l WHERE l.site_id = s.id
  );

ALTER TABLE btp_delivery_notes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'validated'
    CHECK (status IN ('draft', 'validated'));

-- Dédoublonner les références BL existantes (conserve le plus ancien)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, reference
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM btp_delivery_notes
)
UPDATE btp_delivery_notes n
SET reference = n.reference || '-' || upper(substr(replace(n.id::text, '-', ''), 1, 6))
FROM ranked r
WHERE n.id = r.id AND r.rn > 1;

-- Fusionner les lignes stock en double (même article + même dépôt/chantier)
WITH grouped AS (
  SELECT
    organization_id,
    item_name,
    COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid) AS site_key,
    (array_agg(id ORDER BY created_at ASC NULLS LAST, id ASC))[1] AS keep_id,
    SUM(quantity)::numeric AS total_qty,
    array_agg(id ORDER BY created_at ASC NULLS LAST, id ASC) AS all_ids
  FROM btp_stock
  GROUP BY organization_id, item_name, COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid)
  HAVING COUNT(*) > 1
),
dupes AS (
  SELECT g.keep_id, u.dupe_id, g.total_qty
  FROM grouped g
  CROSS JOIN LATERAL unnest(g.all_ids[2:array_length(g.all_ids, 1)]) AS u(dupe_id)
)
UPDATE btp_stock s
SET quantity = d.total_qty
FROM dupes d
WHERE s.id = d.keep_id;

WITH grouped AS (
  SELECT
    organization_id,
    item_name,
    COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid) AS site_key,
    (array_agg(id ORDER BY created_at ASC NULLS LAST, id ASC))[1] AS keep_id,
    array_agg(id ORDER BY created_at ASC NULLS LAST, id ASC) AS all_ids
  FROM btp_stock
  GROUP BY organization_id, item_name, COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid)
  HAVING COUNT(*) > 1
),
dupes AS (
  SELECT g.keep_id, u.dupe_id
  FROM grouped g
  CROSS JOIN LATERAL unnest(g.all_ids[2:array_length(g.all_ids, 1)]) AS u(dupe_id)
)
UPDATE btp_stock_movements m
SET stock_id = d.keep_id
FROM dupes d
WHERE m.stock_id = d.dupe_id;

WITH grouped AS (
  SELECT
    organization_id,
    item_name,
    COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid) AS site_key,
    (array_agg(id ORDER BY created_at ASC NULLS LAST, id ASC))[1] AS keep_id,
    array_agg(id ORDER BY created_at ASC NULLS LAST, id ASC) AS all_ids
  FROM btp_stock
  GROUP BY organization_id, item_name, COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid)
  HAVING COUNT(*) > 1
),
dupes AS (
  SELECT g.keep_id, u.dupe_id
  FROM grouped g
  CROSS JOIN LATERAL unnest(g.all_ids[2:array_length(g.all_ids, 1)]) AS u(dupe_id)
)
DELETE FROM btp_stock s
USING dupes d
WHERE s.id = d.dupe_id;

CREATE UNIQUE INDEX IF NOT EXISTS btp_delivery_notes_org_ref_unique
  ON btp_delivery_notes (organization_id, reference);

CREATE UNIQUE INDEX IF NOT EXISTS btp_stock_org_item_site_unique
  ON btp_stock (
    organization_id,
    item_name,
    COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Mouvement stock atomique (insert mouvement + mise à jour quantité)
CREATE OR REPLACE FUNCTION btp_apply_stock_movement(
  p_org_id UUID,
  p_stock_id UUID,
  p_movement_type TEXT,
  p_quantity NUMERIC,
  p_site_id UUID DEFAULT NULL,
  p_personnel_id UUID DEFAULT NULL,
  p_requester_name TEXT DEFAULT NULL,
  p_delivery_note_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_movement_date DATE DEFAULT CURRENT_DATE,
  p_created_by UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current NUMERIC;
  v_next NUMERIC;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide.';
  END IF;

  SELECT quantity INTO v_current
  FROM btp_stock
  WHERE id = p_stock_id AND organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Article de stock introuvable.';
  END IF;

  IF p_movement_type = 'in' THEN
    v_next := v_current + p_quantity;
  ELSIF p_movement_type = 'out' THEN
    v_next := v_current - p_quantity;
    IF v_next < 0 THEN
      RAISE EXCEPTION 'Stock insuffisant pour cette sortie.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Type de mouvement invalide.';
  END IF;

  INSERT INTO btp_stock_movements (
    organization_id, stock_id, movement_type, quantity,
    site_id, personnel_id, requester_name, delivery_note_id,
    notes, movement_date, created_by
  ) VALUES (
    p_org_id, p_stock_id, p_movement_type, p_quantity,
    p_site_id, p_personnel_id, p_requester_name, p_delivery_note_id,
    p_notes, p_movement_date, p_created_by
  );

  UPDATE btp_stock
  SET quantity = v_next, last_updated = now()
  WHERE id = p_stock_id;
END;
$$;
