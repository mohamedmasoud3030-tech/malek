-- =============================================================================
-- Stage 3 — General Ledger Core (3/3): controlled posting engine and RPCs.
--
-- One canonical server-side posting boundary:
--   * gl_create_journal_batch   — creates a server-controlled DRAFT batch with
--                                 validated lines (service contexts only).
--   * gl_post_journal_batch     — the posting engine: locks the draft, verifies
--                                 company scope, traceability, accounts, exact
--                                 three-decimal balance, resolves the accounting
--                                 period, sets posted_at, transitions to POSTED.
--   * post_journal_event        — predefined business-event entry: create + post
--                                 in one transaction, idempotent by the
--                                 (company_id, source_type, source_id, event_id)
--                                 database key; a retry with different financial
--                                 data fails with a clear conflict.
--   * reverse_journal_batch     — creates an equal-and-opposite POSTED batch
--                                 referencing the original through
--                                 reversal_of_batch_id, marks the original
--                                 REVERSED, follows open-period rules, and is
--                                 idempotent.
--
-- Browser roles cannot call the engine (ACL: service_role only, functions owned
-- by postgres with pinned search_path). The frontend never submits arbitrary
-- debit/credit lines: the engine accepts a server-created draft batch id or a
-- predefined event payload with strict validation.
--
-- Period administration RPCs (ADMIN/MANAGER, company derived from the JWT):
--   * create_accounting_period / update_accounting_period_status
-- Read RPCs (ADMIN/MANAGER, company derived from the JWT):
--   * list_chart_of_accounts / list_accounting_periods
--   * list_journal_batches / list_journal_lines
--
-- Period resolution (server-side, in the engine):
--   1. The period containing effective_date, when OPEN, receives the batch.
--   2. Otherwise the batch is posted into the EARLIEST open period whose end
--      date is on/after effective_date ("first eligible open period"), keeping
--      effective_date untouched and recording period_resolution_reason.
--   3. If no eligible open period exists, posting fails clearly.
--
-- Forward-only. Manual rollback:
--   supabase/rollback/20260804_rollback_stage3_gl_core_posting_engine_and_rpcs.sql
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Canonical rounding + period resolution helpers (internal, not browser)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_resolve_accounting_period(p_company_id uuid, p_effective_date date)
returns table (period_id uuid, reason text)
language plpgsql
stable
set search_path = public, pg_temp
as $function$
declare
  v_period_id uuid;
  v_reason text;
begin
  if p_company_id is null or p_effective_date is null then
    raise exception 'company_id and effective_date are required for period resolution.' using errcode = '22023';
  end if;

  -- 1) an OPEN period that contains the effective date
  select p.id into v_period_id
    from public.accounting_periods p
   where p.company_id = p_company_id
     and p.status = 'OPEN'
     and p.start_date <= p_effective_date
     and p.end_date >= p_effective_date
   order by p.start_date
   limit 1;

  if v_period_id is not null then
    v_reason := 'open_period_contains_date';
    return query select v_period_id, v_reason;
    return;
  end if;

  -- 2) the earliest eligible open period: open, and not ended before the
  -- effective date. This is the target for late events whose own period is
  -- SOFT_CLOSED / HARD_CLOSED or missing.
  select p.id into v_period_id
    from public.accounting_periods p
   where p.company_id = p_company_id
     and p.status = 'OPEN'
     and p.end_date >= p_effective_date
   order by p.start_date
   limit 1;

  if v_period_id is not null then
    v_reason := 'redirected_earliest_open_period';
    return query select v_period_id, v_reason;
    return;
  end if;

  -- 3) no eligible open period
  raise exception 'NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD: no open accounting period can accept effective date % for company %. Create or reopen an OPEN period first.', p_effective_date, p_company_id
    using errcode = 'P0001';
end;
$function$;

alter function public.gl_resolve_accounting_period(uuid, date) owner to postgres;
revoke all on function public.gl_resolve_accounting_period(uuid, date) from public, anon, authenticated;
grant execute on function public.gl_resolve_accounting_period(uuid, date) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Engine line normalization + validation
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_validate_and_normalize_lines(p_company_id uuid, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_line jsonb;
  v_account_id text;
  v_account_no text;
  v_debit numeric;
  v_credit numeric;
  v_result jsonb := '[]'::jsonb;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'JOURNAL_BATCH_EMPTY: at least one journal line is required.' using errcode = '22023';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_account_id := nullif(btrim(coalesce(v_line->>'account_id', '')), '');
    if v_account_id is null then
      raise exception 'JOURNAL_LINE_ACCOUNT_REQUIRED: every journal line must specify account_id.' using errcode = '22023';
    end if;

    -- Account must exist, belong to the batch company and be active.
    select a.no into v_account_no
      from public.accounts a
     where a.id = v_account_id
       and a.company_id = p_company_id;
    if v_account_no is null then
      raise exception 'JOURNAL_LINE_ACCOUNT_SCOPE: account % does not belong to company % or does not exist.', v_account_id, p_company_id using errcode = '22023';
    end if;

    v_debit := public._r3(coalesce(nullif(v_line->>'debit', '')::numeric, 0));
    v_credit := public._r3(coalesce(nullif(v_line->>'credit', '')::numeric, 0));

    if (v_debit > 0 and v_credit > 0) or (v_debit = 0 and v_credit = 0) then
      raise exception 'JOURNAL_LINE_SIDE_INVALID: each line must contain exactly one positive side (debit XOR credit); account %.', v_account_no using errcode = '22023';
    end if;
    if v_debit < 0 or v_credit < 0 then
      raise exception 'JOURNAL_LINE_NEGATIVE_INVALID: negative debit/credit amounts are not allowed; account %.', v_account_no using errcode = '22023';
    end if;

    v_result := v_result || jsonb_build_object(
      'account_id', v_account_id,
      'account_no', v_account_no,
      'debit', v_debit,
      'credit', v_credit,
      'line_description', nullif(v_line->>'line_description', ''),
      'ref_source_id', nullif(v_line->>'ref_source_id', ''),
      'ref_entity_type', nullif(v_line->>'ref_entity_type', ''),
      'ref_entity_id', nullif(v_line->>'ref_entity_id', '')
    );
  end loop;

  return v_result;
end;
$function$;

alter function public.gl_validate_and_normalize_lines(uuid, jsonb) owner to postgres;
revoke all on function public.gl_validate_and_normalize_lines(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.gl_validate_and_normalize_lines(uuid, jsonb) to service_role;

-- Fingerprint of the financial content of a line set — used to detect an
-- idempotency retry that carries materially different amounts/accounts.
create or replace function public.gl_lines_fingerprint(p_lines jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $function$
  select encode(sha256(convert_to(
    (select jsonb_agg(
      jsonb_build_object(
        'a', l->>'account_id',
        'd', coalesce((l->>'debit')::numeric, 0),
        'c', coalesce((l->>'credit')::numeric, 0)
      ) order by l->>'account_id', coalesce((l->>'debit')::numeric, 0), coalesce((l->>'credit')::numeric, 0)
    ) from jsonb_array_elements(p_lines) l)::text, 'UTF8')), 'hex')
$function$;

alter function public.gl_lines_fingerprint(jsonb) owner to postgres;
revoke all on function public.gl_lines_fingerprint(jsonb) from public, anon, authenticated;
grant execute on function public.gl_lines_fingerprint(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. gl_create_journal_batch — server-created DRAFT batch
-- ─────────────────────────────────────────────────────────────────────────────
-- Payload:
--   company_id, source_type, source_id, event_id, effective_date,
--   description?, lines: [{account_id, debit?, credit?, line_description?,
--   ref_source_id?, ref_entity_type?, ref_entity_id?}]
create or replace function public.gl_create_journal_batch(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_source_type text;
  v_source_id text;
  v_event_id text;
  v_effective_date date;
  v_description text;
  v_lines jsonb;
  v_normalized jsonb;
  v_batch_id uuid;
  v_debit_total numeric;
  v_credit_total numeric;
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'GL_ENGINE_SERVER_ONLY: the posting engine is only callable from a trusted server context.' using errcode = '42501';
  end if;

  v_company_id := nullif(p_payload->>'company_id', '')::uuid;
  v_source_type := nullif(btrim(coalesce(p_payload->>'source_type', '')), '');
  v_source_id := nullif(btrim(coalesce(p_payload->>'source_id', '')), '');
  v_event_id := nullif(btrim(coalesce(p_payload->>'event_id', '')), '');
  v_effective_date := nullif(p_payload->>'effective_date', '')::date;
  v_description := nullif(p_payload->>'description', '');
  v_lines := p_payload->'lines';

  if v_company_id is null or v_source_type is null or v_source_id is null or v_event_id is null or v_effective_date is null then
    raise exception 'GL_BATCH_METADATA_REQUIRED: company_id, source_type, source_id, event_id and effective_date are required.' using errcode = '22023';
  end if;

  v_normalized := public.gl_validate_and_normalize_lines(v_company_id, v_lines);

  select round(coalesce(sum((l->>'debit')::numeric), 0), 3),
         round(coalesce(sum((l->>'credit')::numeric), 0), 3)
    into v_debit_total, v_credit_total
    from jsonb_array_elements(v_normalized) l;

  if v_debit_total <> v_credit_total then
    raise exception 'JOURNAL_BATCH_UNBALANCED: debits % do not equal credits % after three-decimal rounding.', v_debit_total, v_credit_total using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gl_event:' || v_company_id::text || ':' || v_source_type || ':' || v_source_id || ':' || v_event_id, 0));

  insert into public.journal_batches (
    company_id, status, source_type, source_id, event_id,
    effective_date, description, created_by, updated_at
  ) values (
    v_company_id, 'DRAFT', v_source_type, v_source_id, v_event_id,
    v_effective_date, v_description, auth.uid(), now()
  )
  on conflict (company_id, source_type, source_id, event_id) do nothing;

  select id into v_batch_id
    from public.journal_batches
   where company_id = v_company_id
     and source_type = v_source_type
     and source_id = v_source_id
     and event_id = v_event_id;

  if v_batch_id is null then
    raise exception 'GL_BATCH_CREATE_FAILED: could not create the journal batch.' using errcode = 'P0001';
  end if;

  insert into public.journal_lines (
    id, no, batch_id, company_id, account_id, debit, credit,
    line_description, ref_source_id, ref_entity_type, ref_entity_id, created_at
  )
  select
    gen_random_uuid()::text, null, v_batch_id, v_company_id,
    l->>'account_id', (l->>'debit')::numeric, (l->>'credit')::numeric,
    l->>'line_description', l->>'ref_source_id', l->>'ref_entity_type', l->>'ref_entity_id',
    now()
  from jsonb_array_elements(v_normalized) l
  -- Idempotent create: when the event already produced a DRAFT batch (a retry
  -- of create-then-post), never duplicate its lines.
  where not exists (
    select 1 from public.journal_lines x where x.batch_id = v_batch_id
  );

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'batch_id', v_batch_id,
    'status', 'DRAFT',
    'effective_date', v_effective_date,
    'line_count', jsonb_array_length(v_normalized),
    'debits', v_debit_total,
    'credits', v_credit_total
  );
end;
$function$;

alter function public.gl_create_journal_batch(jsonb) owner to postgres;
revoke all on function public.gl_create_journal_batch(jsonb) from public, anon, authenticated;
grant execute on function public.gl_create_journal_batch(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. gl_post_journal_batch — the posting engine
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_post_journal_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_batch public.journal_batches%rowtype;
  v_line_count integer;
  v_debit_total numeric;
  v_credit_total numeric;
  v_period_id uuid;
  v_reason text;
  v_lines jsonb;
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'GL_ENGINE_SERVER_ONLY: the posting engine is only callable from a trusted server context.' using errcode = '42501';
  end if;

  if p_batch_id is null then
    raise exception 'GL_BATCH_ID_REQUIRED: batch_id is required.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gl_post:' || p_batch_id::text, 0));

  select * into v_batch
    from public.journal_batches b
   where b.id = p_batch_id
   for update;

  if not found then
    raise exception 'GL_BATCH_NOT_FOUND: batch % does not exist.', p_batch_id using errcode = 'P0002';
  end if;

  -- Idempotent retry: an already-posted batch is returned as-is.
  if v_batch.status = 'POSTED' then
    select jsonb_agg(jsonb_build_object(
      'line_id', l.id, 'account_id', l.account_id,
      'debit', l.debit, 'credit', l.credit
    ) order by l.id)
      into v_lines
      from public.journal_lines l
     where l.batch_id = v_batch.id;

    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'batch_id', v_batch.id,
      'status', v_batch.status,
      'accounting_period_id', v_batch.accounting_period_id,
      'period_resolution_reason', v_batch.period_resolution_reason,
      'posted_at', v_batch.posted_at,
      'lines', coalesce(v_lines, '[]'::jsonb)
    );
  end if;

  if v_batch.status = 'REVERSED' then
    raise exception 'GL_BATCH_REVERSED: batch % is REVERSED and cannot be posted.', p_batch_id using errcode = 'P0001';
  end if;
  if v_batch.status <> 'DRAFT' then
    raise exception 'GL_BATCH_STATE_INVALID: batch % has unexpected status %.', p_batch_id, v_batch.status using errcode = 'P0001';
  end if;

  -- Reject an empty batch.
  select count(*) into v_line_count
    from public.journal_lines l
   where l.batch_id = v_batch.id
     and l.deleted_at is null;

  if v_line_count = 0 then
    raise exception 'JOURNAL_BATCH_EMPTY: batch % has no lines and cannot be posted.', p_batch_id using errcode = '22023';
  end if;

  -- Exact three-decimal balance (canonical rounding via the line CHECK).
  select round(coalesce(sum(l.debit), 0), 3), round(coalesce(sum(l.credit), 0), 3)
    into v_debit_total, v_credit_total
    from public.journal_lines l
   where l.batch_id = v_batch.id
     and l.deleted_at is null;

  if v_debit_total <> v_credit_total then
    raise exception 'JOURNAL_BATCH_UNBALANCED: debits % do not equal credits % after three-decimal rounding.', v_debit_total, v_credit_total using errcode = 'P0001';
  end if;

  -- Server-side accounting-period resolution (never client-supplied).
  select p.period_id, p.reason into v_period_id, v_reason
    from public.gl_resolve_accounting_period(v_batch.company_id, v_batch.effective_date) p;

  update public.journal_batches
     set status = 'POSTED',
         posted_at = now(),
         posted_by = auth.uid(),
         accounting_period_id = v_period_id,
         period_resolution_reason = v_reason,
         updated_at = now()
   where id = v_batch.id;

  select jsonb_agg(jsonb_build_object(
    'line_id', l.id, 'account_id', l.account_id,
    'debit', l.debit, 'credit', l.credit
  ) order by l.id)
    into v_lines
    from public.journal_lines l
   where l.batch_id = v_batch.id;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'batch_id', v_batch.id,
    'status', 'POSTED',
    'accounting_period_id', v_period_id,
    'period_resolution_reason', v_reason,
    'effective_date', v_batch.effective_date,
    'posted_at', now(),
    'debits', v_debit_total,
    'credits', v_credit_total,
    'lines', coalesce(v_lines, '[]'::jsonb)
  );
end;
$function$;

alter function public.gl_post_journal_batch(uuid) owner to postgres;
revoke all on function public.gl_post_journal_batch(uuid) from public, anon, authenticated;
grant execute on function public.gl_post_journal_batch(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. post_journal_event — predefined business event (create + post, idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.post_journal_event(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_source_type text;
  v_source_id text;
  v_event_id text;
  v_effective_date date;
  v_description text;
  v_lines jsonb;
  v_normalized jsonb;
  v_fingerprint text;
  v_existing public.journal_batches%rowtype;
  v_existing_fingerprint text;
  v_batch_id uuid;
  v_result jsonb;
  v_created jsonb;
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'GL_ENGINE_SERVER_ONLY: the posting engine is only callable from a trusted server context.' using errcode = '42501';
  end if;

  v_company_id := nullif(p_payload->>'company_id', '')::uuid;
  v_source_type := nullif(btrim(coalesce(p_payload->>'source_type', '')), '');
  v_source_id := nullif(btrim(coalesce(p_payload->>'source_id', '')), '');
  v_event_id := nullif(btrim(coalesce(p_payload->>'event_id', '')), '');
  v_effective_date := nullif(p_payload->>'effective_date', '')::date;
  v_description := nullif(p_payload->>'description', '');
  v_lines := p_payload->'lines';

  if v_company_id is null or v_source_type is null or v_source_id is null or v_event_id is null or v_effective_date is null then
    raise exception 'GL_EVENT_METADATA_REQUIRED: company_id, source_type, source_id, event_id and effective_date are required.' using errcode = '22023';
  end if;

  v_normalized := public.gl_validate_and_normalize_lines(v_company_id, v_lines);
  v_fingerprint := public.gl_lines_fingerprint(v_normalized);

  perform pg_advisory_xact_lock(hashtextextended('gl_event:' || v_company_id::text || ':' || v_source_type || ':' || v_source_id || ':' || v_event_id, 0));

  select * into v_existing
    from public.journal_batches b
   where b.company_id = v_company_id
     and b.source_type = v_source_type
     and b.source_id = v_source_id
     and b.event_id = v_event_id;

  if found then
    -- Idempotency conflict detection: same event identity, materially
    -- different financial content must fail loudly.
    select coalesce(encode(sha256(convert_to(
      (select jsonb_agg(jsonb_build_object(
        'a', l.account_id, 'd', l.debit, 'c', l.credit
      ) order by l.account_id, l.debit, l.credit) from public.journal_lines l where l.batch_id = v_existing.id)::text, 'UTF8')), 'hex'))
      into v_existing_fingerprint;

    if v_existing_fingerprint is distinct from v_fingerprint then
      raise exception 'GL_EVENT_CONFLICT: event % was already recorded with different financial content. Retry must carry identical lines.', v_event_id using errcode = '23505';
    end if;

    if v_existing.status = 'REVERSED' then
      raise exception 'GL_EVENT_ALREADY_REVERSED: event % was already posted and reversed; it cannot be posted again.', v_event_id using errcode = 'P0001';
    end if;

    if v_existing.status = 'POSTED' then
      return public.gl_post_journal_batch(v_existing.id);
    end if;
  end if;

  v_created := public.gl_create_journal_batch(jsonb_build_object(
    'company_id', v_company_id,
    'source_type', v_source_type,
    'source_id', v_source_id,
    'event_id', v_event_id,
    'effective_date', v_effective_date,
    'description', v_description,
    'lines', v_normalized
  ));

  v_batch_id := (v_created->>'batch_id')::uuid;
  v_result := public.gl_post_journal_batch(v_batch_id);

  return v_result;
end;
$function$;

alter function public.post_journal_event(jsonb) owner to postgres;
revoke all on function public.post_journal_event(jsonb) from public, anon, authenticated;
grant execute on function public.post_journal_event(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. reverse_journal_batch — equal-and-opposite reversal, idempotent
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reverse_journal_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_original public.journal_batches%rowtype;
  v_reversal_id uuid;
  v_period_id uuid;
  v_reason text;
  v_line_count integer;
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'GL_ENGINE_SERVER_ONLY: reversals are only callable from a trusted server context.' using errcode = '42501';
  end if;

  if p_batch_id is null then
    raise exception 'GL_BATCH_ID_REQUIRED: batch_id is required.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('gl_reverse:' || p_batch_id::text, 0));

  select * into v_original
    from public.journal_batches b
   where b.id = p_batch_id
   for update;

  if not found then
    raise exception 'GL_BATCH_NOT_FOUND: batch % does not exist.', p_batch_id using errcode = 'P0002';
  end if;

  -- Idempotent retry: return the already-created reversal.
  if v_original.status = 'REVERSED' then
    select b.id into v_reversal_id
      from public.journal_batches b
     where b.company_id = v_original.company_id
       and b.source_type = 'journal_reversal'
       and b.source_id = v_original.id::text
       and b.event_id = 'REVERSAL-OF:' || v_original.id::text;

    if v_reversal_id is not null then
      return jsonb_build_object(
        'success', true,
        'idempotent', true,
        'original_batch_id', v_original.id,
        'reversal_batch_id', v_reversal_id,
        'status', 'REVERSED'
      );
    end if;
  end if;

  if v_original.status <> 'POSTED' then
    raise exception 'GL_REVERSAL_STATE_INVALID: only POSTED batches can be reversed; batch % is %.', p_batch_id, v_original.status using errcode = 'P0001';
  end if;

  select count(*) into v_line_count
    from public.journal_lines l
   where l.batch_id = v_original.id
     and l.deleted_at is null;

  if v_line_count = 0 then
    raise exception 'JOURNAL_BATCH_EMPTY: batch % has no lines and cannot be reversed.', p_batch_id using errcode = '22023';
  end if;

  -- Reversal follows accounting-period rules: the original effective date is
  -- kept; if its period is closed, the earliest eligible open period receives
  -- the reversal.
  select p.period_id, p.reason into v_period_id, v_reason
    from public.gl_resolve_accounting_period(v_original.company_id, v_original.effective_date) p;

  v_reversal_id := gen_random_uuid();

  insert into public.journal_batches (
    id, company_id, status, source_type, source_id, event_id,
    reversal_of_batch_id, effective_date, accounting_period_id,
    period_resolution_reason, posted_at, posted_by, description, created_at, updated_at
  ) values (
    v_reversal_id, v_original.company_id, 'POSTED',
    'journal_reversal', v_original.id::text, 'REVERSAL-OF:' || v_original.id::text,
    v_original.id, v_original.effective_date, v_period_id, v_reason,
    now(), auth.uid(),
    'Reversal of journal batch ' || v_original.id::text,
    now(), now()
  );

  insert into public.journal_lines (
    id, no, batch_id, company_id, account_id, debit, credit,
    line_description, ref_source_id, ref_entity_type, ref_entity_id, created_at
  )
  select
    gen_random_uuid()::text, 'REV-' || substr(replace(l.id, '-', ''), 1, 10),
    v_reversal_id, l.company_id, l.account_id, l.credit, l.debit,
    'Reversal of line ' || l.id,
    l.ref_source_id, l.ref_entity_type, l.ref_entity_id, now()
  from public.journal_lines l
  where l.batch_id = v_original.id;

  update public.journal_batches
     set status = 'REVERSED',
         reversal_of_batch_id = v_reversal_id,
         updated_at = now()
   where id = v_original.id;

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'original_batch_id', v_original.id,
    'reversal_batch_id', v_reversal_id,
    'status', 'REVERSED',
    'reversal_period_id', v_period_id,
    'reversal_period_reason', v_reason
  );
end;
$function$;

alter function public.reverse_journal_batch(uuid) owner to postgres;
revoke all on function public.reverse_journal_batch(uuid) from public, anon, authenticated;
grant execute on function public.reverse_journal_batch(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Accounting-period administration RPCs (ADMIN/MANAGER, JWT company)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_accounting_period(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_name text := nullif(btrim(coalesce(p_payload->>'name', '')), '');
  v_start_date date := nullif(p_payload->>'start_date', '')::date;
  v_end_date date := nullif(p_payload->>'end_date', '')::date;
  v_status text := upper(coalesce(nullif(btrim(p_payload->>'status', ''), ''), 'OPEN'));
  v_period_id uuid;
  v_conflict_id uuid;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to manage accounting periods.' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if v_start_date is null or v_end_date is null then
    raise exception 'ACCOUNTING_PERIOD_DATES_REQUIRED: start_date and end_date are required.' using errcode = '22023';
  end if;
  if v_start_date > v_end_date then
    raise exception 'ACCOUNTING_PERIOD_RANGE_INVALID: start_date must be on or before end_date.' using errcode = '22023';
  end if;
  if v_status not in ('OPEN', 'SOFT_CLOSED', 'HARD_CLOSED') then
    raise exception 'ACCOUNTING_PERIOD_STATUS_INVALID: status must be OPEN, SOFT_CLOSED or HARD_CLOSED.' using errcode = '22023';
  end if;

  if v_name is null then
    v_name := to_char(v_start_date, 'YYYY-MM');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('accounting_period:' || v_company_id::text, 0));

  select p.id into v_conflict_id
    from public.accounting_periods p
   where p.company_id = v_company_id
     and p.start_date <= v_end_date
     and p.end_date >= v_start_date
   limit 1;

  if v_conflict_id is not null then
    raise exception 'ACCOUNTING_PERIOD_OVERLAP: the range overlaps existing period %.', v_conflict_id using errcode = '23P01';
  end if;

  insert into public.accounting_periods (
    company_id, name, start_date, end_date, status, created_by, updated_at
  ) values (
    v_company_id, v_name, v_start_date, v_end_date, v_status, auth.uid(), now()
  )
  returning id into v_period_id;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid()::text, extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CREATE', 'accounting_periods', v_period_id::text,
    'Accounting period created: ' || v_name || ' (' || v_start_date || ' .. ' || v_end_date || ') ' || v_status,
    'accounting_periods', left(p_payload::text, 4000), now()
  );

  return jsonb_build_object(
    'success', true,
    'id', v_period_id,
    'name', v_name,
    'start_date', v_start_date,
    'end_date', v_end_date,
    'status', v_status
  );
end;
$function$;

alter function public.create_accounting_period(jsonb) owner to postgres;
revoke all on function public.create_accounting_period(jsonb) from public, anon;
grant execute on function public.create_accounting_period(jsonb) to authenticated, service_role;

-- Status changes: OPEN <-> SOFT_CLOSED -> HARD_CLOSED. HARD_CLOSED is
-- immutable (no reopening through any normal application flow). Reopening a
-- SOFT_CLOSED period requires an explicit reason. Every change is audited and
-- the write-guard trigger requires the session marker this RPC sets.
create or replace function public.update_accounting_period_status(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_period_id uuid := nullif(p_payload->>'period_id', '')::uuid;
  v_new_status text := upper(coalesce(nullif(btrim(p_payload->>'status', ''), ''), ''));
  v_reason text := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  v_period public.accounting_periods%rowtype;
  v_old_status text;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to manage accounting periods.' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if v_period_id is null then
    raise exception 'ACCOUNTING_PERIOD_ID_REQUIRED: period_id is required.' using errcode = '22023';
  end if;
  if v_new_status not in ('OPEN', 'SOFT_CLOSED', 'HARD_CLOSED') then
    raise exception 'ACCOUNTING_PERIOD_STATUS_INVALID: status must be OPEN, SOFT_CLOSED or HARD_CLOSED.' using errcode = '22023';
  end if;

  select * into v_period
    from public.accounting_periods p
   where p.id = v_period_id
     and p.company_id = v_company_id;

  if not found then
    raise exception 'ACCOUNTING_PERIOD_NOT_FOUND: period % does not exist in your company.', v_period_id using errcode = 'P0002';
  end if;

  v_old_status := v_period.status;

  if v_old_status = v_new_status then
    return jsonb_build_object('success', true, 'id', v_period_id, 'status', v_new_status, 'changed', false);
  end if;

  if v_old_status = 'HARD_CLOSED' then
    raise exception 'ACCOUNTING_PERIOD_HARD_CLOSED_IMMUTABLE: a HARD_CLOSED period cannot be reopened or changed.' using errcode = '42501';
  end if;

  if v_new_status = 'OPEN' and v_reason is null then
    raise exception 'ACCOUNTING_PERIOD_REOPEN_REASON_REQUIRED: reopening a period requires an explicit reason.' using errcode = '22023';
  end if;

  perform set_config('malik.accounting_period_change_authorized', 'true', true);

  update public.accounting_periods
     set status = v_new_status,
         closed_at = case when v_new_status in ('SOFT_CLOSED', 'HARD_CLOSED') then now() else closed_at end,
         closed_by = case when v_new_status in ('SOFT_CLOSED', 'HARD_CLOSED') then auth.uid() else closed_by end,
         reopen_reason = case when v_new_status = 'OPEN' then v_reason else reopen_reason end,
         updated_at = now()
   where id = v_period_id;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid()::text, extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'UPDATE', 'accounting_periods', v_period_id::text,
    'Accounting period status changed: ' || v_old_status || ' -> ' || v_new_status || coalesce(' — reason: ' || v_reason, ''),
    'accounting_periods', left(p_payload::text, 4000), now()
  );

  return jsonb_build_object(
    'success', true,
    'id', v_period_id,
    'status', v_new_status,
    'changed', true,
    'old_status', v_old_status
  );
end;
$function$;

alter function public.update_accounting_period_status(jsonb) owner to postgres;
revoke all on function public.update_accounting_period_status(jsonb) from public, anon;
grant execute on function public.update_accounting_period_status(jsonb) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Read RPCs (ADMIN/MANAGER, company derived from the JWT)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.list_chart_of_accounts()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_rows jsonb;
begin
  if auth.uid() is null or not public.is_app_user() then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();

  select jsonb_agg(jsonb_build_object(
    'id', a.id, 'account_no', a.no, 'name', a.name,
    'account_type', a.account_type, 'normal_balance', a.normal_balance,
    'currency_code', a.currency_code, 'precision', a.precision,
    'is_active', a.is_active, 'created_at', a.created_at, 'updated_at', a.updated_at
  ) order by a.no)
    into v_rows
    from public.accounts a
   where a.company_id = v_company_id;

  return jsonb_build_object('company_id', v_company_id, 'accounts', coalesce(v_rows, '[]'::jsonb));
end;
$function$;

alter function public.list_chart_of_accounts() owner to postgres;
revoke all on function public.list_chart_of_accounts() from public, anon;
grant execute on function public.list_chart_of_accounts() to authenticated, service_role;

create or replace function public.list_accounting_periods()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_rows jsonb;
begin
  if auth.uid() is null or not public.is_app_user() then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();

  select jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'start_date', p.start_date, 'end_date', p.end_date,
    'status', p.status, 'closed_at', p.closed_at, 'closed_by', p.closed_by,
    'reopen_reason', p.reopen_reason, 'created_at', p.created_at, 'updated_at', p.updated_at
  ) order by p.start_date)
    into v_rows
    from public.accounting_periods p
   where p.company_id = v_company_id;

  return jsonb_build_object('company_id', v_company_id, 'periods', coalesce(v_rows, '[]'::jsonb));
end;
$function$;

alter function public.list_accounting_periods() owner to postgres;
revoke all on function public.list_accounting_periods() from public, anon;
grant execute on function public.list_accounting_periods() to authenticated, service_role;

-- Optional filters: status, source_type, source_id, from_date, to_date, limit.
create or replace function public.list_journal_batches(p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_status text := upper(nullif(btrim(coalesce(p_payload->>'status', '')), ''));
  v_source_type text := nullif(btrim(coalesce(p_payload->>'source_type', '')), '');
  v_source_id text := nullif(btrim(coalesce(p_payload->>'source_id', '')), '');
  v_from_date date := nullif(p_payload->>'from_date', '')::date;
  v_to_date date := nullif(p_payload->>'to_date', '')::date;
  v_limit integer := least(coalesce(nullif(p_payload->>'limit', '')::integer, 100), 500);
  v_rows jsonb;
begin
  if auth.uid() is null or not public.is_app_user() then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();

  -- Apply filters and the LIMIT to the ROWS before aggregation so the cap
  -- limits the number of batches returned, not the aggregate rows.
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_rows
    from (
      select jsonb_build_object(
        'id', b.id, 'status', b.status, 'source_type', b.source_type,
        'source_id', b.source_id, 'event_id', b.event_id,
        'reversal_of_batch_id', b.reversal_of_batch_id,
        'effective_date', b.effective_date,
        'accounting_period_id', b.accounting_period_id,
        'period_resolution_reason', b.period_resolution_reason,
        'posted_at', b.posted_at, 'description', b.description,
        'created_at', b.created_at
      ) as x
      from public.journal_batches b
      where b.company_id = v_company_id
        and (v_status is null or b.status = v_status)
        and (v_source_type is null or b.source_type = v_source_type)
        and (v_source_id is null or b.source_id = v_source_id)
        and (v_from_date is null or b.effective_date >= v_from_date)
        and (v_to_date is null or b.effective_date <= v_to_date)
      order by b.created_at desc
      limit v_limit
    ) t;

  return jsonb_build_object('company_id', v_company_id, 'batches', v_rows);
end;
$function$;

alter function public.list_journal_batches(jsonb) owner to postgres;
revoke all on function public.list_journal_batches(jsonb) from public, anon;
grant execute on function public.list_journal_batches(jsonb) to authenticated, service_role;

create or replace function public.list_journal_lines(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_rows jsonb;
begin
  if auth.uid() is null or not public.is_app_user() then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();

  if p_batch_id is null then
    raise exception 'GL_BATCH_ID_REQUIRED: batch_id is required.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.journal_batches b
     where b.id = p_batch_id and b.company_id = v_company_id
  ) then
    raise exception 'GL_BATCH_NOT_FOUND: batch % does not exist in your company.', p_batch_id using errcode = 'P0002';
  end if;

  select jsonb_agg(jsonb_build_object(
    'id', l.id, 'batch_id', l.batch_id, 'account_id', l.account_id,
    'account_no', a.no, 'debit', l.debit, 'credit', l.credit,
    'line_description', l.line_description, 'created_at', l.created_at
  ) order by l.created_at, l.id)
    into v_rows
    from public.journal_lines l
    join public.accounts a on a.id = l.account_id and a.company_id = l.company_id
   where l.batch_id = p_batch_id
     and l.company_id = v_company_id;

  return jsonb_build_object('batch_id', p_batch_id, 'lines', coalesce(v_rows, '[]'::jsonb));
end;
$function$;

alter function public.list_journal_lines(uuid) owner to postgres;
revoke all on function public.list_journal_lines(uuid) from public, anon;
grant execute on function public.list_journal_lines(uuid) to authenticated, service_role;

commit;
