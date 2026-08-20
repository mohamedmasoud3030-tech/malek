-- =============================================================================
-- PR-C — Financial direct-write hardening: commissions
-- =============================================================================
-- Closes direct browser INSERT/UPDATE on public.commissions. Operational
-- create/update/cancel actions now run only through company-scoped SECURITY
-- DEFINER RPCs. Existing pay_commission_atomic/reverse_commission_atomic
-- accounting is intentionally unchanged.
--
-- Canonical status contract (20260718215711):
--   pending, approved, paid, cancelled
--
-- No journal entry, account mapping, revenue timing, settlement formula, or
-- historical financial data is changed by this migration.
-- Rollback: supabase/rollback/20260804_rollback_financial_direct_write_hardening_commissions.sql
-- =============================================================================

begin;

-- ── create_commission_atomic ─────────────────────────────────────────────────
create or replace function public.create_commission_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(btrim(p_payload->>'request_id'), '');
  v_staff_name text := nullif(btrim(p_payload->>'staff_name'), '');
  v_type text := lower(nullif(btrim(p_payload->>'type'), ''));
  v_source_id text := nullif(btrim(p_payload->>'source_id'), '');
  v_deal_value numeric := nullif(btrim(p_payload->>'deal_value'), '')::numeric;
  v_percentage numeric := nullif(btrim(p_payload->>'percentage'), '')::numeric;
  v_amount numeric := nullif(btrim(p_payload->>'amount'), '')::numeric;
  v_comm public.commissions%rowtype;
  v_cached jsonb;
  v_result jsonb;
  v_operation_name text;
  v_request_fingerprint text;
  v_cached_fingerprint text;
begin
  if auth.uid() is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عمولة'
      using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if v_staff_name is null then
    raise exception 'اسم الموظف أو الوسيط مطلوب.' using errcode = '22023';
  end if;
  if v_type is null or v_type not in ('contract', 'payment', 'owner', 'lead', 'land') then
    raise exception 'نوع مصدر العمولة غير صحيح.' using errcode = '22023';
  end if;
  if v_deal_value is not null and v_deal_value < 0 then
    raise exception 'قيمة الصفقة يجب أن تكون صفراً أو أكبر.' using errcode = '22023';
  end if;
  if v_percentage is not null and (v_percentage < 0 or v_percentage > 100) then
    raise exception 'نسبة العمولة يجب أن تكون بين صفر و100.' using errcode = '22023';
  end if;

  -- Preserve the existing application behavior exactly: an explicit amount
  -- wins; otherwise derive deal_value * percentage / 100 rounded to 2 decimals.
  if v_amount is null and v_deal_value is not null and v_percentage is not null then
    v_amount := round(v_deal_value * (v_percentage / 100.0), 2);
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'أدخل قيمة عمولة أكبر من صفر أو قيمة الصفقة والنسبة.'
      using errcode = '22023';
  end if;

  if v_request_id is null then
    v_request_id := gen_random_uuid()::text;
  end if;

  v_operation_name := 'create_commission_atomic:' || v_company_id::text;
  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'staff_name', v_staff_name,
    'type', v_type,
    'source_id', v_source_id,
    'deal_value', v_deal_value,
    'percentage', v_percentage,
    'amount', v_amount
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(
    hashtextextended(v_operation_name || ':' || v_request_id, 0)
  );

  select response_payload
    into v_cached
  from public.financial_operation_idempotency
  where operation_name = v_operation_name
    and request_id = v_request_id
  for update;

  if v_cached is not null then
    v_cached_fingerprint := v_cached->>'_request_fingerprint';
    if v_cached_fingerprint is null or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED'
        using errcode = '22023';
    end if;
    if v_cached_fingerprint <> v_request_fingerprint then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode = '22023';
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  insert into public.commissions (
    id, staff_name, type, status, source_id, deal_value, percentage, amount,
    paid_at, expense_id, company_id, created_at, updated_at
  ) values (
    gen_random_uuid()::text, v_staff_name, v_type, 'pending', v_source_id,
    v_deal_value, v_percentage, v_amount,
    null, null, v_company_id, now(), now()
  )
  returning * into v_comm;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CREATE', 'commissions', v_comm.id,
    'Commission created through trusted RPC with server-derived company and pending status',
    'commissions',
    left(jsonb_build_object(
      'request_id', v_request_id,
      'staff_name', v_staff_name,
      'type', v_type,
      'source_id', v_source_id,
      'deal_value', v_deal_value,
      'percentage', v_percentage,
      'amount', v_amount
    )::text, 4000),
    now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'commission_id', v_comm.id,
    'status', v_comm.status,
    'request_id', v_request_id,
    'commission', to_jsonb(v_comm)
  );

  insert into public.financial_operation_idempotency (
    operation_name, request_id, response_payload
  ) values (
    v_operation_name,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      'response', v_result
    )
  );

  return v_result;
end;
$function$;

-- ── update_commission_atomic ─────────────────────────────────────────────────
create or replace function public.update_commission_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_id text := nullif(btrim(p_payload->>'commission_id'), '');
  v_request_id text := nullif(btrim(p_payload->>'request_id'), '');
  v_staff_name text := nullif(btrim(p_payload->>'staff_name'), '');
  v_type text := lower(nullif(btrim(p_payload->>'type'), ''));
  v_requested_status text := lower(nullif(btrim(p_payload->>'requested_status'), ''));
  v_source_id text := nullif(btrim(p_payload->>'source_id'), '');
  v_deal_value numeric := nullif(btrim(p_payload->>'deal_value'), '')::numeric;
  v_percentage numeric := nullif(btrim(p_payload->>'percentage'), '')::numeric;
  v_amount numeric := nullif(btrim(p_payload->>'amount'), '')::numeric;
  v_comm public.commissions%rowtype;
  v_cached jsonb;
  v_result jsonb;
  v_operation_name text;
  v_request_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target_id text;
  v_old_status text;
  v_updated_count integer;
begin
  if auth.uid() is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لتعديل عمولة'
      using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if v_id is null then
    raise exception 'معرّف العمولة مطلوب' using errcode = '22023';
  end if;
  if v_staff_name is null then
    raise exception 'اسم الموظف أو الوسيط مطلوب.' using errcode = '22023';
  end if;
  if v_type is null or v_type not in ('contract', 'payment', 'owner', 'lead', 'land') then
    raise exception 'نوع مصدر العمولة غير صحيح.' using errcode = '22023';
  end if;
  if v_requested_status is null or v_requested_status not in ('pending', 'approved') then
    raise exception 'تعديل العمولة يسمح فقط بحالة pending أو approved؛ استخدم أمر الإلغاء أو الصرف للحالات النهائية.'
      using errcode = '22023';
  end if;
  if v_deal_value is not null and v_deal_value < 0 then
    raise exception 'قيمة الصفقة يجب أن تكون صفراً أو أكبر.' using errcode = '22023';
  end if;
  if v_percentage is not null and (v_percentage < 0 or v_percentage > 100) then
    raise exception 'نسبة العمولة يجب أن تكون بين صفر و100.' using errcode = '22023';
  end if;

  if v_amount is null and v_deal_value is not null and v_percentage is not null then
    v_amount := round(v_deal_value * (v_percentage / 100.0), 2);
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'أدخل قيمة عمولة أكبر من صفر أو قيمة الصفقة والنسبة.'
      using errcode = '22023';
  end if;

  if v_request_id is null then
    v_request_id := gen_random_uuid()::text;
  end if;

  v_operation_name := 'update_commission_atomic:' || v_company_id::text;
  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'commission_id', v_id,
    'staff_name', v_staff_name,
    'type', v_type,
    'requested_status', v_requested_status,
    'source_id', v_source_id,
    'deal_value', v_deal_value,
    'percentage', v_percentage,
    'amount', v_amount
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(
    hashtextextended(v_operation_name || ':' || v_request_id, 0)
  );

  select *
    into v_comm
  from public.commissions
  where id = v_id
    and company_id = v_company_id
  for update;

  if not found then
    raise exception 'COMMISSION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  select response_payload
    into v_cached
  from public.financial_operation_idempotency
  where operation_name = v_operation_name
    and request_id = v_request_id
  for update;

  if v_cached is not null then
    v_cached_fingerprint := v_cached->>'_request_fingerprint';
    v_cached_target_id := v_cached->>'_target_id';
    if v_cached_fingerprint is null
       or v_cached_target_id is null
       or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED'
        using errcode = '22023';
    end if;
    if v_cached_fingerprint <> v_request_fingerprint or v_cached_target_id <> v_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode = '22023';
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  v_old_status := lower(coalesce(v_comm.status, ''));
  if v_old_status = 'paid' then
    raise exception 'COMMISSION_PAID_IMMUTABLE' using errcode = '22023';
  end if;
  if v_old_status = 'cancelled' then
    raise exception 'COMMISSION_CANCELLED_IMMUTABLE' using errcode = '22023';
  end if;

  update public.commissions
     set staff_name = v_staff_name,
         type = v_type,
         status = v_requested_status,
         source_id = v_source_id,
         deal_value = v_deal_value,
         percentage = v_percentage,
         amount = v_amount,
         updated_at = now()
   where id = v_id
     and company_id = v_company_id
  returning * into v_comm;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'COMMISSION_UPDATE_COUNT_MISMATCH' using errcode = 'P0001';
  end if;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'UPDATE', 'commissions', v_id,
    'Commission updated through trusted RPC',
    'commissions',
    left(jsonb_build_object(
      'request_id', v_request_id,
      'old_status', v_old_status,
      'new_status', v_requested_status,
      'staff_name', v_staff_name,
      'type', v_type,
      'source_id', v_source_id,
      'deal_value', v_deal_value,
      'percentage', v_percentage,
      'amount', v_amount
    )::text, 4000),
    now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'commission_id', v_comm.id,
    'status', v_comm.status,
    'request_id', v_request_id,
    'commission', to_jsonb(v_comm)
  );

  insert into public.financial_operation_idempotency (
    operation_name, request_id, response_payload
  ) values (
    v_operation_name,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      '_target_id', v_id,
      'response', v_result
    )
  );

  return v_result;
end;
$function$;

-- ── cancel_commission_atomic ─────────────────────────────────────────────────
create or replace function public.cancel_commission_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_id text := nullif(btrim(p_payload->>'commission_id'), '');
  v_request_id text := nullif(btrim(p_payload->>'request_id'), '');
  v_comm public.commissions%rowtype;
  v_cached jsonb;
  v_result jsonb;
  v_operation_name text;
  v_request_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target_id text;
  v_updated_count integer;
begin
  if auth.uid() is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإلغاء عمولة'
      using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if v_id is null then
    raise exception 'معرّف العمولة مطلوب' using errcode = '22023';
  end if;
  if v_request_id is null then
    v_request_id := gen_random_uuid()::text;
  end if;

  v_operation_name := 'cancel_commission_atomic:' || v_company_id::text;
  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'commission_id', v_id
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(
    hashtextextended(v_operation_name || ':' || v_request_id, 0)
  );

  select *
    into v_comm
  from public.commissions
  where id = v_id
    and company_id = v_company_id
  for update;

  if not found then
    raise exception 'COMMISSION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  select response_payload
    into v_cached
  from public.financial_operation_idempotency
  where operation_name = v_operation_name
    and request_id = v_request_id
  for update;

  if v_cached is not null then
    v_cached_fingerprint := v_cached->>'_request_fingerprint';
    v_cached_target_id := v_cached->>'_target_id';
    if v_cached_fingerprint is null
       or v_cached_target_id is null
       or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED'
        using errcode = '22023';
    end if;
    if v_cached_fingerprint <> v_request_fingerprint or v_cached_target_id <> v_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode = '22023';
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  if lower(coalesce(v_comm.status, '')) = 'paid' then
    raise exception 'COMMISSION_PAID_REQUIRES_REVERSAL' using errcode = '22023';
  end if;

  if lower(coalesce(v_comm.status, '')) = 'cancelled' then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'already_cancelled', true,
      'commission_id', v_comm.id,
      'status', v_comm.status,
      'request_id', v_request_id,
      'commission', to_jsonb(v_comm)
    );
  end if;

  update public.commissions
     set status = 'cancelled',
         updated_at = now()
   where id = v_id
     and company_id = v_company_id
  returning * into v_comm;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'COMMISSION_UPDATE_COUNT_MISMATCH' using errcode = 'P0001';
  end if;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CANCEL', 'commissions', v_id,
    'Commission cancelled through trusted RPC; no journal entry created',
    'commissions',
    left(jsonb_build_object('request_id', v_request_id, 'commission_id', v_id)::text, 4000),
    now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'commission_id', v_comm.id,
    'status', v_comm.status,
    'request_id', v_request_id,
    'commission', to_jsonb(v_comm)
  );

  insert into public.financial_operation_idempotency (
    operation_name, request_id, response_payload
  ) values (
    v_operation_name,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      '_target_id', v_id,
      'response', v_result
    )
  );

  return v_result;
end;
$function$;

-- ── ownership and EXECUTE grants ─────────────────────────────────────────────
alter function public.create_commission_atomic(jsonb) owner to postgres;
alter function public.update_commission_atomic(jsonb) owner to postgres;
alter function public.cancel_commission_atomic(jsonb) owner to postgres;

revoke all on function public.create_commission_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.update_commission_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.cancel_commission_atomic(jsonb) from public, anon, authenticated;

grant execute on function public.create_commission_atomic(jsonb) to authenticated, service_role;
grant execute on function public.update_commission_atomic(jsonb) to authenticated, service_role;
grant execute on function public.cancel_commission_atomic(jsonb) to authenticated, service_role;

comment on function public.create_commission_atomic(jsonb) is
  'PR-C: creates a pending operational commission with server-derived company_id. Does not post a journal entry.';
comment on function public.update_commission_atomic(jsonb) is
  'PR-C: updates operational commission fields and only pending/approved status. Paid/cancelled rows are immutable.';
comment on function public.cancel_commission_atomic(jsonb) is
  'PR-C: cancels an unpaid commission. Paid commissions require reverse_commission_atomic.';

-- ── close the direct browser write surface ───────────────────────────────────
alter table public.commissions enable row level security;

drop policy if exists app_user_commissions on public.commissions;
drop policy if exists manager_write_commissions on public.commissions;
drop policy if exists app_read_commissions on public.commissions;
drop policy if exists commissions_select_own_company on public.commissions;

create policy commissions_select_own_company
  on public.commissions
  for select to authenticated
  using (
    public.is_app_user()
    and company_id = public.current_company_id()
  );

revoke insert, update, delete on public.commissions from authenticated;
revoke all on public.commissions from anon, public;
grant select on public.commissions to authenticated;

commit;
