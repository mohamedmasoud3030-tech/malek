-- Migration: fix_company_settings_missing_columns_and_invoice_tax_default
--
-- Confirmed live gaps (Task 2 verification 2026-06-28):
--   1. company_settings.contract_prefix   — missing; database.ts declares it NOT NULL text
--   2. company_settings.default_vat_rate  — missing; database.ts declares it NOT NULL number
--   3. invoices.tax_amount                — exists but nullable with no default; database.ts
--      declared it as non-nullable, causing silent null coercion bugs
--
-- Strategy: safe idempotent ADD COLUMN IF NOT EXISTS; backfill existing rows; align defaults.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='company_settings' AND column_name='contract_prefix'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN contract_prefix text NOT NULL DEFAULT 'CON';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='company_settings' AND column_name='default_vat_rate'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN default_vat_rate numeric(5,2) NOT NULL DEFAULT 5.0;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices' AND column_name='tax_amount'
      AND column_default IS NULL
  ) THEN
    ALTER TABLE public.invoices
      ALTER COLUMN tax_amount SET DEFAULT 0;
  END IF;
END $$;

UPDATE public.invoices
SET tax_amount = 0
WHERE tax_amount IS NULL;
