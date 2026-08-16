-- WP-01 / GAP-002 closeout correction.
-- Restore the canonical receipt-VOID approval audit contract after the
-- sole-admin override while retaining the audited exception semantics.

begin;

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
  v_is_sole_admin_exception boolean := false;
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

  v_is_sole_admin_exception := (v_request.requested_by = v_actor);

  if v_is_sole_admin_exception
     and not public.wp01_is_sole_admin_allowed(v_company_id) then
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
    'approval_request_id', v_execution_request_id,
    'is_sole_admin_exception', v_is_sole_admin_exception
  );

  update public.receipt_void_requests
     set status = 'EXECUTED',
         reviewed_by = v_actor,
         reviewed_at = now(),
         execution_request_id = v_execution_request_id,
         reversal_batch_id = nullif(v_result->>'journal_reversal_batch_id', '')::uuid,
         result_payload = v_result,
         is_sole_admin_exception = v_is_sole_admin_exception,
         updated_at = now()
   where id = v_request.id;

  -- Preserve the canonical audit action/entity contract used by release
  -- evidence and operational audit queries. The sole-admin flag is additive.
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
      'journal_reversal_batch_id', v_result->>'journal_reversal_batch_id',
      'is_sole_admin_exception', v_is_sole_admin_exception
    )::text,
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object(
      'status', 'EXECUTED',
      'requested_by', v_request.requested_by,
      'approved_by', v_actor,
      'is_sole_admin_exception', v_is_sole_admin_exception
    ),
    now(), now(), now()
  );

  return v_result || jsonb_build_object('idempotent', false);
end;
$function$;

revoke all on function public.approve_receipt_void_atomic(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.approve_receipt_void_atomic(jsonb)
  to authenticated;

commit;
