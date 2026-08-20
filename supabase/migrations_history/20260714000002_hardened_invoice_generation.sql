-- =============================================================================
-- Migration: Hardened Invoice Generation with Journal Entries
-- Phase: 2 (Wave 1 - Double-Entry Accounting Completion)
-- Date: 2026-07-13
--
-- Purpose:
-- Rewrite generate_invoices_from_active_contracts() to:
--   1. Create journal entries for each invoice (Dr AR, Cr Revenue, Cr VAT)
--   2. Add payment_cycle awareness (monthly/quarterly/semi_annual/annual)
--   3. Add advisory locking to prevent race conditions
--   4. Add batch_id for journal entry grouping
--   5. Add audit log entry
--   6. Use unique partial index for dedup (added in migration 9)
--
-- Fixes: A-01, A-01b, A-01c, D-09
--
-- Risk: MEDIUM - rewrites core financial function
-- Rollback: See ORIGINAL FUNCTION BODY below
--
-- =============================================================================
-- ORIGINAL FUNCTION BODY (for rollback):
-- =============================================================================
-- create or replace function public.generate_invoices_from_active_contracts()
-- returns integer
-- language plpgsql
-- security definer
-- set search_path = public, pg_temp
-- as $$
-- declare
--   v_count integer;
-- begin
--   if auth.uid() is null or not public.is_admin_or_manager() then
--     raise exception 'ADMIN or MANAGER role is required to generate invoices' using errcode = '42501';
--   end if;
--
--   insert into public.invoices (contract_id, issue_date, due_date, amount, status)
--   select c.id, current_date, current_date, c.rent_amount, 'UNPAID'
--   from public.contracts c
--   where c.deleted_at is null
--     and lower(c.status) = 'active'
--     and not exists (
--       select 1
--       from public.invoices i
--       where i.contract_id = c.id
--         and i.issue_date = current_date
--         and i.deleted_at is null
--     );
--
--   get diagnostics v_count = row_count;
--   return v_count;
-- end;
-- $$;
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Add unique partial index for invoice dedup (prevents race conditions)
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS invoices_contract_issue_date_unique
  ON public.invoices (contract_id, issue_date)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- STEP 2: Rewrite generate_invoices_from_active_contracts
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_invoices_from_active_contracts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract record;
  v_invoice_id uuid;
  v_batch_id uuid;
  v_tax_rate numeric;
  v_tax_amount numeric;
  v_total_amount numeric;
  v_ar_account_id text;
  v_revenue_account_id text;
  v_vat_account_id text;
  v_count integer := 0;
  v_period_start date;
  v_period_end date;
  v_invoice_exists boolean;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to generate invoices' USING ERRCODE = '42501';
  END IF;

  -- Get account IDs
  SELECT id INTO v_ar_account_id FROM public.accounts WHERE no = '1201' LIMIT 1;
  SELECT id INTO v_revenue_account_id FROM public.accounts WHERE no = '4000' LIMIT 1;
  SELECT id INTO v_vat_account_id FROM public.accounts WHERE no = '2100' LIMIT 1;

  IF v_ar_account_id IS NULL OR v_revenue_account_id IS NULL THEN
    RAISE EXCEPTION 'Required accounts not configured (1201 or 4000)';
  END IF;

  -- Get VAT rate from company_settings (if VAT enabled)
  SELECT CASE WHEN vat_enabled THEN COALESCE(vat_rate, 0) ELSE 0 END
    INTO v_tax_rate
    FROM public.company_settings
    LIMIT 1;

  IF v_tax_rate IS NULL THEN
    v_tax_rate := 0;
  END IF;

  -- Loop through active contracts with advisory lock
  FOR v_contract IN
    SELECT c.id, c.rent_amount, c.payment_cycle, c.start_date
    FROM public.contracts c
    WHERE c.deleted_at IS NULL
      AND lower(c.status) = 'active'
    ORDER BY c.id
  LOOP
    -- Advisory lock on contract_id to prevent concurrent invoice generation
    PERFORM pg_advisory_xact_lock(hashtext('invoice_generation:' || v_contract.id::text));

    -- Calculate current billing period based on payment_cycle
    CASE v_contract.payment_cycle
      WHEN 'monthly' THEN
        v_period_start := date_trunc('month', current_date)::date;
        v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
      WHEN 'quarterly' THEN
        v_period_start := date_trunc('quarter', current_date)::date;
        v_period_end := (date_trunc('quarter', current_date) + interval '3 months' - interval '1 day')::date;
      WHEN 'semi_annual' THEN
        -- 6-month periods: Jan-Jun, Jul-Dec
        IF EXTRACT(MONTH FROM current_date) <= 6 THEN
          v_period_start := make_date(EXTRACT(YEAR FROM current_date)::int, 1, 1);
          v_period_end := make_date(EXTRACT(YEAR FROM current_date)::int, 6, 30);
        ELSE
          v_period_start := make_date(EXTRACT(YEAR FROM current_date)::int, 7, 1);
          v_period_end := make_date(EXTRACT(YEAR FROM current_date)::int, 12, 31);
        END IF;
      WHEN 'annual' THEN
        v_period_start := date_trunc('year', current_date)::date;
        v_period_end := (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date;
      ELSE
        -- Default to monthly if unknown
        v_period_start := date_trunc('month', current_date)::date;
        v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
    END CASE;

    -- Check if invoice already exists for this period
    SELECT EXISTS(
      SELECT 1 FROM public.invoices i
      WHERE i.contract_id = v_contract.id
        AND i.issue_date >= v_period_start
        AND i.issue_date <= v_period_end
        AND i.deleted_at IS NULL
    ) INTO v_invoice_exists;

    IF v_invoice_exists THEN
      -- Already invoiced this period, skip
      CONTINUE;
    END IF;

    -- Calculate tax
    v_tax_amount := round(v_contract.rent_amount * v_tax_rate / 100, 2);
    v_total_amount := v_contract.rent_amount + v_tax_amount;

    -- Generate batch_id for this invoice's journal entries
    v_batch_id := gen_random_uuid();

    -- Create invoice
    INSERT INTO public.invoices (
      contract_id, issue_date, due_date, amount, tax_amount, tax_rate, status
    ) VALUES (
      v_contract.id,
      current_date,
      current_date + interval '30 days',
      v_contract.rent_amount,
      v_tax_amount,
      v_tax_rate,
      'UNPAID'
    )
    RETURNING id INTO v_invoice_id;

    -- Create journal entries (double-entry accounting)
    -- Debit: Tenant Receivables (1201) for total amount
    INSERT INTO public.journal_entries (
      id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at
    ) VALUES (
      gen_random_uuid(),
      'INV-' || v_invoice_id::text || '-DR',
      current_date,
      v_ar_account_id,
      v_total_amount,
      'DEBIT',
      v_invoice_id,
      'invoice',
      v_invoice_id::text,
      v_batch_id,
      now()
    );

    -- Credit: Rental Revenue (4000) for base amount
    INSERT INTO public.journal_entries (
      id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at
    ) VALUES (
      gen_random_uuid(),
      'INV-' || v_invoice_id::text || '-CR-REV',
      current_date,
      v_revenue_account_id,
      v_contract.rent_amount,
      'CREDIT',
      v_invoice_id,
      'invoice',
      v_invoice_id::text,
      v_batch_id,
      now()
    );

    -- Credit: VAT Payable (2100) for tax amount (if tax > 0)
    IF v_tax_amount > 0 AND v_vat_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entries (
        id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at
      ) VALUES (
        gen_random_uuid(),
        'INV-' || v_invoice_id::text || '-CR-VAT',
        current_date,
        v_vat_account_id,
        v_tax_amount,
        'CREDIT',
        v_invoice_id,
        'invoice',
        v_invoice_id::text,
        v_batch_id,
        now()
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  -- Audit log
  IF v_count > 0 THEN
    INSERT INTO public.audit_log (
      ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
    ) VALUES (
      extract(epoch from now())::bigint,
      auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'GENERATE',
      'invoices',
      'batch',
      format('Generated %s invoices from active contracts', v_count),
      'invoices',
      jsonb_build_object('count', v_count, 'tax_rate', v_tax_rate)::text,
      now()
    );
  END IF;

  RETURN v_count;
END;
$$;

-- Preserve grants
REVOKE ALL ON FUNCTION public.generate_invoices_from_active_contracts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_invoices_from_active_contracts() TO authenticated, service_role;

-- Validation
DO $$
BEGIN
  -- Verify unique index exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'invoices' AND indexname = 'invoices_contract_issue_date_unique'
  ) THEN
    RAISE EXCEPTION 'Migration failed: unique index not created';
  END IF;

  -- Verify function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'generate_invoices_from_active_contracts'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'Migration failed: function not created';
  END IF;

  RAISE NOTICE '✓ Invoice generation hardened: journal entries + payment_cycle + locking + dedup';
END $$;

COMMIT;
