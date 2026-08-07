-- Manual/emergency rollback only — not auto-applied; run by hand only.
-- Rollback for: supabase/migrations/20260807172900_s03_wire_post_receipt_to_gl_engine.sql
--
-- This rollback changes only the post_receipt_atomic write boundary back to the
-- legacy journal_entries compatibility view and removes the initial-period helper.
-- It intentionally does NOT delete canonical batches, journal lines, receipts,
-- payments, allocations, or accounting periods already created by the forward path.

begin;

do $rollback_patch$
declare
  v_proc regprocedure := to_regprocedure('public.post_receipt_atomic(jsonb)');
  v_def text;
  v_new_def text;
  v_start integer;
  v_relative_end integer;
  v_end integer;
  v_replacement text := $replacement$  -- Insert journal entries (3A-1B: account must belong to the caller's company)
  FOR v_journal IN
    SELECT journal_record.value
    FROM jsonb_array_elements(v_journal_entries) AS journal_record(value)
  LOOP
    v_journal_id := coalesce(v_journal->>'id', gen_random_uuid()::text);
    v_journal_date := v_journal->>'date';
    v_journal_source_id := nullif(v_journal->>'source_id', '');

    IF nullif(v_journal->>'account_id', '') IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.accounts AS account_record
      WHERE account_record.id = v_journal->>'account_id'
        AND account_record.company_id = v_company_id
    ) THEN
      RAISE EXCEPTION 'غير مصرح: حساب القيد لا ينتمي إلى شركتك: %', v_journal->>'account_id'
        USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.journal_entries(
      id,
      no,
      date,
      account_id,
      amount,
      type,
      source_id,
      entity_type,
      entity_id,
      created_at,
      company_id
    ) VALUES (
      v_journal_id,
      v_journal->>'no',
      v_journal_date,
      v_journal->>'account_id',
      (v_journal->>'amount')::numeric,
      v_journal->>'type',
      v_journal_source_id,
      nullif(v_journal->>'entity_type', ''),
      nullif(v_journal->>'entity_id', ''),
      now(),
      v_company_id
    );
  END LOOP;
$replacement$;
begin
  if v_proc is null then
    raise exception 'S03_RECEIPT_ROLLBACK_ABORT: public.post_receipt_atomic(jsonb) is missing.';
  end if;

  select pg_get_functiondef(v_proc) into v_def;

  v_start := position('  -- Stage S03: post receipt/payment journal content through the canonical GL engine.' in v_def);
  if v_start = 0 then
    raise exception 'S03_RECEIPT_ROLLBACK_ABORT: forward wiring marker was not found; refusing a blind rollback.';
  end if;

  v_relative_end := position(E'\n  v_result := jsonb_build_object(' in substring(v_def from v_start));
  if v_relative_end = 0 then
    raise exception 'S03_RECEIPT_ROLLBACK_ABORT: expected result boundary was not found.';
  end if;
  v_end := v_start + v_relative_end - 1;

  v_new_def := substring(v_def from 1 for v_start - 1)
    || v_replacement
    || substring(v_def from v_end);

  execute v_new_def;

  select pg_get_functiondef(to_regprocedure('public.post_receipt_atomic(jsonb)')) into v_def;
  if position('INSERT INTO public.journal_entries' in v_def) = 0 then
    raise exception 'S03_RECEIPT_ROLLBACK_ABORT: compatibility journal loop was not restored.';
  end if;
end
$rollback_patch$;

drop function if exists public.gl_ensure_initial_open_period(uuid, date);

commit;
