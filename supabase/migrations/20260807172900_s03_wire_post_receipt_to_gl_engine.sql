-- Stage S03 — wire the first live business posting path (receipt/payment) to the canonical GL engine.
--
-- This migration deliberately preserves the existing post_receipt_atomic business contract,
-- idempotency fingerprint, allocation math, company isolation and return shape. Only the
-- journal-write boundary changes: the old journal_entries compatibility-view INSERT loop is
-- replaced by one canonical post_journal_event batch.
--
-- A company with zero accounting periods receives exactly one initial monthly OPEN period,
-- anchored to the first receipt effective date. Companies that already have any accounting
-- period are never auto-mutated; normal resolver/close rules remain authoritative.

begin;

create or replace function public.gl_ensure_initial_open_period(
  p_company_id uuid,
  p_anchor_date date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_existing_id uuid;
  v_period_id uuid;
  v_start date;
  v_end date;
begin
  if p_company_id is null or p_anchor_date is null then
    raise exception 'company_id and anchor_date are required to provision the initial accounting period.'
      using errcode = '22023';
  end if;

  if not exists (select 1 from public.companies c where c.id = p_company_id) then
    raise exception 'Company % does not exist.', p_company_id using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('initial_accounting_period:' || p_company_id::text, 0)
  );

  -- Never invent or reshape periods once accounting-period governance has begun.
  select p.id into v_existing_id
    from public.accounting_periods p
   where p.company_id = p_company_id
   order by p.start_date, p.id
   limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  v_start := date_trunc('month', p_anchor_date)::date;
  v_end := (date_trunc('month', p_anchor_date) + interval '1 month' - interval '1 day')::date;

  insert into public.accounting_periods (
    company_id, name, start_date, end_date, status, created_by, created_at, updated_at
  ) values (
    p_company_id,
    to_char(v_start, 'YYYY-MM'),
    v_start,
    v_end,
    'OPEN',
    auth.uid(),
    now(),
    now()
  )
  returning id into v_period_id;

  return v_period_id;
end;
$function$;

alter function public.gl_ensure_initial_open_period(uuid, date) owner to postgres;
revoke all on function public.gl_ensure_initial_open_period(uuid, date) from public, anon, authenticated;
grant execute on function public.gl_ensure_initial_open_period(uuid, date) to service_role;

-- Preserve the exact latest post_receipt_atomic definition and replace only its
-- compatibility-view journal loop. This fails closed if the expected boundary has drifted.
do $patch$
declare
  v_proc regprocedure := to_regprocedure('public.post_receipt_atomic(jsonb)');
  v_def text;
  v_new_def text;
  v_start integer;
  v_relative_end integer;
  v_end integer;
  v_replacement text := $replacement$  -- Stage S03: post receipt/payment journal content through the canonical GL engine.
  -- Keep the existing company-account authorization error contract before entering
  -- the engine; the engine then re-validates account scope, side, amount and balance.
  FOR v_journal IN
    SELECT journal_record.value
    FROM jsonb_array_elements(v_journal_entries) AS journal_record(value)
  LOOP
    IF nullif(v_journal->>'account_id', '') IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.accounts AS account_record
      WHERE account_record.id = v_journal->>'account_id'
        AND account_record.company_id = v_company_id
    ) THEN
      RAISE EXCEPTION 'غير مصرح: حساب القيد لا ينتمي إلى شركتك: %', v_journal->>'account_id'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF jsonb_array_length(v_journal_entries) > 0 THEN
    -- Bootstrap only the first period. Once any period exists, the normal
    -- OPEN/SOFT_CLOSED/HARD_CLOSED resolver remains fail-closed and authoritative.
    PERFORM public.gl_ensure_initial_open_period(v_company_id, v_receipt_date_time::date);

    PERFORM public.post_journal_event(jsonb_build_object(
      'company_id', v_company_id,
      'source_type', 'receipt',
      'source_id', v_receipt_id::text,
      'event_id', v_request_id,
      'effective_date', v_receipt_date_time::date,
      'description', coalesce(nullif(v_receipt_notes, ''), 'Receipt ' || v_receipt_id::text),
      'lines', (
        SELECT coalesce(
          jsonb_agg(
            jsonb_build_object(
              'account_id', journal_record.value->>'account_id',
              'debit', CASE
                WHEN upper(coalesce(journal_record.value->>'type', '')) = 'DEBIT'
                  THEN round((journal_record.value->>'amount')::numeric, 3)
                ELSE 0
              END,
              'credit', CASE
                WHEN upper(coalesce(journal_record.value->>'type', '')) = 'CREDIT'
                  THEN round((journal_record.value->>'amount')::numeric, 3)
                ELSE 0
              END,
              'line_description', nullif(journal_record.value->>'no', ''),
              'ref_source_id', coalesce(nullif(journal_record.value->>'source_id', ''), v_receipt_id::text),
              'ref_entity_type', nullif(journal_record.value->>'entity_type', ''),
              'ref_entity_id', nullif(journal_record.value->>'entity_id', '')
            )
            ORDER BY journal_record.ordinality
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(v_journal_entries) WITH ORDINALITY
          AS journal_record(value, ordinality)
      )
    ));
  END IF;
$replacement$;
begin
  if v_proc is null then
    raise exception 'S03_RECEIPT_WIRING_ABORT: public.post_receipt_atomic(jsonb) is missing.';
  end if;

  select pg_get_functiondef(v_proc) into v_def;

  if position('public.post_journal_event' in v_def) > 0
     and position('INSERT INTO public.journal_entries' in v_def) = 0 then
    -- Idempotent migration replay guard: already wired.
    return;
  end if;

  v_start := position('  -- Insert journal entries (3A-1B: account must belong to the caller''s company)' in v_def);
  if v_start = 0 then
    raise exception 'S03_RECEIPT_WIRING_ABORT: expected legacy journal loop marker was not found.';
  end if;

  v_relative_end := position(E'\n  v_result := jsonb_build_object(' in substring(v_def from v_start));
  if v_relative_end = 0 then
    raise exception 'S03_RECEIPT_WIRING_ABORT: expected result boundary was not found.';
  end if;
  v_end := v_start + v_relative_end - 1;

  v_new_def := substring(v_def from 1 for v_start - 1)
    || v_replacement
    || substring(v_def from v_end);

  execute v_new_def;

  select pg_get_functiondef(to_regprocedure('public.post_receipt_atomic(jsonb)')) into v_def;
  if position('public.post_journal_event' in v_def) = 0
     or position('INSERT INTO public.journal_entries' in v_def) > 0 then
    raise exception 'S03_RECEIPT_WIRING_ABORT: postcondition failed; compatibility journal write remains.';
  end if;

  if not (select p.prosecdef from pg_proc p where p.oid = to_regprocedure('public.post_receipt_atomic(jsonb)')) then
    raise exception 'S03_RECEIPT_WIRING_ABORT: SECURITY DEFINER posture was lost.';
  end if;
end
$patch$;

comment on function public.gl_ensure_initial_open_period(uuid, date) is
  'Stage S03 internal bootstrap: creates the first monthly OPEN accounting period only when a company has zero periods; never modifies existing period governance.';

commit;
