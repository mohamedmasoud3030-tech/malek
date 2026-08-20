-- =============================================================================
-- Migration: 20260715000005_post_qa_reversal_entries
-- Date: 2026-07-12
-- Risk: LOW (strictly targeted QA journal rows)
--
-- Posts the two known QA reversal rows only when the complete four-row QA graph
-- exists. A clean replay or an environment where all four rows are already
-- absent is a valid no-op. Partial or broadened matches fail closed.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_rev_debit record;
  v_rev_credit record;
  v_orig_debit record;
  v_orig_credit record;
  v_total_debit numeric;
  v_total_credit numeric;
  v_now timestamptz := now();
  v_src_id text := 'cef11264-fcb2-4f29-81c5-0b0b99e156a4';
  v_ent_id text := 'b81853ee-b305-43f8-a7bc-39aed420781a';
  v_target_count integer;
  v_related_count integer;
  v_updated_count integer;
BEGIN
  SELECT count(*)
    INTO v_target_count
  FROM public.journal_entries
  WHERE no IN (
      'PAY-testqapaymen-D',
      'PAY-testqapaymen-C',
      'REV-QA-PAY-testqapaymen-D',
      'REV-QA-PAY-testqapaymen-C'
    )
    AND source_id::text = v_src_id
    AND entity_id::text = v_ent_id;

  SELECT count(*)
    INTO v_related_count
  FROM public.journal_entries
  WHERE no IN (
      'PAY-testqapaymen-D',
      'PAY-testqapaymen-C',
      'REV-QA-PAY-testqapaymen-D',
      'REV-QA-PAY-testqapaymen-C'
    )
    OR (
      source_id::text = v_src_id
      AND entity_id::text = v_ent_id
    );

  IF v_related_count = 0 THEN
    RAISE NOTICE 'QA journal reversal graph is absent; no posting required.';
  ELSE
    IF v_target_count <> 4 OR v_related_count <> 4 THEN
      RAISE EXCEPTION
        'QA reversal validation failed: expected exactly four isolated target rows, found target=% related=%',
        v_target_count,
        v_related_count;
    END IF;

    SELECT * INTO v_orig_debit
    FROM public.journal_entries
    WHERE no = 'PAY-testqapaymen-D'
      AND source_id::text = v_src_id
      AND entity_id::text = v_ent_id;

    SELECT * INTO v_orig_credit
    FROM public.journal_entries
    WHERE no = 'PAY-testqapaymen-C'
      AND source_id::text = v_src_id
      AND entity_id::text = v_ent_id;

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

    IF v_orig_debit.id IS NULL
       OR v_orig_credit.id IS NULL
       OR v_rev_credit.id IS NULL
       OR v_rev_debit.id IS NULL THEN
      RAISE EXCEPTION 'QA reversal validation failed: one or more exact target rows are missing';
    END IF;

    IF v_orig_debit.status <> 'posted'
       OR v_orig_debit.type <> 'DEBIT'
       OR v_orig_debit.amount <> 150.00 THEN
      RAISE EXCEPTION 'QA reversal validation failed: original DEBIT row is not in the expected state';
    END IF;

    IF v_orig_credit.status <> 'posted'
       OR v_orig_credit.type <> 'CREDIT'
       OR v_orig_credit.amount <> 150.00 THEN
      RAISE EXCEPTION 'QA reversal validation failed: original CREDIT row is not in the expected state';
    END IF;

    IF v_rev_credit.type <> 'CREDIT' OR v_rev_credit.amount <> 150.00 THEN
      RAISE EXCEPTION 'QA reversal validation failed: reversal CREDIT row is invalid';
    END IF;

    IF v_rev_debit.type <> 'DEBIT' OR v_rev_debit.amount <> 150.00 THEN
      RAISE EXCEPTION 'QA reversal validation failed: reversal DEBIT row is invalid';
    END IF;

    IF v_rev_credit.status = 'posted' AND v_rev_debit.status = 'posted' THEN
      RAISE NOTICE 'QA reversal entries are already posted; no update required.';
    ELSE
      IF v_rev_credit.status <> 'draft' OR v_rev_debit.status <> 'draft' THEN
        RAISE EXCEPTION
          'QA reversal validation failed: reversal rows must both be draft or both be posted';
      END IF;

      UPDATE public.journal_entries
      SET
        status = 'posted',
        created_at = COALESCE(created_at, v_now),
        updated_at = v_now
      WHERE id IN (v_rev_credit.id, v_rev_debit.id)
        AND status = 'draft'
        AND source_id::text = v_src_id
        AND entity_id::text = v_ent_id;

      GET DIAGNOSTICS v_updated_count = ROW_COUNT;
      IF v_updated_count <> 2 THEN
        RAISE EXCEPTION
          'QA reversal posting failed: expected to update 2 rows, updated %',
          v_updated_count;
      END IF;
    END IF;

    SELECT
      COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0)
    INTO v_total_debit, v_total_credit
    FROM public.journal_entries
    WHERE no IN (
        'PAY-testqapaymen-D',
        'PAY-testqapaymen-C',
        'REV-QA-PAY-testqapaymen-D',
        'REV-QA-PAY-testqapaymen-C'
      )
      AND source_id::text = v_src_id
      AND entity_id::text = v_ent_id;

    IF v_total_debit <> v_total_credit THEN
      RAISE EXCEPTION
        'QA reversal balance check failed: DEBIT total=% CREDIT total=%',
        v_total_debit,
        v_total_credit;
    END IF;

    IF v_updated_count = 2 THEN
      INSERT INTO public.audit_log (
        id,
        ts,
        user_id,
        username,
        action,
        entity,
        entity_id,
        note,
        "table",
        details,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        extract(epoch from v_now)::bigint,
        NULL,
        'migration:20260715000005',
        'POST_QA_REVERSAL_ENTRIES',
        'journal_entry',
        v_rev_credit.id::text || ',' || v_rev_debit.id::text,
        'QA cleanup: posted two validated draft reversal entries; net accounting effect is zero.',
        'journal_entries',
        jsonb_build_object(
          'migration', '20260715000005_post_qa_reversal_entries',
          'original_debit_id', v_orig_debit.id,
          'original_credit_id', v_orig_credit.id,
          'reversal_credit_id', v_rev_credit.id,
          'reversal_debit_id', v_rev_debit.id,
          'amount', 150.00,
          'source_id', v_src_id,
          'entity_id', v_ent_id,
          'total_debit', v_total_debit,
          'total_credit', v_total_credit
        )::text,
        v_now,
        v_now
      );
    END IF;
  END IF;
END
$$;

COMMIT;
