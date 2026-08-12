-- WP-01 / GAP-002: authoritative Maker-Checker lifecycle for receipt VOID.
-- Canonical rules: OPS-007, OPS-010, FIN-016, FIN-018, SEC-008, SEC-009, SEC-010.
--
-- Accounting basis: collected cash. A VOID never deletes posted history; final
-- approval delegates to the existing canonical reversal executor so receipt,
-- payment, invoice and GL reversal behavior remain unchanged.
--
-- Expand/contract posture:
--   * add an immutable, company-scoped request ledger;
--   * expose request + approve RPCs;
--   * make the historical one-step facade fail closed;
--   * preserve the existing engine-managed executor as an unexposed function.

begin;

create table if not exists public.receipt_void_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  receipt_id text not null,
  reason text not null,
  status text not null default 'PENDING',
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  request_id text not null,
  execution_request_id text,
  reversal_batch_id uuid,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receipt_void_requests_reason_chk
    check (length(btrim(reason)) between 1 and 2000),
  constraint receipt_void_requests_status_chk
    check (status in ('PENDING', 'EXECUTED', 'REJECTED', 'CANCELLED')),
  constraint receipt_void_requests_checker_chk
    check (reviewed_by is null or reviewed_by <> requested_by),
  constraint receipt_void_requests_review_state_chk
    check (
      (status = 'PENDING' and reviewed_by is null and reviewed_at is null)
      or
      (status <> 'PENDING' and reviewed_by is not null and reviewed_at is not null)
    ),
  constraint receipt_void_requests_request_key
    unique (company_id, request_id)
);

create unique index if not exists receipt_void_requests_one_pending_idx
  on public.receipt_void_requests (company_id, receipt_id)
  where status = 'PENDING';

create index if not exists receipt_void_requests_company_status_idx
  on public.receipt_void_requests (company_id, status, requested_at desc);

alter table public.receipt_void_requests enable row level security;

revoke all on table public.receipt_void_requests from public, anon, authenticated;
grant select on table public.receipt_void_requests to authenticated;
grant select, insert, update, delete on table public.receipt_void_requests to service_role;

drop policy if exists receipt_void_requests_company_select
  on public.receipt_void_requests;
create policy receipt_void_requests_company_select
  on public.receipt_void_requests
  for select
  to authenticated
  using (
    company_id = (select public.current_company_id())
    and exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.status::text = 'ACTIVE'
        and u.role::text in ('ADMIN', 'MANAGER')
    )
  );

comment on table public.receipt_void_requests is
  'WP-01 immutable request/review ledger for receipt VOID Maker-Checker. Browser roles have read-only company-scoped access; mutations are RPC-owned.';

-- Preserve the proven receipt/payment/invoice/GL executor installed and patched
-- by Phase 3A-1B and Stage S03. It is deliberately not callable by API roles.
do $rename$
begin
  if to_regprocedure('public.execute_receipt_void_internal(jsonb)') is null then
    if to_regprocedure('public.void_receipt_atomic(jsonb)') is null then
      raise exception 'WP01_RECEIPT_VOID_ABORT: canonical void_receipt_atomic(jsonb) executor is missing.';
    end if;
    alter function public.void_receipt_atomic(jsonb)
      rename to execute_receipt_void_internal;
  end if;
end
$rename$;

revoke all on function public.execute_receipt_void_internal(jsonb)
  from public, anon, authenticated, service_role;

comment on function public.execute_receipt_void_internal(jsonb) is
  'Internal engine-managed receipt VOID executor. Callable only by the governed approval RPC owner; never an exposed browser RPC.';

create or replace function public.request_receipt_void_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.current_company_id();
  v_requested_id text := nullif(btrim(payload->>'receipt_id'), '');
  v_reason text := nullif(btrim(payload->>'reason'), '');
  v_request_id text := nullif(btrim(payload->>'request_id'), '');
  v_receipt public.receipts%rowtype;
  v_existing public.receipt_void_requests%rowtype;
  v_row public.receipt_void_requests%rowtype;
begin
  if v_actor is null or not exists (
    select 1
    from public.users u
    where u.id = v_actor
      and u.status::text = 'ACTIVE'
      and u.role::text in ('ADMIN', 'MANAGER')
  ) then
    raise exception 'ADMIN or MANAGER role is required to request receipt VOID.'
      using errcode = '42501';
  end if;

  if v_company_id is null then
    raise exception 'Company context is required to request receipt VOID.'
      using errcode = '42501';
  end if;

  if v_requested_id is null or v_reason is null or v_request_id is null then
    raise exception 'receipt_id, reason, and request_id are required.'
      using errcode = '22023';
  end if;

  select r.*
    into v_receipt
  from public.receipts r
  where r.company_id = v_company_id
    and r.deleted_at is null
    and (
      r.id::text = v_requested_id
      or exists (
        select 1
        from public.payments p
        where p.company_id = v_company_id
          and p.deleted_at is null
          and p.id::text = v_requested_id
          and p.receipt_id::text = r.id::text
      )
    )
  order by case when r.id::text = v_requested_id then 0 else 1 end
  limit 1
  for update;

  if v_receipt.id is null then
    raise exception 'Receipt was not found in the active company.'
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('receipt_void_request:' || v_company_id::text || ':' || v_receipt.id::text, 0)
  );

  select q.*
    into v_existing
  from public.receipt_void_requests q
  where q.company_id = v_company_id
    and q.request_id = v_request_id
  for update;

  if v_existing.id is not null then
    if v_existing.receipt_id <> v_receipt.id::text
       or v_existing.reason <> v_reason
       or v_existing.requested_by <> v_actor then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode = '22023';
    end if;

    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'void_request_id', v_existing.id,
      'request_id', v_existing.request_id,
      'receipt_id', v_existing.receipt_id,
      'status', v_existing.status,
      'reason', v_existing.reason,
      'requested_by', v_existing.requested_by,
      'requested_at', v_existing.requested_at
    );
  end if;

  if upper(coalesce(v_receipt.status::text, '')) <> 'POSTED' then
    raise exception 'Only POSTED receipts can enter the VOID approval lifecycle.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.company_id = v_company_id
      and p.deleted_at is null
      and p.receipt_id::text = v_receipt.id::text
      and upper(coalesce(p.status::text, '')) = 'POSTED'
  ) then
    raise exception 'A linked POSTED payment is required to request receipt VOID.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.receipt_void_requests q
    where q.company_id = v_company_id
      and q.receipt_id = v_receipt.id::text
      and q.status = 'PENDING'
  ) then
    raise exception 'RECEIPT_VOID_ALREADY_PENDING'
      using errcode = '23505';
  end if;

  insert into public.receipt_void_requests (
    company_id, receipt_id, reason, requested_by, request_id
  ) values (
    v_company_id, v_receipt.id::text, v_reason, v_actor, v_request_id
  )
  returning * into v_row;

  update public.receipts
     set maker_user_id = v_actor,
         updated_at = now()
   where id::text = v_receipt.id::text
     and company_id = v_company_id;

  insert into public.audit_log (
    id, ts, user_id, action, entity, entity_id, note, "table", details,
    old_value, new_value, action_timestamp, created_at, updated_at
  ) values (
    gen_random_uuid()::text,
    extract(epoch from now())::bigint,
    v_actor::text,
    'REQUEST_RECEIPT_VOID',
    'receipt_void_request',
    v_row.id::text,
    'Receipt VOID requested; financial state remains unchanged pending separate approval.',
    'receipt_void_requests',
    jsonb_build_object(
      'company_id', v_company_id,
      'receipt_id', v_row.receipt_id,
      'reason', v_row.reason,
      'request_id', v_row.request_id,
      'requested_by', v_row.requested_by
    )::text,
    null,
    jsonb_build_object('status', 'PENDING'),
    now(), now(), now()
  );

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'void_request_id', v_row.id,
    'request_id', v_row.request_id,
    'receipt_id', v_row.receipt_id,
    'status', v_row.status,
    'reason', v_row.reason,
    'requested_by', v_row.requested_by,
    'requested_at', v_row.requested_at
  );
end;
$function$;

revoke all on function public.request_receipt_void_atomic(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.request_receipt_void_atomic(jsonb)
  to authenticated;

create or replace function public.approve_receipt_void_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.current_company_id();
  v_void_request_id uuid := nullif(btrim(payload->>'void_request_id'), '')::uuid;
  v_execution_request_id text := nullif(btrim(payload->>'request_id'), '');
  v_request public.receipt_void_requests%rowtype;
  v_result jsonb;
begin
  if v_actor is null or not exists (
    select 1
    from public.users u
    where u.id = v_actor
      and u.status::text = 'ACTIVE'
      and u.role::text in ('ADMIN', 'MANAGER')
  ) then
    raise exception 'ADMIN or MANAGER role is required to approve receipt VOID.'
      using errcode = '42501';
  end if;

  if v_company_id is null then
    raise exception 'Company context is required to approve receipt VOID.'
      using errcode = '42501';
  end if;

  if v_void_request_id is null or v_execution_request_id is null then
    raise exception 'void_request_id and request_id are required.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('receipt_void_approval:' || v_company_id::text || ':' || v_void_request_id::text, 0)
  );

  select q.*
    into v_request
  from public.receipt_void_requests q
  where q.id = v_void_request_id
    and q.company_id = v_company_id
  for update;

  if v_request.id is null then
    raise exception 'Receipt VOID request was not found in the active company.'
      using errcode = 'P0002';
  end if;

  if v_request.status = 'EXECUTED' then
    if v_request.execution_request_id <> v_execution_request_id
       or v_request.result_payload is null then
      raise exception 'RECEIPT_VOID_REQUEST_ALREADY_EXECUTED'
        using errcode = '22023';
    end if;
    return v_request.result_payload || jsonb_build_object('idempotent', true);
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'Only PENDING receipt VOID requests can be approved.'
      using errcode = '22023';
  end if;

  if v_request.requested_by = v_actor then
    raise exception 'MAKER_CHECKER_SELF_APPROVAL_DENIED: receipt VOID requester cannot approve the same request.'
      using errcode = '42501';
  end if;

  v_result := public.execute_receipt_void_internal(jsonb_build_object(
    'receipt_id', v_request.receipt_id,
    'reason', v_request.reason,
    'request_id', 'void-approved:' || v_execution_request_id
  ));

  v_result := v_result || jsonb_build_object(
    'void_request_id', v_request.id,
    'void_request_status', 'EXECUTED',
    'requested_by', v_request.requested_by,
    'approved_by', v_actor,
    'approval_request_id', v_execution_request_id
  );

  update public.receipt_void_requests
     set status = 'EXECUTED',
         reviewed_by = v_actor,
         reviewed_at = now(),
         execution_request_id = v_execution_request_id,
         reversal_batch_id = nullif(v_result->>'journal_reversal_batch_id', '')::uuid,
         result_payload = v_result,
         updated_at = now()
   where id = v_request.id;

  insert into public.audit_log (
    id, ts, user_id, action, entity, entity_id, note, "table", details,
    old_value, new_value, action_timestamp, created_at, updated_at
  ) values (
    gen_random_uuid()::text,
    extract(epoch from now())::bigint,
    v_actor::text,
    'APPROVE_RECEIPT_VOID',
    'receipt_void_request',
    v_request.id::text,
    'Receipt VOID separately approved and executed through the canonical reversal engine.',
    'receipt_void_requests',
    jsonb_build_object(
      'company_id', v_company_id,
      'receipt_id', v_request.receipt_id,
      'reason', v_request.reason,
      'requested_by', v_request.requested_by,
      'approved_by', v_actor,
      'approval_request_id', v_execution_request_id,
      'journal_reversal_batch_id', v_result->>'journal_reversal_batch_id'
    )::text,
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object(
      'status', 'EXECUTED',
      'requested_by', v_request.requested_by,
      'approved_by', v_actor
    ),
    now(), now(), now()
  );

  return v_result;
end;
$function$;

revoke all on function public.approve_receipt_void_atomic(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.approve_receipt_void_atomic(jsonb)
  to authenticated;

-- Keep the historical signature present so stale clients fail with an explicit
-- governed error instead of silently receiving a PostgREST "function missing".
create or replace function public.void_receipt_atomic(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  raise exception 'RECEIPT_VOID_REQUIRES_MAKER_CHECKER: call request_receipt_void_atomic, then approve_receipt_void_atomic as a different authorized user.'
    using errcode = '42501';
end;
$function$;

revoke all on function public.void_receipt_atomic(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.void_receipt_atomic(jsonb)
  to authenticated;

comment on function public.request_receipt_void_atomic(jsonb) is
  'WP-01 OPS-007/SEC-008: creates an idempotent company-scoped PENDING receipt VOID request with mandatory reason and immutable maker identity.';
comment on function public.approve_receipt_void_atomic(jsonb) is
  'WP-01 OPS-007/SEC-008: distinct ADMIN/MANAGER checker executes a PENDING receipt VOID request through the canonical reversal engine.';
comment on function public.void_receipt_atomic(jsonb) is
  'Fail-closed compatibility facade. Direct one-step receipt VOID is prohibited by WP-01 Maker-Checker.';

commit;
