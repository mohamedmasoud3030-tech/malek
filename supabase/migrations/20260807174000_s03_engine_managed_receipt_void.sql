-- Stage S03 — route receipt VOID reversals through the canonical GL reversal engine.
--
-- New canonical receipt batches (source_type='receipt') are reversed with
-- reverse_journal_batch(), preserving period resolution, reversal linkage,
-- immutability and idempotency. Historical receipts that only have legacy
-- compatibility batches keep the previous equal-and-opposite fallback.
--
-- No receipt/payment/allocation/status semantics are changed here.

begin;

do $patch$
declare
  v_proc regprocedure := to_regprocedure('public.void_receipt_atomic(jsonb)');
  v_def text;
  v_new_def text;
  v_start integer;
  v_relative_end integer;
  v_end integer;
  v_replacement text := $replacement$  -- Stage S03: canonical receipt batches use the engine-managed reversal.
  IF v_original_count > 0 AND v_existing_reversal_count = 0 THEN
    -- A receipt posted through Stage S03 has exactly one canonical source batch.
    -- Prefer that batch and let reverse_journal_batch own reversal identity,
    -- line inversion, period routing and idempotency.
    SELECT b.id
      INTO v_reversal_batch_id
    FROM public.journal_batches b
    WHERE b.company_id = v_company_id
      AND b.source_type = 'receipt'
      AND b.source_id = v_receipt.id::text
      AND NOT b.is_legacy_compat
    ORDER BY b.created_at, b.id
    LIMIT 1;

    IF v_reversal_batch_id IS NOT NULL THEN
      v_result := public.reverse_journal_batch(v_reversal_batch_id);

      -- The engine returns the created/reused reversal id. Preserve the public
      -- void_receipt_atomic response fields while reporting created line count
      -- only for a newly-created reversal.
      v_reversal_batch_id := nullif(v_result->>'reversal_batch_id', '')::uuid;
      IF coalesce((v_result->>'idempotent')::boolean, false) THEN
        v_created_reversal_count := 0;
      ELSE
        SELECT count(*)::integer
          INTO v_created_reversal_count
        FROM public.journal_lines jl
        WHERE jl.batch_id = v_reversal_batch_id
          AND jl.deleted_at IS NULL;
      END IF;
    ELSE
      -- Historical compatibility receipt: retain the pre-S03 behavior so old
      -- financial history remains voidable without rewriting legacy batches.
      v_reversal_batch_id := gen_random_uuid();

      INSERT INTO public.journal_entries (
        id, no, date, account_id, amount, type, source_id, entity_type,
        entity_id, created_at, request_id, status, batch_id, company_id
      )
      SELECT
        gen_random_uuid()::text,
        'VOID-' || left(replace(v_receipt.id::text, '-', ''), 12) || '-' || row_number() over (order by je.id),
        current_date::text,
        je.account_id,
        je.amount,
        CASE upper(je.type) WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,
        v_receipt.id::text,
        'receipt_void',
        v_receipt.id::text,
        now(),
        v_reversal_request_id,
        'posted',
        v_reversal_batch_id,
        je.company_id
      FROM public.journal_entries je
      WHERE je.source_id::text = v_receipt.id::text
        AND je.deleted_at IS NULL
        AND coalesce(je.request_id, '') <> v_reversal_request_id
        AND coalesce(je.entity_type, '') <> 'receipt_void';

      GET DIAGNOSTICS v_created_reversal_count = ROW_COUNT;
      PERFORM public.close_journal_batch(v_reversal_batch_id);
    END IF;
  END IF;
$replacement$;
begin
  if v_proc is null then
    raise exception 'S03_RECEIPT_VOID_WIRING_ABORT: public.void_receipt_atomic(jsonb) is missing.';
  end if;

  select pg_get_functiondef(v_proc) into v_def;

  if position('Stage S03: canonical receipt batches use the engine-managed reversal.' in v_def) > 0 then
    return;
  end if;

  v_start := position('  IF v_original_count > 0 AND v_existing_reversal_count = 0 THEN' in v_def);
  if v_start = 0 then
    raise exception 'S03_RECEIPT_VOID_WIRING_ABORT: expected legacy reversal block was not found.';
  end if;

  v_relative_end := position(E'\n  IF NOT v_receipt_was_void OR v_created_reversal_count > 0 THEN' in substring(v_def from v_start));
  if v_relative_end = 0 then
    raise exception 'S03_RECEIPT_VOID_WIRING_ABORT: expected audit boundary was not found.';
  end if;
  v_end := v_start + v_relative_end - 1;

  v_new_def := substring(v_def from 1 for v_start - 1)
    || v_replacement
    || substring(v_def from v_end);

  execute v_new_def;

  select pg_get_functiondef(to_regprocedure('public.void_receipt_atomic(jsonb)')) into v_def;
  if position('public.reverse_journal_batch' in v_def) = 0 then
    raise exception 'S03_RECEIPT_VOID_WIRING_ABORT: engine reversal postcondition failed.';
  end if;
  if position('Historical compatibility receipt' in v_def) = 0 then
    raise exception 'S03_RECEIPT_VOID_WIRING_ABORT: legacy fallback was not preserved.';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid = to_regprocedure('public.void_receipt_atomic(jsonb)')) then
    raise exception 'S03_RECEIPT_VOID_WIRING_ABORT: SECURITY DEFINER posture was lost.';
  end if;
end
$patch$;

commit;
