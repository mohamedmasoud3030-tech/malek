-- =============================================================================
-- Migration: Fix tenant_balances foreign key to reference people(id)
-- Retargets public.tenant_balances.tenant_id from legacy public.tenants(id)
-- to canonical public.people(id).
-- =============================================================================

-- 1. Pre-Migration Validation:
-- Count orphan rows and raise exception if any exist, requiring manual reconciliation.
DO $$
DECLARE
  v_orphan_count integer;
BEGIN
  SELECT count(*)
  INTO v_orphan_count
  FROM public.tenant_balances tb
  LEFT JOIN public.people p ON p.id::text = tb.tenant_id::text
  WHERE p.id IS NULL;

  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'Cannot apply migration: found % orphan row(s) in public.tenant_balances where tenant_id does not exist in public.people. Manual reconciliation required.', v_orphan_count;
  END IF;
END $$;

-- 2. Drop legacy constraint pointing to tenants table:
ALTER TABLE public.tenant_balances
  DROP CONSTRAINT IF EXISTS tenant_balances_tenant_fk;

-- 3. Add hardened foreign key constraint referencing people(id) with RESTRICT rule
-- (preserving financial summary history without CASCADE deletion):
ALTER TABLE public.tenant_balances
  ADD CONSTRAINT tenant_balances_tenant_id_people_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.people(id) ON DELETE RESTRICT;

-- 4. Ensure index on tenant_balances(tenant_id) exists:
CREATE INDEX IF NOT EXISTS idx_tenant_balances_tenant_id ON public.tenant_balances (tenant_id);
