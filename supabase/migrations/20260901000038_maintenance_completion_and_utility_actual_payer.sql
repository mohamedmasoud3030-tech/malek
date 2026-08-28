-- P3 Services: preserve the distinction between technical completion and
-- verified financial/operational closure. Utility actual payer is evidence
-- of who paid the provider and does not change obligation responsibility.
-- Final maintenance close composes the P3 lifecycle with the canonical
-- atomic expense authority. Financial vocabulary: OWNER/TENANT/COMPANY.

alter table public.utility_bills
  add column if not exists actual_payer text;

alter table public.utility_bills
  drop constraint if exists utility_bills_actual_payer_check;

alter table public.utility_bills
  add constraint utility_bills_actual_payer_check
  check (actual_payer is null or actual_payer in ('tenant', 'landlord', 'company'));

comment on column public.utility_bills.actual_payer is
  'Party that actually paid the provider; may differ from charged_to and never implies office collection.';

create or replace function public.transition_maintenance_status_atomic(
  p_request_id text,
  p_next_status text,
  p_reason text default null
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_row public.maintenance_records%rowtype;
  v_current text;
  v_next text := lower(btrim(coalesce(p_next_status, '')));
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;
  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'Company context is required.' using errcode = '42501';
  end if;

  select * into v_row
    from public.maintenance_records
   where id::text = p_request_id
     and company_id = v_company_id
     and deleted_at is null
   for update;
  if not found then
    raise exception 'طلب الصيانة غير موجود' using errcode = 'P0002';
  end if;
  v_current := lower(coalesce(v_row.status, 'open'));

  if v_next not in ('open', 'in_progress', 'resolved', 'cancelled') then
    raise exception 'MAINTENANCE_TRANSITION_UNSUPPORTED: % ليست حالة انتقال مدعومة عبر هذا الأمر', v_next using errcode = '23514';
  end if;
  if v_current = 'open' and v_next in ('in_progress', 'cancelled') then null;
  elsif v_current = 'in_progress' and v_next in ('open', 'resolved', 'cancelled') then null;
  elsif v_current in ('resolved', 'closed', 'cancelled') then
    raise exception 'MAINTENANCE_LIFECYCLE_TERMINAL: الحالة % نهائية ولا يمكن تغييرها', v_current using errcode = '23514';
  else
    raise exception 'MAINTENANCE_TRANSITION_ILLEGAL: الانتقال من % إلى % غير مسموح', v_current, v_next using errcode = '23514';
  end if;
  if v_next = 'cancelled' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'MAINTENANCE_CANCELLATION_REASON_REQUIRED: سبب الإلغاء إلزامي' using errcode = '22023';
  end if;

  perform set_config('malek.maintenance_transition_sanctioned', 'true', true);
  update public.maintenance_records
     set status = v_next,
         completed_at = case when v_next = 'resolved' then now() else completed_at end,
         cancelled_at = case when v_next = 'cancelled' then now() else cancelled_at end,
         cancellation_reason = case when v_next = 'cancelled' then btrim(p_reason) else cancellation_reason end,
         updated_at = now()
   where id = v_row.id;

  insert into public.audit_log (id, ts, user_id, action, entity, entity_id, note, "table", details, created_at)
  values (
    gen_random_uuid()::text, extract(epoch from now())::bigint, auth.uid()::text,
    'STATUS_' || upper(v_next), 'maintenance_records', p_request_id,
    case when v_next = 'resolved' then 'تم تنفيذ العمل فنيًا؛ بانتظار التحقق والإغلاق'
         when v_next = 'cancelled' then 'إلغاء طلب صيانة: ' || btrim(p_reason)
         else 'انتقال حالة صيانة عبر الأمر المعتمد' end,
    'maintenance_records',
    jsonb_build_object('from', v_current, 'to', v_next, 'reason', nullif(btrim(coalesce(p_reason, '')), ''))::text,
    now()
  );
  return (select to_jsonb(m) from public.maintenance_records m where m.id = v_row.id);
end;
$$;

create or replace function public.close_maintenance_with_expense(
  p_request_id text,
  p_cost numeric,
  p_charged_to text,
  p_notes text default null,
  p_evidence_url text default null,
  p_confirmed boolean default false
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_row public.maintenance_records%rowtype;
  v_charged_to text := upper(btrim(coalesce(p_charged_to, '')));
  v_expense_result jsonb;
  v_expense_id uuid;
begin
  if auth.uid() is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'ADMIN or MANAGER role is required to close maintenance financially.' using errcode = '42501';
  end if;
  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'Company context is required.' using errcode = '42501';
  end if;
  if not coalesce(p_confirmed, false) then
    raise exception 'MAINTENANCE_CONFIRMATION_REQUIRED: يجب تأكيد تنفيذ العمل قبل الإغلاق' using errcode = '23514';
  end if;
  if p_cost is null or p_cost < 0 or p_cost <> round(p_cost, 3) then
    raise exception 'MAINTENANCE_COST_INVALID: التكلفة الفعلية يجب أن تكون قيمة موجبة أو صفرية بدقة 3 منازل' using errcode = '22023';
  end if;
  if v_charged_to not in ('OWNER', 'TENANT', 'COMPANY') then
    raise exception 'MAINTENANCE_CHARGE_TARGET_INVALID: حدد المالك أو المستأجر أو المكتب' using errcode = '22023';
  end if;

  select * into v_row
    from public.maintenance_records
   where id::text = p_request_id
     and company_id = v_company_id
     and deleted_at is null
   for update;
  if not found then
    raise exception 'طلب الصيانة غير موجود' using errcode = 'P0002';
  end if;
  if lower(coalesce(v_row.status, '')) <> 'resolved' then
    raise exception 'MAINTENANCE_CLOSE_REQUIRES_COMPLETION: لا يمكن الإغلاق قبل تسجيل تم التنفيذ' using errcode = '23514';
  end if;

  if p_cost > 0 then
    v_expense_result := public.create_expense_with_journal_atomic(
      jsonb_build_object(
        'request_id', 'maintenance-close:' || p_request_id,
        'property_id', v_row.property_id,
        'category', 'صيانة',
        'amount', p_cost,
        'expense_date', current_date,
        'charged_to', v_charged_to,
        'description', coalesce(v_row.title, 'مصروف صيانة') || coalesce(' — ' || nullif(btrim(p_notes), ''), '')
      )
    );
    v_expense_id := nullif(v_expense_result->>'expense_id', '')::uuid;
    if v_expense_id is null then
      raise exception 'MAINTENANCE_EXPENSE_LINK_MISSING: لم يرجع مسار المصروف المعتمد مرجع المصروف' using errcode = '23514';
    end if;
  end if;

  perform set_config('malek.maintenance_transition_sanctioned', 'true', true);
  update public.maintenance_records
     set status = 'closed',
         cost = p_cost,
         charged_to = v_charged_to,
         notes = coalesce(nullif(btrim(p_notes), ''), notes),
         attachment_url = coalesce(nullif(btrim(p_evidence_url), ''), attachment_url),
         expense_id = coalesce(v_expense_id, expense_id),
         resolved_at = now(),
         updated_at = now()
   where id = v_row.id
   returning * into v_row;

  insert into public.audit_log (id, ts, user_id, action, entity, entity_id, note, "table", details, created_at)
  values (
    gen_random_uuid()::text, extract(epoch from now())::bigint, auth.uid()::text,
    'CLOSED_VERIFIED', 'maintenance_records', p_request_id,
    'إغلاق صيانة بعد تحقق تشغيلي ومالي', 'maintenance_records',
    jsonb_build_object(
      'cost', p_cost,
      'charged_to', v_charged_to,
      'expense_id', v_expense_id,
      'evidence_url', nullif(btrim(p_evidence_url), ''),
      'confirmed', true
    )::text,
    now()
  );
  return jsonb_build_object('maintenance', to_jsonb(v_row), 'expense_id', coalesce(v_expense_id, v_row.expense_id));
end;
$$;

revoke all on function public.close_maintenance_with_expense(text, numeric, text, text, text, boolean) from public, anon;
grant execute on function public.close_maintenance_with_expense(text, numeric, text, text, text, boolean) to authenticated, service_role;

comment on function public.transition_maintenance_status_atomic(text, text, text) is
  'P3 lifecycle: report → in progress → work completed. Final closure is handled by close_maintenance_with_expense after verification.';
comment on function public.close_maintenance_with_expense(text, numeric, text, text, text, boolean) is
  'P3 final maintenance closure: requires completed work, actual cost, responsibility and human confirmation; atomically posts the canonical expense and records optional evidence.';
