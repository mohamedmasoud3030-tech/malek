-- The application has called only the JSONB facade since the payment-backed
-- receipt void flow was hardened. Production inspection on 2026-07-18 found
-- no database caller and no API-role EXECUTE grant for this positional
-- overload. Drop the exact signature without CASCADE so an unexpected live
-- dependency blocks the migration instead of being removed implicitly.

DO $$
BEGIN
  IF to_regprocedure('public.void_receipt_atomic(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Required void_receipt_atomic(jsonb) facade is missing';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.void_receipt_atomic(text, bigint, jsonb, jsonb);

DO $$
BEGIN
  IF to_regprocedure('public.void_receipt_atomic(text,bigint,jsonb,jsonb)') IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy void_receipt_atomic overload still exists';
  END IF;

  IF to_regprocedure('public.void_receipt_atomic(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Required void_receipt_atomic(jsonb) facade was removed';
  END IF;
END
$$;
