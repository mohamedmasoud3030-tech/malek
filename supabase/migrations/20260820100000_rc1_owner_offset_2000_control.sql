-- ============================================================================
-- RC1 release integration — lawful owner offsets in Owner Funds Payable control
-- ============================================================================
--
-- GAP-008 already owns the lawful offset accounting event:
--   Dr 2000 Owner Funds Payable / Cr 1300 Due from Owners.
-- RC1 introduced owner_funds_events as the append-only operational control for
-- 2000, but the offset and its reversal were not represented there. That left a
-- legitimate 2000 debit outside the forward control and made the RC1 solvency
-- trigger unable to reason about the complete owner-funds lifecycle.
--
-- This fix-forward keeps the existing GAP-008 authorization, maker/checker,
-- evidence, ceiling and idempotency contracts. It only appends matching 2000
-- control events in the same transaction as the canonical journal event.
-- No posted history is rewritten.
-- ============================================================================

begin;

alter table public.owner_funds_events
  drop constraint if exists owner_funds_events_source_type_check;

alter table public.owner_funds_events
  add constraint owner_funds_events_source_type_check check (source_type in (
    'OFFICE_INVOICE',
    'OWNER_COLLECTION',
    'MANAGEMENT_FEE',
    'INVOICE_CREDIT',
    'INVOICE_CREDIT_REVERSAL',
    'RECEIPT_VOID_REVERSAL',
    'OWNER_SETTLEMENT_PAYOUT',
    'OWNER_OFFSET',
    'OWNER_OFFSET_REVERSAL'
  ));

create or replace function public.offset_owner_receivable_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_dfo_id uuid := nullif(p_payload->>'due_from_owner_id','')::uuid;
  v_settlement_id text := nullif(btrim(coalesce(p_payload->>'owner_settlement_id','')), '');
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_amount numeric := public.wp02_gap008_round_omr(nullif(p_payload->>'amount','')::numeric);
  v_date date := nullif(p_payload->>'effective_date','')::date;
  v_evidence text := nullif(btrim(coalesce(p_payload->>'lawful_offset_evidence','')), '');
  v_dfo public.due_from_owners%rowtype;
  v_settlement public.owner_settlements%rowtype;
  v_ofp_id text; v_due_id text; v_post jsonb; v_batch_id uuid;
  v_fp text; v_cached jsonb; v_id uuid := gen_random_uuid(); v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DUE_FROM_OWNER_OFFSET_ROLE_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if p_payload ?| array['company_id','amount_override','target_account'] then
    raise exception 'DUE_FROM_OWNER_OFFSET_SERVER_OWNED_FIELDS_FORBIDDEN' using errcode = '22023';
  end if;
  if v_dfo_id is null or v_settlement_id is null or v_request_id is null
     or v_amount is null or v_amount <= 0 or v_date is null or v_evidence is null or length(v_evidence) < 3 then
    raise exception 'DUE_FROM_OWNER_OFFSET_REQUEST_AMOUNT_DATE_EVIDENCE_REQUIRED' using errcode = '22023';
  end if;

  v_fp := encode(sha256(convert_to(jsonb_build_object(
    'due_from_owner_id', v_dfo_id,
    'owner_settlement_id', v_settlement_id,
    'amount', v_amount,
    'effective_date', v_date
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('due_from_owner_offset:' || v_company_id::text || ':' || v_request_id, 0));

  select response_payload into v_cached
    from public.financial_operation_idempotency
   where operation_name = 'offset_owner_receivable_atomic:' || v_company_id::text
     and request_id = v_request_id for update;
  if v_cached is not null then
    if v_cached->>'_request_fingerprint' is distinct from v_fp or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode = '22023';
    end if;
    return v_cached->'response';
  end if;

  select * into v_dfo from public.due_from_owners
   where id = v_dfo_id and company_id = v_company_id for update;
  if not found then
    raise exception 'DUE_FROM_OWNER_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;
  if v_dfo.status = 'REVERSED' then
    raise exception 'DUE_FROM_OWNER_OFFSET_REVERSED' using errcode = '22023';
  end if;
  if not v_dfo.lawful_offset_right then
    raise exception 'DUE_FROM_OWNER_OFFSET_RIGHT_MISSING: no enforceable contractual/legal offset right on this receivable.' using errcode = '23514';
  end if;
  if v_amount > v_dfo.outstanding + 0.001 then
    raise exception 'DUE_FROM_OWNER_OFFSET_EXCEEDS_OUTSTANDING' using errcode = '22023';
  end if;

  select * into v_settlement from public.owner_settlements
   where id = v_settlement_id and company_id = v_company_id for update;
  if not found then
    raise exception 'DUE_FROM_OWNER_OFFSET_SETTLEMENT_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;
  if v_settlement.owner_id::uuid is distinct from v_dfo.owner_id then
    raise exception 'DUE_FROM_OWNER_OFFSET_OWNER_MISMATCH' using errcode = '42501';
  end if;
  if v_settlement.status <> 'APPROVED' then
    raise exception 'DUE_FROM_OWNER_OFFSET_SETTLEMENT_NOT_APPROVED: offset is only permitted against an APPROVED (unpaid) owner payable.' using errcode = '22023';
  end if;
  if v_amount > public.wp02_gap008_round_omr(v_settlement.net_payable - v_settlement.offset_applied) + 0.001 then
    raise exception 'DUE_FROM_OWNER_OFFSET_EXCEEDS_PAYABLE: would force Owner Funds Payable negative.' using errcode = '22023';
  end if;

  v_ofp_id := public.gl_pm_require_account(v_company_id, '2000');
  v_due_id := public.gl_pm_require_account(v_company_id, '1300');
  v_post := public.post_journal_event(jsonb_build_object(
    'company_id', v_company_id,
    'source_type', 'pm_due_from_owner_offset',
    'source_id', v_dfo_id::text,
    'event_id', 'offset',
    'effective_date', v_date,
    'description', 'Lawful settlement offset: Owner Funds Payable against Due from Owner',
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_ofp_id, 'debit', v_amount, 'credit', 0,
        'ref_source_id', v_dfo_id::text, 'ref_entity_type', 'due_from_owner', 'ref_entity_id', v_dfo_id::text),
      jsonb_build_object('account_id', v_due_id, 'debit', 0, 'credit', v_amount,
        'ref_source_id', v_dfo_id::text, 'ref_entity_type', 'due_from_owner', 'ref_entity_id', v_dfo_id::text)
    )
  ));
  v_batch_id := (v_post->>'batch_id')::uuid;

  insert into public.due_from_owner_offsets (
    id, company_id, due_from_owner_id, owner_id, owner_settlement_id, amount, effective_date,
    request_id, source_fingerprint, journal_batch_id, lawful_offset_evidence, posted_by
  ) values (
    v_id, v_company_id, v_dfo_id, v_dfo.owner_id, v_settlement_id, v_amount, v_date,
    v_request_id, encode(sha256(convert_to(v_amount::text,'UTF8')),'hex'), v_batch_id, v_evidence, v_actor
  );

  -- Complete the RC1 2000 operational control in the same transaction. The
  -- owner-funds trigger sees the already-posted journal batch and therefore
  -- rejects atomically if this debit would make 2000 negative or if a required
  -- historical cutover has not been approved.
  insert into public.owner_funds_events (
    company_id, owner_id, contract_id, invoice_id, source_type, source_id,
    event_id, amount_delta, effective_date, journal_batch_id
  ) values (
    v_company_id, v_dfo.owner_id, null, null, 'OWNER_OFFSET', v_id::text,
    v_request_id, -v_amount, v_date, v_batch_id
  );

  update public.owner_settlements
     set offset_applied = public.wp02_gap008_round_omr(offset_applied + v_amount), updated_at = now()
   where id = v_settlement_id;

  update public.due_from_owners
     set offset_amount = public.wp02_gap008_round_omr(offset_amount + v_amount),
         outstanding = public.wp02_gap008_round_omr(outstanding - v_amount),
         status = case
           when public.wp02_gap008_round_omr(outstanding - v_amount) = 0 then 'CLOSED'
           else 'OFFSET' end,
         updated_at = now()
   where id = v_dfo_id;

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false, 'due_from_owner_id', v_dfo_id,
    'owner_settlement_id', v_settlement_id, 'amount', v_amount,
    'outstanding', public.wp02_gap008_round_omr(v_dfo.outstanding - v_amount),
    'journal_batch_id', v_batch_id,
    'status', case when public.wp02_gap008_round_omr(v_dfo.outstanding - v_amount) = 0 then 'CLOSED' else 'OFFSET' end,
    'request_id', v_request_id
  );
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('offset_owner_receivable_atomic:' || v_company_id::text, v_request_id,
          jsonb_build_object('_request_fingerprint', v_fp, 'response', v_result));
  return v_result;
end;
$fn$;

alter function public.offset_owner_receivable_atomic(jsonb) owner to postgres;
revoke all on function public.offset_owner_receivable_atomic(jsonb) from public, anon;
grant execute on function public.offset_owner_receivable_atomic(jsonb) to authenticated, service_role;

create or replace function public.reverse_owner_receivable_offset_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_event_id uuid := nullif(p_payload->>'offset_event_id','')::uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_reason text := nullif(btrim(coalesce(p_payload->>'reason','')), '');
  v_event public.due_from_owner_offsets%rowtype;
  v_rev jsonb;
  v_rev_batch uuid;
  v_rev_effective_date date;
  v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DUE_FROM_OWNER_OFFSET_REVERSE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if v_event_id is null or v_request_id is null or v_reason is null or length(v_reason) < 3 then
    raise exception 'DUE_FROM_OWNER_OFFSET_REVERSE_REQUEST_REASON_REQUIRED' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('due_from_owner_offset_reverse:' || v_company_id::text || ':' || v_event_id::text, 0));
  select * into v_event
    from public.due_from_owner_offsets
   where id = v_event_id and company_id = v_company_id
   for update;
  if not found then
    raise exception 'DUE_FROM_OWNER_OFFSET_EVENT_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;
  if v_event.status = 'REVERSED' then
    if v_event.reversed_request_id <> v_request_id then
      raise exception 'DUE_FROM_OWNER_OFFSET_REVERSE_IDEMPOTENCY_CONFLICT' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'success', true, 'idempotent', true, 'offset_event_id', v_event.id,
      'status', 'REVERSED', 'reversal_batch_id', v_event.reversal_journal_batch_id
    );
  end if;

  v_rev := public.reverse_journal_batch(v_event.journal_batch_id);
  v_rev_batch := (v_rev->>'reversal_batch_id')::uuid;
  select effective_date into v_rev_effective_date
    from public.journal_batches
   where id = v_rev_batch and company_id = v_company_id;
  if v_rev_effective_date is null then
    raise exception 'DUE_FROM_OWNER_OFFSET_REVERSE_BATCH_DATE_REQUIRED' using errcode='23514';
  end if;

  insert into public.owner_funds_events (
    company_id, owner_id, contract_id, invoice_id, source_type, source_id,
    event_id, amount_delta, effective_date, journal_batch_id
  ) values (
    v_company_id, v_event.owner_id, null, null, 'OWNER_OFFSET_REVERSAL', v_event.id::text,
    v_request_id, v_event.amount, v_rev_effective_date, v_rev_batch
  );

  update public.owner_settlements
     set offset_applied = greatest(public.wp02_gap008_round_omr(offset_applied - v_event.amount), 0),
         updated_at = now()
   where id = v_event.owner_settlement_id;

  update public.due_from_owners
     set offset_amount = public.wp02_gap008_round_omr(offset_amount - v_event.amount),
         outstanding = public.wp02_gap008_round_omr(outstanding + v_event.amount),
         status = case
           when public.wp02_gap008_round_omr(offset_amount - v_event.amount) <= 0 then 'OPEN'
           when public.wp02_gap008_round_omr(outstanding + v_event.amount) = 0 then 'CLOSED'
           else 'OFFSET' end,
         updated_at = now()
   where id = v_event.due_from_owner_id;

  update public.due_from_owner_offsets
     set status = 'REVERSED',
         reversed_request_id = v_request_id,
         reversal_journal_batch_id = v_rev_batch,
         updated_at = now()
   where id = v_event.id;

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false, 'offset_event_id', v_event.id,
    'status', 'REVERSED', 'reversal_batch_id', v_rev_batch
  );
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('reverse_owner_receivable_offset_atomic:' || v_company_id::text,
          v_request_id, jsonb_build_object('response', v_result));
  return v_result;
end;
$fn$;

alter function public.reverse_owner_receivable_offset_atomic(jsonb) owner to postgres;
revoke all on function public.reverse_owner_receivable_offset_atomic(jsonb) from public, anon;
grant execute on function public.reverse_owner_receivable_offset_atomic(jsonb) to authenticated, service_role;

comment on function public.offset_owner_receivable_atomic(jsonb) is
  'GAP-008 lawful Dr 2000 / Cr 1300 offset with RC1 append-only Owner Funds Payable control.';
comment on function public.reverse_owner_receivable_offset_atomic(jsonb) is
  'Compensating reversal of a lawful owner offset; restores 2000 control through an append-only owner-funds event.';

commit;
