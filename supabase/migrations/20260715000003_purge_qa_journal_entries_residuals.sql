-- =============================================================================
-- Migration: 20260715000003_purge_qa_journal_entries_residuals
-- Date: 2026-07-12 (Applied with 2026-07-15 namespace sequence)
-- Risk: LOW/MEDIUM (Strict validation, deletes exactly two targeted QA orphan rows)
--
-- Purpose:
--   Purges the two residual orphan QA journal entries (PAY-testqapaymen-D and 
--   PAY-testqapaymen-C) that were left behind in the database because they 
--   did not carry standard test prefixes or Arabic test markers.
--
-- Strict Validation Guards (Before DELETE):
--   1. If neither target exists, succeed as an idempotent no-op.
--   2. If any target exists, verify both DEBIT and CREDIT rows with exact values.
--   2. Verify source_id matches 'cef11264-fcb2-4f29-81c5-0b0b99e156a4' (QA receipt).
--   3. Verify entity_id matches 'b81853ee-b305-43f8-a7bc-39aed420781a' (QA contract).
--   4. Verify both entries represent exactly 150.00 amount.
--   5. Verify that exactly 2 rows match the total target deletion criteria.
--   6. Abort transaction with an exception if any guard fails.
--
-- Rollback:
--   Data deletion cannot be automatically undone. Re-inserting these rows
--   is possible but discouraged as they are historical test junk.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_count integer;
  v_debit_row record;
  v_credit_row record;
BEGIN
  -- Idempotency and blast-radius guard: absence is already-clean success;
  -- partial or additional matches remain a hard failure.
  SELECT count(*) INTO v_count
  FROM public.journal_entries
  WHERE (no = 'PAY-testqapaymen-D' OR no = 'PAY-testqapaymen-C')
     OR (source_id = 'cef11264-fcb2-4f29-81c5-0b0b99e156a4' AND entity_id = 'b81853ee-b305-43f8-a7bc-39aed420781a');

  IF v_count = 0 THEN
    RAISE NOTICE 'QA residual journal entries are already absent; no cleanup required.';
    RETURN;
  END IF;

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'QA cleanup validation failed: Expected either 0 or exactly 2 rows matching target criteria, found %', v_count;
  END IF;

  -- 1. Retrieve and validate the DEBIT journal entry
  SELECT * INTO v_debit_row
  FROM public.journal_entries
  WHERE no = 'PAY-testqapaymen-D'
    AND source_id = 'cef11264-fcb2-4f29-81c5-0b0b99e156a4'
    AND entity_id = 'b81853ee-b305-43f8-a7bc-39aed420781a';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QA cleanup validation failed: DEBIT journal entry PAY-testqapaymen-D not found with expected source_id and entity_id';
  END IF;

  IF v_debit_row.type <> 'DEBIT' THEN
    RAISE EXCEPTION 'QA cleanup validation failed: Expected type DEBIT for entry PAY-testqapaymen-D, got %', v_debit_row.type;
  END IF;

  IF v_debit_row.amount <> 150.00 THEN
    RAISE EXCEPTION 'QA cleanup validation failed: Expected amount 150.00 for PAY-testqapaymen-D, got %', v_debit_row.amount;
  END IF;

  -- 2. Retrieve and validate the CREDIT journal entry
  SELECT * INTO v_credit_row
  FROM public.journal_entries
  WHERE no = 'PAY-testqapaymen-C'
    AND source_id = 'cef11264-fcb2-4f29-81c5-0b0b99e156a4'
    AND entity_id = 'b81853ee-b305-43f8-a7bc-39aed420781a';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QA cleanup validation failed: CREDIT journal entry PAY-testqapaymen-C not found with expected source_id and entity_id';
  END IF;

  IF v_credit_row.type <> 'CREDIT' THEN
    RAISE EXCEPTION 'QA cleanup validation failed: Expected type CREDIT for entry PAY-testqapaymen-C, got %', v_credit_row.type;
  END IF;

  IF v_credit_row.amount <> 150.00 THEN
    RAISE EXCEPTION 'QA cleanup validation failed: Expected amount 150.00 for PAY-testqapaymen-C, got %', v_credit_row.amount;
  END IF;

  -- 3. Purge the validated rows
  DELETE FROM public.journal_entries
  WHERE id IN (v_debit_row.id, v_credit_row.id);

  RAISE NOTICE 'QA residual journal entries validated and purged successfully. Affected rows: 2.';
END $$;

COMMIT;
