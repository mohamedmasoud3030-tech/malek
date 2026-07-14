-- =============================================================================
-- Migration: 20260715000005_post_qa_reversal_entries
-- Date: 2026-07-12
-- Risk: LOW (QA data only — posts two pre-existing draft reversal entries)
--
-- Context:
--   Migration 20260715000003 (purge_qa_journal_entries_residuals) failed
--   because posted journal entries are immutable ("Use reverse entry.").
--
--   Migration 20260715000004 (qa_journal_reversal_cleanup) correctly created
--   two offsetting reversal entries using double-entry accounting:
--     REV-QA-PAY-testqapaymen-D  (CREDIT 150, account 1111) — reverses DEBIT original
--     REV-QA-PAY-testqapaymen-C  (DEBIT  150, account 1201) — reverses CREDIT original
--
--   However, those reversal entries were left in status='draft' with
--   created_at=NULL.  The reversal is incomplete until they are posted.
--   Unposted reversals have no accounting effect.
--
-- Purpose:
--   Post the two draft reversal entries so the QA journal is fully neutralised:
--     Original DEBIT  150 (1111) + Reversal CREDIT 150 (1111) = net 0 on cash
--     Original CREDIT 150 (1201) + Reversal DEBIT  150 (1201) = net 0 on AR
--
-- Accounting principle:
--   Draft→posted is the standard lifecycle. The immutability trigger
--   (prevent_posted_journal_entry_mutation) fires on UPDATE/DELETE of *already
--   posted* rows (OLD.status = 'posted'). Updating a draft row to posted is
--   explicitly permitted.
--
-- Idempotency:
--   If both reversal entries are already posted (or do not exist), the
--   migration raises NOTICE and exits cleanly without error or change.
--
-- Scope guard:
--   Only touches rows with:
--     no IN ('REV-QA-PAY-testqapaymen-D', 'REV-QA-PAY-testqapaymen-C')
--     AND source_id = 'cef11264-fcb2-4f29-81c5-0b0b99e156a4'
--     AND entity_id = 'b81853ee-b305-43f8-a7bc-39aed420781a'
--     AND status = 'draft'
--
-- Validation:
--   Verifies original posted pair still exists before and after.
--   Verifies reversal pair is in draft before proceeding.
--   Verifies accounting balance: DEBIT total = CREDIT total across all 4 rows.
--
-- Audit:
--   Writes an audit_log entry documenting the migration action.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_rev_debit  record;   -- REV-QA-PAY-testqapaymen-C  (type=DEBIT, draft)
  v_rev_credit record;   -- REV-QA-PAY-testqapaymen-D  (type=CREDIT, draft)
  v_orig_debit record;   -- PAY-testqapaymen-D          (type=DEBIT, posted)
  v_orig_credit record;  -- PAY-testqapaymen-C          (type=CREDIT, posted)
  v_total_debit  numeric;
  v_total_credit numeric;
  v_now          timestamptz := now();
  v_src_id       text := 'cef11264-fcb2-4f29-81c5-0b0b99e156a4';
  v_ent_id       text := 'b81853ee-b305-43f8-a7bc-39aed420781a';
  v_target_count integer;
  v_audit_id     public.audit_log.id%TYPE;
BEGIN

  -- Idempotency and scope guard. An empty database is already clean; any
  -- partial QA journal graph is unsafe and must be reconciled explicitly.
  SELECT count(*) INTO v_target_count
  FROM public.journal_entries
  WHERE no IN (
    'PAY-testqapaymen-D',
    'PAY-testqapaymen-C',
    'REV-QA-PAY-testqapaymen-D',
    'REV-QA-PAY-testqapaymen-C'
  )
     OR (source_id::text = v_src_id AND entity_id::text = v_ent_id);

  IF v_target_count = 0 THEN
    RAISE NOTICE 'QA original and reversal entries are absent. Migration is an idempotent no-op.';
    RETURN;
  END IF;

  IF v_target_count <> 4 THEN
    RAISE EXCEPTION 'Invariant failed: expected either 0 or exactly 4 QA journal rows, found %.', v_target_count;
  END IF;

  -- =========================================================================
  -- PHASE 1: Verify original posted entries still exist (invariant check)
  -- =========================================================================

  SELECT * INTO v_orig_debit
  FROM public.journal_entries
  WHERE no = 'PAY-testqapaymen-D'
    AND source_id::text = v_src_id
    AND entity_id::text = v_ent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invariant failed: original DEBIT entry PAY-testqapaymen-D not found.';
  END IF;
  IF v_orig_debit.status <> 'posted' THEN
    RAISE EXCEPTION 'Invariant failed: PAY-testqapaymen-D status is %, expected posted.', v_orig_debit.status;
  END IF;
  IF v_orig_debit.amount <> 150.00 THEN
    RAISE EXCEPTION 'Invariant failed: PAY-testqapaymen-D amount is %, expected 150.', v_orig_debit.amount;
  END IF;

  SELECT * INTO v_orig_credit
  FROM public.journal_entries
  WHERE no = 'PAY-testqapaymen-C'
    AND source_id::text = v_src_id
    AND entity_id::text = v_ent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invariant failed: original CREDIT entry PAY-testqapaymen-C not found.';
  END IF;
  IF v_orig_credit.status <> 'posted' THEN
    RAISE EXCEPTION 'Invariant failed: PAY-testqapaymen-C status is %, expected posted.', v_orig_credit.status;
  END IF;
  IF v_orig_credit.amount <> 150.00 THEN
    RAISE EXCEPTION 'Invariant failed: PAY-testqapaymen-C amount is %, expected 150.', v_orig_credit.amount;
  END IF;

  -- =========================================================================
  -- PHASE 2: Find reversal entries
  -- =========================================================================

  SELECT * INTO v_rev_credit
  FROM public.journal_entries
  WHERE no = 'REV-QA-PAY-testqapaymen-D'
    AND source_id::text = v_src_id
    AND entity_id::text = v_ent_id;

  SELECT * INTO v_rev_debit
  FROM public.journal_entries
  WHERE no = 'REV-QA-PAY-testqapaymen-C'
    AND source_id::text = v_src_id
    AND entity_id::text = v_ent_id;

  -- =========================================================================
  -- PHASE 3: Idempotency — exit cleanly if already posted
  -- =========================================================================

  IF v_rev_credit.id IS NOT NULL AND v_rev_debit.id IS NOT NULL
     AND v_rev_credit.status = 'posted' AND v_rev_debit.status = 'posted' THEN
    RAISE NOTICE 'QA reversal already posted. Migration is a no-op. Exiting cleanly.';
    RETURN;
  END IF;

  -- =========================================================================
  -- PHASE 4: Validate reversal entries are in expected draft state
  -- =========================================================================

  IF v_rev_credit.id IS NULL THEN
    RAISE EXCEPTION 'Reversal entry REV-QA-PAY-testqapaymen-D not found. Cannot post.';
  END IF;
  IF v_rev_debit.id IS NULL THEN
    RAISE EXCEPTION 'Reversal entry REV-QA-PAY-testqapaymen-C not found. Cannot post.';
  END IF;
  IF v_rev_credit.status <> 'draft' THEN
    RAISE EXCEPTION 'REV-QA-PAY-testqapaymen-D status is %, expected draft.', v_rev_credit.status;
  END IF;
  IF v_rev_debit.status <> 'draft' THEN
    RAISE EXCEPTION 'REV-QA-PAY-testqapaymen-C status is %, expected draft.', v_rev_debit.status;
  END IF;
  IF v_rev_credit.type <> 'CREDIT' THEN
    RAISE EXCEPTION 'REV-QA-PAY-testqapaymen-D type is %, expected CREDIT.', v_rev_credit.type;
  END IF;
  IF v_rev_debit.type <> 'DEBIT' THEN
    RAISE EXCEPTION 'REV-QA-PAY-testqapaymen-C type is %, expected DEBIT.', v_rev_debit.type;
  END IF;
  IF v_rev_credit.amount <> 150.00 THEN
    RAISE EXCEPTION 'REV-QA-PAY-testqapaymen-D amount is %, expected 150.', v_rev_credit.amount;
  END IF;
  IF v_rev_debit.amount <> 150.00 THEN
    RAISE EXCEPTION 'REV-QA-PAY-testqapaymen-C amount is %, expected 150.', v_rev_debit.amount;
  END IF;

  -- =========================================================================
  -- PHASE 5: Post the draft reversal entries
  --   (immutability trigger only fires when OLD.status = 'posted';
  --    updating draft→posted is the standard lifecycle and is permitted)
  -- =========================================================================

  UPDATE public.journal_entries
  SET
    status     = 'posted',
    created_at = v_now,
    updated_at = v_now
  WHERE id IN (v_rev_credit.id, v_rev_debit.id)
    AND status = 'draft'
    AND source_id::text = v_src_id
    AND entity_id::text = v_ent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'UPDATE posted 0 rows — unexpected state. Aborting.';
  END IF;

  RAISE NOTICE 'Posted REV-QA-PAY-testqapaymen-D (id: %)', v_rev_credit.id;
  RAISE NOTICE 'Posted REV-QA-PAY-testqapaymen-C (id: %)', v_rev_debit.id;

  -- =========================================================================
  -- PHASE 6: Verify accounting balance across all 4 rows
  -- =========================================================================

  SELECT
    SUM(CASE WHEN type = 'DEBIT'  THEN amount ELSE 0 END),
    SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END)
  INTO v_total_debit, v_total_credit
  FROM public.journal_entries
  WHERE source_id::text = v_src_id
    AND entity_id::text = v_ent_id;

  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION
      'Post-update balance check failed: DEBIT total=% CREDIT total=%. Accounting equation violated.',
      v_total_debit, v_total_credit;
  END IF;

  RAISE NOTICE 'Balance verified: DEBIT total=% = CREDIT total=%. Net accounting effect = 0.',
    v_total_debit, v_total_credit;

  -- =========================================================================
  -- PHASE 7: Audit trail
  -- =========================================================================

  v_audit_id := gen_random_uuid();

  INSERT INTO public.audit_log (
    id, ts, user_id, username, action, entity, entity_id,
    note, "table", details, created_at, updated_at
  ) VALUES (
    v_audit_id,
    extract(epoch from v_now)::bigint,
    NULL,
    'migration:20260715000005',
    'POST_QA_REVERSAL_ENTRIES',
    'journal_entry',
    v_rev_credit.id::text || ',' || v_rev_debit.id::text,
    'QA cleanup: posted two draft reversal entries to complete double-entry neutralisation of QA journal pair PAY-testqapaymen-D/C. Net accounting effect = 0.',
    'journal_entries',
    jsonb_build_object(
      'migration', '20260715000005_post_qa_reversal_entries',
      'original_debit_id',  v_orig_debit.id,
      'original_credit_id', v_orig_credit.id,
      'reversal_credit_id', v_rev_credit.id,
      'reversal_debit_id',  v_rev_debit.id,
      'amount', 150.00,
      'source_id', v_src_id,
      'entity_id', v_ent_id,
      'total_debit', v_total_debit,
      'total_credit', v_total_credit
    )::text,
    v_now,
    v_now
  );

  RAISE NOTICE 'Migration 20260715000005 complete. QA journal entries fully neutralised.';

END $$;

COMMIT;
