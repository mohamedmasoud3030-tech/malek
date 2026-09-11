begin;

create or replace function public.update_commission_atomic(p_payload jsonb) returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
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
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لتعديل عمولة' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if v_id is null then raise exception 'معرّف العمولة مطلوب' using errcode = '22023'; end if;
  if v_staff_name is null then raise exception 'اسم الموظف أو الوسيط مطلوب.' using errcode = '22023'; end if;
  if v_type = 'payment' then raise exception 'COMMISSION_TYPE_PAYMENT_REMOVED: payment is not a commission source type in RC1; commissions attach to a contract, owner, lead or land source.' using errcode = '23514'; end if;
  if v_type is null or v_type not in ('contract', 'owner', 'lead', 'land') then raise exception 'نوع مصدر العمولة غير صحيح.' using errcode = '22023'; end if;
  if v_requested_status is null or v_requested_status not in ('pending', 'approved') then raise exception 'تعديل العمولة يسمح فقط بحالة pending أو approved؛ استخدم أمر الإلغاء أو الصرف للحالات النهائية.' using errcode = '22023'; end if;
  if v_deal_value is not null and v_deal_value < 0 then raise exception 'قيمة الصفقة يجب أن تكون صفراً أو أكبر.' using errcode = '22023'; end if;
  if v_percentage is not null and (v_percentage < 0 or v_percentage > 100) then raise exception 'نسبة العمولة يجب أن تكون بين صفر و100.' using errcode = '22023'; end if;
  if v_amount is null and v_deal_value is not null and v_percentage is not null then v_amount := round(v_deal_value * (v_percentage / 100.0), 2); end if;
  if v_amount is null or v_amount <= 0 then raise exception 'أدخل قيمة عمولة أكبر من صفر أو قيمة الصفقة والنسبة.' using errcode = '22023'; end if;
  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;
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
  perform pg_advisory_xact_lock(hashtextextended(v_operation_name || ':' || v_request_id, 0));
  select * into v_comm from public.commissions where id = v_id and company_id = v_company_id for update;
  if not found then raise exception 'COMMISSION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501'; end if;
  select response_payload into v_cached from public.financial_operation_idempotency where operation_name = v_operation_name and request_id = v_request_id for update;
  if v_cached is not null then
    v_cached_fingerprint := v_cached->>'_request_fingerprint';
    v_cached_target_id := v_cached->>'_target_id';
    if v_cached_fingerprint is null or v_cached_target_id is null or not (v_cached ? 'response') then raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED' using errcode = '22023'; end if;
    if v_cached_fingerprint <> v_request_fingerprint or v_cached_target_id <> v_id then raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode = '22023'; end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;
  v_old_status := lower(coalesce(v_comm.status, ''));
  if v_old_status = 'paid' then raise exception 'COMMISSION_PAID_IMMUTABLE' using errcode = '22023'; end if;
  if v_old_status = 'cancelled' then raise exception 'COMMISSION_CANCELLED_IMMUTABLE' using errcode = '22023'; end if;
  update public.commissions
     set staff_name = v_staff_name,
         type = v_type,
         status = v_requested_status,
         source_id = v_source_id,
         deal_value = v_deal_value,
         percentage = v_percentage,
         amount = v_amount,
         updated_at = now()
   where id = v_id and company_id = v_company_id
  returning * into v_comm;
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then raise exception 'COMMISSION_UPDATE_COUNT_MISMATCH' using errcode = 'P0001'; end if;
  insert into public.audit_log(id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values(gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(), (select email from auth.users where id = auth.uid()), 'UPDATE', 'commissions', v_id, 'Commission updated through trusted RPC', 'commissions', left(jsonb_build_object('request_id',v_request_id,'old_status',v_old_status,'new_status',v_requested_status,'staff_name',v_staff_name,'type',v_type,'source_id',v_source_id,'deal_value',v_deal_value,'percentage',v_percentage,'amount',v_amount)::text,4000), now());
  v_result := jsonb_build_object('success', true, 'idempotent', false, 'commission_id', v_comm.id, 'status', v_comm.status, 'request_id', v_request_id, 'commission', to_jsonb(v_comm));
  insert into public.financial_operation_idempotency(operation_name, request_id, response_payload)
  values(v_operation_name, v_request_id, jsonb_build_object('_request_fingerprint', v_request_fingerprint, '_target_id', v_id, 'response', v_result));
  return v_result;
end;
$$;

alter function public.update_commission_atomic(jsonb) owner to postgres;
comment on function public.update_commission_atomic(jsonb) is 'PR-C + RC1 closeout (Rule 4): updates operational commission fields and only pending/approved status; rejects the removed payment source type; paid/cancelled rows are immutable.';
comment on function public.create_commission_atomic(jsonb) is 'PR-C + RC1 closeout (Rule 4): creates a pending operational commission with server-derived company_id; rejects the removed payment source type; does not post a journal entry.';
comment on function public.guard_invoice_charge_type_rc1_scope() is 'RC1 fail-closed guard (D09/DP-4/ADR-0017 C): rejects invoice charge_type LATE_FEE on insert and update until the governed accounting mapping is approved.';
comment on function public.guard_automation_job_rc1_scope() is 'RC1 fail-closed guard (D09): rejects automation job_type LATE_FEE on insert and update until the governed late-fee feature is approved and implemented.';
commit;