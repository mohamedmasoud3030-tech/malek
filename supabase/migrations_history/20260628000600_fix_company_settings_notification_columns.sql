-- Migration: fix_company_settings_notification_columns
--
-- Confirmed live gap (Task 2 verification 2026-06-28):
--   notification_email_enabled and notification_sms_enabled declared non-nullable in database.ts
--   but did not exist in the live schema.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='company_settings'
      AND column_name='notification_email_enabled'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN notification_email_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='company_settings'
      AND column_name='notification_sms_enabled'
  ) THEN
    ALTER TABLE public.company_settings
      ADD COLUMN notification_sms_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;
