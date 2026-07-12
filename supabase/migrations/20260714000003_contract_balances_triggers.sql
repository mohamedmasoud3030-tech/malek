-- =============================================================================
-- Migration: Contract Balances Triggers
-- Phase: 2 (Wave 1 - Double-Entry Accounting Completion)
-- Date: 2026-07-13
--
-- Purpose:
-- Maintain contract_balances incrementally via triggers instead of relying
-- solely on recalculate_all_balances(). This ensures balances are always
-- current without manual intervention.
--
-- Triggers:
--   1. invoices INSERT/UPDATE/DELETE → update total_invoiced and balance_due
--   2. receipt_allocations INSERT/DELETE → update total_paid and balance_due
--
-- Fixes: A-03
--
-- Risk: MEDIUM - adds trigger overhead to invoice/payment paths
-- Rollback: See DROP statements at end of file
--
-- =============================================================================
-- ROLLBACK SCRIPT:
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_invoices_update_contract_balance ON public.invoices;
-- DROP TRIGGER IF EXISTS trg_receipt_allocations_update_contract_balance ON public.receipt_allocations;
-- DROP FUNCTION IF EXISTS public.update_contract_balance_from_invoice();
-- DROP FUNCTION IF EXISTS public.update_contract_balance_from_allocation();
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Create function to update contract_balances from invoice changes
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_contract_balance_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id uuid;
  v_total_invoiced numeric;
  v_total_paid numeric;
  v_tenant_id uuid;
  v_unit_id uuid;
BEGIN
  -- Determine which contract_id to update
  IF TG_OP = 'DELETE' THEN
    v_contract_id := OLD.contract_id;
  ELSE
    v_contract_id := NEW.contract_id;
  END IF;

  -- Calculate totals for this contract
  SELECT 
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    c.tenant_id,
    c.unit_id
  INTO v_total_invoiced, v_total_paid, v_tenant_id, v_unit_id
  FROM public.contracts c
  LEFT JOIN public.invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
  WHERE c.id = v_contract_id
  GROUP BY c.tenant_id, c.unit_id;

  -- Upsert contract_balances
  INSERT INTO public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at
  ) VALUES (
    v_contract_id,
    v_tenant_id,
    v_unit_id,
    v_total_invoiced,
    v_total_paid,
    v_total_invoiced - v_total_paid,
    now()
  )
  ON CONFLICT (contract_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    unit_id = EXCLUDED.unit_id,
    total_invoiced = EXCLUDED.total_invoiced,
    total_paid = EXCLUDED.total_paid,
    balance_due = EXCLUDED.balance_due,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =============================================================================
-- STEP 2: Create function to update contract_balances from allocation changes
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_contract_balance_from_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id uuid;
  v_total_invoiced numeric;
  v_total_paid numeric;
  v_tenant_id uuid;
  v_unit_id uuid;
BEGIN
  -- Get contract_id from the invoice referenced by this allocation
  IF TG_OP = 'DELETE' THEN
    SELECT i.contract_id INTO v_contract_id
    FROM public.invoices i
    WHERE i.id = OLD.invoice_id;
  ELSE
    SELECT i.contract_id INTO v_contract_id
    FROM public.invoices i
    WHERE i.id = NEW.invoice_id;
  END IF;

  IF v_contract_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate totals for this contract
  SELECT 
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    c.tenant_id,
    c.unit_id
  INTO v_total_invoiced, v_total_paid, v_tenant_id, v_unit_id
  FROM public.contracts c
  LEFT JOIN public.invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
  WHERE c.id = v_contract_id
  GROUP BY c.tenant_id, c.unit_id;

  -- Upsert contract_balances
  INSERT INTO public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at
  ) VALUES (
    v_contract_id,
    v_tenant_id,
    v_unit_id,
    v_total_invoiced,
    v_total_paid,
    v_total_invoiced - v_total_paid,
    now()
  )
  ON CONFLICT (contract_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    unit_id = EXCLUDED.unit_id,
    total_invoiced = EXCLUDED.total_invoiced,
    total_paid = EXCLUDED.total_paid,
    balance_due = EXCLUDED.balance_due,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =============================================================================
-- STEP 3: Create triggers
-- =============================================================================
DROP TRIGGER IF EXISTS trg_invoices_update_contract_balance ON public.invoices;
CREATE TRIGGER trg_invoices_update_contract_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contract_balance_from_invoice();

DROP TRIGGER IF EXISTS trg_receipt_allocations_update_contract_balance ON public.receipt_allocations;
CREATE TRIGGER trg_receipt_allocations_update_contract_balance
  AFTER INSERT OR DELETE ON public.receipt_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contract_balance_from_allocation();

-- =============================================================================
-- STEP 4: Backfill existing contract_balances
-- =============================================================================
INSERT INTO public.contract_balances (
  contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at
)
SELECT
  c.id,
  c.tenant_id,
  c.unit_id,
  COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
  COALESCE(SUM(i.paid_amount), 0),
  COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0) - COALESCE(SUM(i.paid_amount), 0),
  now()
FROM public.contracts c
LEFT JOIN public.invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.tenant_id, c.unit_id
ON CONFLICT (contract_id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  unit_id = EXCLUDED.unit_id,
  total_invoiced = EXCLUDED.total_invoiced,
  total_paid = EXCLUDED.total_paid,
  balance_due = EXCLUDED.balance_due,
  updated_at = now();

-- =============================================================================
-- STEP 5: Set ownership and grants
-- =============================================================================
ALTER FUNCTION public.update_contract_balance_from_invoice() OWNER TO postgres;
ALTER FUNCTION public.update_contract_balance_from_allocation() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.update_contract_balance_from_invoice() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_contract_balance_from_invoice() TO service_role;

REVOKE ALL ON FUNCTION public.update_contract_balance_from_allocation() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_contract_balance_from_allocation() TO service_role;

-- =============================================================================
-- STEP 6: Validation
-- =============================================================================
DO $$
DECLARE
  v_invoice_trigger_exists boolean;
  v_allocation_trigger_exists boolean;
  v_balance_count integer;
BEGIN
  -- Verify triggers exist
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_invoices_update_contract_balance'
      AND tgrelid = 'public.invoices'::regclass
  ) INTO v_invoice_trigger_exists;

  SELECT EXISTS(
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_receipt_allocations_update_contract_balance'
      AND tgrelid = 'public.receipt_allocations'::regclass
  ) INTO v_allocation_trigger_exists;

  IF NOT v_invoice_trigger_exists THEN
    RAISE EXCEPTION 'Migration failed: invoice trigger not created';
  END IF;

  IF NOT v_allocation_trigger_exists THEN
    RAISE EXCEPTION 'Migration failed: allocation trigger not created';
  END IF;

  -- Verify backfill
  SELECT COUNT(*) INTO v_balance_count FROM public.contract_balances;
  
  RAISE NOTICE '✓ Contract balances triggers created and % existing contracts backfilled', v_balance_count;
END $$;

COMMIT;
