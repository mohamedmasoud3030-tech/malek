-- =============================================================================
-- Migration: Contract Balances Triggers
-- Phase: 2 (Wave 1 - Double-Entry Accounting Completion)
-- Date: 2026-07-13
--
-- Maintains contract_balances incrementally from invoice and allocation changes.
-- The migration supports both repository-backed identifier layouts:
--   - clean baseline: uuid contract/tenant/unit identifiers
--   - historical production: text contract/tenant identifiers and uuid unit ids
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_contract_id_type text;
  v_balance_contract_id_type text;
  v_contract_tenant_id_type text;
  v_balance_tenant_id_type text;
  v_contract_unit_id_type text;
  v_balance_unit_id_type text;
BEGIN
  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_contract_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'contracts'
    AND attribute.attname = 'id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_balance_contract_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'contract_balances'
    AND attribute.attname = 'contract_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_contract_tenant_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'contracts'
    AND attribute.attname = 'tenant_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_balance_tenant_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'contract_balances'
    AND attribute.attname = 'tenant_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_contract_unit_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'contracts'
    AND attribute.attname = 'unit_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_balance_unit_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'contract_balances'
    AND attribute.attname = 'unit_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_contract_id_type IS NULL OR v_balance_contract_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot install contract balance triggers: contract identifier columns were not found';
  END IF;

  IF v_contract_tenant_id_type IS NULL OR v_balance_tenant_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot install contract balance triggers: tenant identifier columns were not found';
  END IF;

  IF v_contract_unit_id_type IS NULL OR v_balance_unit_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot install contract balance triggers: unit identifier columns were not found';
  END IF;

  IF v_contract_id_type NOT IN ('uuid', 'text')
     OR v_balance_contract_id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION
      'Cannot install contract balance triggers: unsupported contract identifier types % and %',
      v_contract_id_type,
      v_balance_contract_id_type;
  END IF;

  IF v_contract_tenant_id_type NOT IN ('uuid', 'text')
     OR v_balance_tenant_id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION
      'Cannot install contract balance triggers: unsupported tenant identifier types % and %',
      v_contract_tenant_id_type,
      v_balance_tenant_id_type;
  END IF;

  IF v_contract_unit_id_type NOT IN ('uuid', 'text')
     OR v_balance_unit_id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION
      'Cannot install contract balance triggers: unsupported unit identifier types % and %',
      v_contract_unit_id_type,
      v_balance_unit_id_type;
  END IF;

  IF v_contract_id_type <> v_balance_contract_id_type THEN
    RAISE EXCEPTION
      'Cannot install contract balance triggers: contracts.id type % differs from contract_balances.contract_id type %',
      v_contract_id_type,
      v_balance_contract_id_type;
  END IF;

  IF v_contract_tenant_id_type <> v_balance_tenant_id_type THEN
    RAISE EXCEPTION
      'Cannot install contract balance triggers: contracts.tenant_id type % differs from contract_balances.tenant_id type %',
      v_contract_tenant_id_type,
      v_balance_tenant_id_type;
  END IF;

  IF v_contract_unit_id_type <> v_balance_unit_id_type THEN
    RAISE EXCEPTION
      'Cannot install contract balance triggers: contracts.unit_id type % differs from contract_balances.unit_id type %',
      v_contract_unit_id_type,
      v_balance_unit_id_type;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.update_contract_balance_from_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id public.contract_balances.contract_id%TYPE;
  v_total_invoiced numeric;
  v_total_paid numeric;
  v_tenant_id public.contract_balances.tenant_id%TYPE;
  v_unit_id public.contract_balances.unit_id%TYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contract_id := OLD.contract_id;
  ELSE
    v_contract_id := NEW.contract_id;
  END IF;

  IF v_contract_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COALESCE(SUM(invoice.amount + COALESCE(invoice.tax_amount, 0)), 0),
    COALESCE(SUM(invoice.paid_amount), 0),
    contract_record.tenant_id,
    contract_record.unit_id
  INTO v_total_invoiced, v_total_paid, v_tenant_id, v_unit_id
  FROM public.contracts AS contract_record
  LEFT JOIN public.invoices AS invoice
    ON invoice.contract_id = contract_record.id
   AND invoice.deleted_at IS NULL
  WHERE contract_record.id = v_contract_id
  GROUP BY contract_record.tenant_id, contract_record.unit_id;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.contract_balances (
    contract_id,
    tenant_id,
    unit_id,
    total_invoiced,
    total_paid,
    balance_due,
    updated_at
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

CREATE OR REPLACE FUNCTION public.update_contract_balance_from_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract_id public.contract_balances.contract_id%TYPE;
  v_total_invoiced numeric;
  v_total_paid numeric;
  v_tenant_id public.contract_balances.tenant_id%TYPE;
  v_unit_id public.contract_balances.unit_id%TYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT invoice.contract_id
      INTO v_contract_id
    FROM public.invoices AS invoice
    WHERE invoice.id = OLD.invoice_id;
  ELSE
    SELECT invoice.contract_id
      INTO v_contract_id
    FROM public.invoices AS invoice
    WHERE invoice.id = NEW.invoice_id;
  END IF;

  IF v_contract_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COALESCE(SUM(invoice.amount + COALESCE(invoice.tax_amount, 0)), 0),
    COALESCE(SUM(invoice.paid_amount), 0),
    contract_record.tenant_id,
    contract_record.unit_id
  INTO v_total_invoiced, v_total_paid, v_tenant_id, v_unit_id
  FROM public.contracts AS contract_record
  LEFT JOIN public.invoices AS invoice
    ON invoice.contract_id = contract_record.id
   AND invoice.deleted_at IS NULL
  WHERE contract_record.id = v_contract_id
  GROUP BY contract_record.tenant_id, contract_record.unit_id;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.contract_balances (
    contract_id,
    tenant_id,
    unit_id,
    total_invoiced,
    total_paid,
    balance_due,
    updated_at
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

INSERT INTO public.contract_balances (
  contract_id,
  tenant_id,
  unit_id,
  total_invoiced,
  total_paid,
  balance_due,
  updated_at
)
SELECT
  contract_record.id,
  contract_record.tenant_id,
  contract_record.unit_id,
  COALESCE(SUM(invoice.amount + COALESCE(invoice.tax_amount, 0)), 0),
  COALESCE(SUM(invoice.paid_amount), 0),
  COALESCE(SUM(invoice.amount + COALESCE(invoice.tax_amount, 0)), 0)
    - COALESCE(SUM(invoice.paid_amount), 0),
  now()
FROM public.contracts AS contract_record
LEFT JOIN public.invoices AS invoice
  ON invoice.contract_id = contract_record.id
 AND invoice.deleted_at IS NULL
WHERE contract_record.deleted_at IS NULL
GROUP BY contract_record.id, contract_record.tenant_id, contract_record.unit_id
ON CONFLICT (contract_id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  unit_id = EXCLUDED.unit_id,
  total_invoiced = EXCLUDED.total_invoiced,
  total_paid = EXCLUDED.total_paid,
  balance_due = EXCLUDED.balance_due,
  updated_at = now();

ALTER FUNCTION public.update_contract_balance_from_invoice() OWNER TO postgres;
ALTER FUNCTION public.update_contract_balance_from_allocation() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.update_contract_balance_from_invoice() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_contract_balance_from_invoice() TO service_role;

REVOKE ALL ON FUNCTION public.update_contract_balance_from_allocation() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_contract_balance_from_allocation() TO service_role;

DO $$
DECLARE
  v_invoice_trigger_exists boolean;
  v_allocation_trigger_exists boolean;
  v_balance_count bigint;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_invoices_update_contract_balance'
      AND tgrelid = 'public.invoices'::regclass
      AND NOT tgisinternal
  ) INTO v_invoice_trigger_exists;

  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_receipt_allocations_update_contract_balance'
      AND tgrelid = 'public.receipt_allocations'::regclass
      AND NOT tgisinternal
  ) INTO v_allocation_trigger_exists;

  IF NOT v_invoice_trigger_exists THEN
    RAISE EXCEPTION 'Migration failed: invoice trigger not created';
  END IF;

  IF NOT v_allocation_trigger_exists THEN
    RAISE EXCEPTION 'Migration failed: allocation trigger not created';
  END IF;

  SELECT count(*) INTO v_balance_count FROM public.contract_balances;
  RAISE NOTICE 'Contract balance triggers created and % existing contracts backfilled', v_balance_count;
END
$$;

COMMIT;
