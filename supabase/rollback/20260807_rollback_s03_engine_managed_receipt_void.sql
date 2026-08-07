-- Manual/emergency rollback only — not auto-applied; run by hand only.
-- Rollback for: supabase/migrations/20260807174000_s03_engine_managed_receipt_void.sql
--
-- Financial safety: this rollback refuses to downgrade once any canonical receipt
-- batch exists, because doing so could allow a later VOID request to create a
-- second legacy reversal for history already reversed by the GL engine.

begin;

do $safety$
begin
  if exists (
    select 1
    from public.journal_batches b
    where b.source_type = 'receipt'
      and not b.is_legacy_compat
  ) then
    raise exception 'S03_RECEIPT_VOID_ROLLBACK_BLOCKED: canonical receipt batches exist; keep engine-managed VOID handling and use a forward corrective migration instead.'
      using errcode = '55000';
  end if;
end
$safety$;

do $rollback_patch$
declare
  v_proc regprocedure := to_regprocedure('public.void_receipt_atomic(jsonb)');
  v_def text;
  v_new_def text;
  v_start integer;
  v_relative_end integer;
  v_end integer;
  v_replacement text := $replacement$  IF v_original_count > 0 AND v_existing_reversal_count = 0 THEN
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
$replacement$;
begin
  if v_proc is null then
    raise exception 'S03_RECEIPT_VOID_ROLLBACK_ABORT: public.void_receipt_atomic(jsonb) is missing.';
  end if;

  select pg_get_functiondef(v_proc) into v_def;
  v_start := position('  -- Stage S03: canonical receipt batches use the engine-managed reversal.' in v_def);
  if v_start = 0 then
    raise exception 'S03_RECEIPT_VOID_ROLLBACK_ABORT: forward wiring marker was not found.';
  end if;

  v_relative_end := position(E'\n  IF NOT v_receipt_was_void OR v_created_reversal_count > 0 THEN' in substring(v_def from v_start));
  if v_relative_end = 0 then
    raise exception 'S03_RECEIPT_VOID_ROLLBACK_ABORT: expected audit boundary was not found.';
  end if;
  v_end := v_start + v_relative_end - 1;

  v_new_def := substring(v_def from 1 for v_start - 1)
    || v_replacement
    || substring(v_def from v_end);
  execute v_new_def;

  select pg_get_functiondef(to_regprocedure('public.void_receipt_atomic(jsonb)')) into v_def;
  if position('public.reverse_journal_batch' in v_def) > 0 then
    raise exception 'S03_RECEIPT_VOID_ROLLBACK_ABORT: engine reversal call remains after rollback.';
  end if;
end
$rollback_patch$;

commit;
