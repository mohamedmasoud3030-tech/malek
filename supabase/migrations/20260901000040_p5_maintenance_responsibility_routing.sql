-- P5 product-intent closeout: maintenance responsibility must drive the
-- canonical financial path instead of being presentation-only.
--
-- No new financial engine is introduced. The existing
-- create_expense_with_journal_atomic authority remains the only expense
-- posting path; this function only maps a resolved maintenance record to the
-- approved responsibility values OWNER / TENANT / COMPANY and links the
-- resulting posted expense back to maintenance_records.

begin;

create or replace function public.resolve_maintenance_with_expense(
  p_request_id text,
  p_cost numeric,
  p_notes text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_record public.maintenance_records;
  v_expense_result jsonb;
  v_expense_id text;
  v_company_id uuid;
  v_charged_to text;
begin
  if auth.uid() is null then
    raise exception 'غير مصرح: يجب تسجيل الدخول' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('ADMIN', 'MANAGER')
  ) then
    raise exception 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if p_cost is null or p_cost < 0 then
    raise exception 'التكلفة يجب أن تكون رقماً موجباً أو صفراً' using errcode = '22023';
  end if;

  select * into v_record
  from public.maintenance_records
  where id::text = p_request_id
    and company_id = v_company_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'طلب الصيانة غير موجود' using errcode = 'P0002';
  end if;

  if lower(coalesce(v_record.status, 'open')) in ('resolved', 'closed', 'cancelled') then
    raise exception 'تم إغلاق هذا الطلب مسبقاً' using errcode = '23514';
  end if;

  v_charged_to := upper(btrim(coalesce(v_record.charged_to, '')));
  if v_charged_to not in ('OWNER', 'TENANT', 'COMPANY') then
    raise exception 'MAINTENANCE_RESPONSIBILITY_REQUIRED: حدد الجهة التي تتحمل التكلفة (المالك أو المستأجر أو المكتب) قبل الإغلاق'
      using errcode = '23514';
  end if;

  -- Resolution is one transaction. The existing expense authority owns all
  -- accounting decisions for OWNER / TENANT / COMPANY and returns the posted
  -- expense identity; maintenance never manufactures journal lines itself.
  if p_cost > 0 then
    v_expense_result := public.create_expense_with_journal_atomic(
      jsonb_build_object(
        'request_id', 'maintenance-resolve:' || p_request_id,
        'property_id', v_record.property_id,
        'category', 'صيانة',
        'amount', p_cost,
        'expense_date', current_date,
        'charged_to', v_charged_to,
        'description', coalesce(v_record.title, 'مصروف صيانة')
          || coalesce(' — ' || nullif(btrim(p_notes), ''), '')
      )
    );
    v_expense_id := nullif(v_expense_result->>'expense_id', '');
    if v_expense_id is null then
      raise exception 'MAINTENANCE_EXPENSE_LINK_MISSING: لم يرجع مسار المصروف المعتمد مرجع المصروف'
        using errcode = '23514';
    end if;
  end if;

  -- R8 lifecycle guard: only sanctioned commands may write status.
  perform set_config('malek.maintenance_transition_sanctioned', 'true', true);

  update public.maintenance_records
  set status = 'resolved',
      cost = p_cost,
      charged_to = v_charged_to,
      resolved_at = now(),
      notes = coalesce(nullif(btrim(p_notes), ''), notes),
      expense_id = coalesce(v_expense_id::uuid, expense_id),
      updated_at = now()
  where id::text = p_request_id
    and company_id = v_company_id
  returning * into v_record;

  return jsonb_build_object(
    'maintenance', to_jsonb(v_record),
    'expense_id', v_expense_id,
    'charged_to', v_charged_to
  );
end;
$function$;

alter function public.resolve_maintenance_with_expense(text, numeric, text) owner to postgres;
revoke all on function public.resolve_maintenance_with_expense(text, numeric, text) from public, anon;
grant execute on function public.resolve_maintenance_with_expense(text, numeric, text) to authenticated, service_role;

comment on function public.resolve_maintenance_with_expense(text, numeric, text) is
  'P5: resolves maintenance and routes cost through create_expense_with_journal_atomic using maintenance_records.charged_to (OWNER/TENANT/COMPANY). No presentation-only responsibility choice.';

notify pgrst, 'reload schema';

commit;
