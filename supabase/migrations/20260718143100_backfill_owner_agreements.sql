-- Data-only repair for live rows created before owner_agreements became a
-- required contract invariant. This migration is idempotent and never
-- overwrites an existing agreement.

UPDATE public.owners
SET full_name = COALESCE(NULLIF(btrim(full_name), ''), NULLIF(btrim(display_name), ''), name),
    name = COALESCE(NULLIF(btrim(full_name), ''), NULLIF(btrim(display_name), ''), name),
    updated_at = now()
WHERE full_name IS DISTINCT FROM COALESCE(NULLIF(btrim(full_name), ''), NULLIF(btrim(display_name), ''), name)
   OR name IS DISTINCT FROM COALESCE(NULLIF(btrim(full_name), ''), NULLIF(btrim(display_name), ''), name);

UPDATE public.properties
SET title = COALESCE(NULLIF(btrim(title), ''), name),
    name = COALESCE(NULLIF(btrim(title), ''), name),
    updated_at = now()
WHERE title IS DISTINCT FROM COALESCE(NULLIF(btrim(title), ''), name)
   OR name IS DISTINCT FROM COALESCE(NULLIF(btrim(title), ''), name);

INSERT INTO public.owner_agreements (
  owner_id,
  property_id,
  agreement_type,
  commission_type,
  commission_value,
  starts_on,
  ends_on,
  notes
)
SELECT
  p.owner_id,
  p.id,
  'property_management',
  CASE WHEN o.commission_type IN ('RATE', 'FIXED_MONTHLY') THEN o.commission_type ELSE 'RATE' END,
  CASE
    WHEN o.commission_type = 'RATE' THEN greatest(0, least(100, COALESCE(o.commission_value, 0)))
    ELSE greatest(0, COALESCE(o.commission_value, 0))
  END,
  CASE
    WHEN o.management_contract_date ~ '^\d{4}-\d{2}-\d{2}$' THEN o.management_contract_date::date
    ELSE current_date
  END,
  NULL,
  'Backfilled from the legacy owner management contract fields.'
FROM public.properties p
JOIN public.owners o ON o.id = p.owner_id
WHERE p.deleted_at IS NULL
  AND o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.owner_agreements oa WHERE oa.property_id = p.id
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.deleted_at IS NULL
      AND p.owner_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.owner_agreements oa WHERE oa.property_id = p.id)
  ) THEN
    RAISE EXCEPTION 'Owner agreement backfill incomplete: at least one managed property remains uncovered.';
  END IF;
END;
$$;
