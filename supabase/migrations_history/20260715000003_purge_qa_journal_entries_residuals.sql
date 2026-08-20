-- =============================================================================
-- Migration: 20260715000003_purge_qa_journal_entries_residuals
-- Date: 2026-07-12 (Applied with 2026-07-15 namespace sequence)
-- Risk: LOW/MEDIUM (idempotent, strictly targeted QA cleanup)
--
-- Deletes the two known residual QA journal rows only when both exact rows are
-- present. A clean replay or an environment where the cleanup already ran is a
-- valid no-op. Partial or broadened matches still fail closed.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_count integer;
  v_debit_row record;
  v_credit_row record;
BEGIN
  SELECT count(*)
    INTO v_count
  FROM public.journal_entries
  WHERE no IN ('PAY-testqapaymen-D', 'PAY-testqapaymen-C')
     OR (
       source_id = 'cef11264-fcb2-4f29-81c5-0b0b99e156a4'
       AND entity_id = 'b81853ee-b305-43f8-a7bc-39aed420781a'
     );

  IF v_count = 0 THEN
    RAISE NOTICE 'QA residual journal entries are already absent; no cleanup required.';
  ELSE
    IF v_count <> 2 THEN
      RAISE EXCEPTION
        'QA cleanup validation failed: Expected zero or exactly 2 rows matching target criteria, found %',
        v_count;
    END IF;

    SELECT *
      INTO v_debit_row
    FROM public.journal_entries
    WHERE no = 'PAY-testqapaymen-D'
      AND source_id = 'cef11264-fcb2-4f29-81c5-0b0b99e156a4'
      AND entity_id = 'b81853ee-b305-43f8-a7bc-39aed420781a';

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'QA cleanup validation failed: DEBIT journal entry PAY-testqapaymen-D not found with expected source_id and entity_id';
    END IF;

    IF v_debit_row.type <> 'DEBIT' OR v_debit_row.amount <> 150.00 THEN
      RAISE EXCEPTION
        'QA cleanup validation failed: invalid DEBIT row type/amount for PAY-testqapaymen-D';
    END IF;

    SELECT *
      INTO v_credit_row
    FROM public.journal_entries
    WHERE no = 'PAY-testqapaymen-C'
      AND source_id = 'cef11264-fcb2-4f29-81c5-0b0b99e156a4'
      AND entity_id = 'b81853ee-b305-43f8-a7bc-39aed420781a';

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'QA cleanup validation failed: CREDIT journal entry PAY-testqapaymen-C not found with expected source_id and entity_id';
    END IF;

    IF v_credit_row.type <> 'CREDIT' OR v_credit_row.amount <> 150.00 THEN
      RAISE EXCEPTION
        'QA cleanup validation failed: invalid CREDIT row type/amount for PAY-testqapaymen-C';
    END IF;

    DELETE FROM public.journal_entries
    WHERE id IN (v_debit_row.id, v_credit_row.id);

    RAISE NOTICE 'QA residual journal entries validated and purged successfully. Affected rows: 2.';
  END IF;
END
$$;

COMMIT;
