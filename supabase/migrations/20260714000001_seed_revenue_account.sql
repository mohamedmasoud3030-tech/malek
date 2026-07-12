-- =============================================================================
-- Migration: Seed Revenue and VAT Payable Accounts
-- Phase: 2 (Wave 1 - Double-Entry Accounting Completion)
-- Date: 2026-07-13
-- 
-- Purpose:
-- Add missing accounts required for invoice journal entries:
--   - 4000: Rental Revenue (credit when invoice created)
--   - 2100: VAT Payable (credit when invoice has tax)
--
-- Current chart of accounts (before this migration):
--   1111 = Cash
--   1201 = Tenant Receivables
--   6100 = Operating Expenses
--
-- Chart of accounts (after this migration):
--   1111 = Cash
--   1201 = Tenant Receivables
--   2100 = VAT Payable (NEW)
--   4000 = Rental Revenue (NEW)
--   6100 = Operating Expenses
--
-- Risk: LOW - additive only, uses ON CONFLICT DO NOTHING
-- Rollback: DELETE FROM accounts WHERE id IN ('4000', '2100');
-- =============================================================================

BEGIN;

-- Seed Rental Revenue account
INSERT INTO public.accounts (id, no, name)
VALUES ('4000', '4000', 'Rental Revenue')
ON CONFLICT (id) DO NOTHING;

-- Seed VAT Payable account
INSERT INTO public.accounts (id, no, name)
VALUES ('2100', '2100', 'VAT Payable')
ON CONFLICT (id) DO NOTHING;

-- Validation: verify both accounts exist
DO $$
DECLARE
  v_revenue_exists boolean;
  v_vat_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.accounts WHERE id = '4000') INTO v_revenue_exists;
  SELECT EXISTS(SELECT 1 FROM public.accounts WHERE id = '2100') INTO v_vat_exists;
  
  IF NOT v_revenue_exists THEN
    RAISE EXCEPTION 'Migration failed: account 4000 (Rental Revenue) not created';
  END IF;
  
  IF NOT v_vat_exists THEN
    RAISE EXCEPTION 'Migration failed: account 2100 (VAT Payable) not created';
  END IF;
  
  RAISE NOTICE '✓ Accounts 4000 (Rental Revenue) and 2100 (VAT Payable) seeded successfully';
END $$;

COMMIT;
