begin;

create or replace function public.update_contract_atomic(
  p_contract_id text,
  p_property_id text,
  p_unit_id uuid,
  p_tenant_id uuid,
  p_agreement_id uuid,
  p_start_date date,
  p_end_date date,
  p_rent_amount numeric,
  p_payment_cycle text,
  p_payment_terms_id uuid,
  p_status text,
  p_cancellation_reason text,
  p_notes text,
  p_attachment_url text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_old public.contracts%rowtype;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لتعديل عقد' using errcode = '42501';
  end if;

  select * into v_old
  from public.contracts
  where id = p_contract_id and deleted_at is null
  for update;

  if not found then
    raise exception 'العقد غير موجود';
  end if;

  if v_old.status = 'terminated' and p_status <> 'terminated' then
    raise exception 'لا يمكن تعديل عقد تم إنهاؤه بالفعل';
  end if;
  if p_end_date <= p_start_date then
    raise exception 'تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية';
  end if;
  if p_rent_amount is null or p_rent_amount <= 0 then
    raise exception 'قيمة الإيجار يجب أن تكون أكبر من صفر';
  end if;
  if p_status not in ('draft', 'active', 'expired', 'terminated') then
    raise exception 'حالة العقد غير مدعومة';
  end if;
  if p_payment_cycle not in ('monthly', 'quarterly', 'semi_annual', 'annual') then
    raise exception 'دورة السداد غير مدعومة';
  end if;

  if not exists (
    select 1 from public.people p
    where p.id::text = p_tenant_id::text
      and p.type = 'tenant'
      and p.deleted_at is null
  ) then
    raise exception 'المستأجر غير موجود أو نوعه غير صحيح';
  end if;

  if not exists (
    select 1 from public.properties p
    where p.id = p_property_id and p.deleted_at is null
  ) then
    raise exception 'العقار غير موجود';
  end if;

  if p_unit_id is null or not exists (
    select 1 from public.units u
    where u.id = p_unit_id
      and u.property_id = p_property_id
      and u.deleted_at is null
  ) then
    raise exception 'الوحدة لا تنتمي إلى العقار المحدد';
  end if;

  if p_unit_id is distinct from v_old.unit_id and exists (
    select 1 from public.units u
    where u.id = p_unit_id
      and u.status in ('maintenance', 'reserved')
  ) then
    raise exception 'لا يمكن نقل العقد إلى وحدة تحت الصيانة أو محجوزة تشغيلياً';
  end if;

  if exists (
    select 1 from public.contracts c
    where c.unit_id = p_unit_id
      and c.id <> p_contract_id
      and c.deleted_at is null
      and lower(c.status) in ('active', 'draft')
      and btrim(c.start_date) ~ '^\d{4}-\d{2}-\d{2}$'
      and btrim(c.end_date) ~ '^\d{4}-\d{2}-\d{2}$'
      and btrim(c.start_date)::date <= p_end_date
      and btrim(c.end_date)::date >= p_start_date
  ) then
    raise exception 'الوحدة محجوزة خلال هذه الفترة';
  end if;

  if p_agreement_id is null then
    raise exception 'لا توجد اتفاقية مالك نشطة تغطي فترة العقد — أنشئ اتفاقية مالك أولاً';
  end if;

  if not exists (
    select 1 from public.owner_agreements oa
    where oa.id = p_agreement_id
      and oa.property_id = p_property_id
      and oa.starts_on <= p_start_date
      and (oa.ends_on is null or oa.ends_on >= p_end_date)
  ) then
    raise exception 'اتفاقية المالك لا تغطي فترة العقد بالكامل أو لا تنتمي لهذا العقار';
  end if;

  update public.contracts set
    property_id = p_property_id,
    unit_id = p_unit_id,
    tenant_id = p_tenant_id::text,
    agreement_id = p_agreement_id,
    start_date = p_start_date::text,
    end_date = p_end_date::text,
    rent_amount = p_rent_amount,
    payment_cycle = p_payment_cycle,
    payment_terms_id = p_payment_terms_id::text,
    status = p_status,
    cancellation_reason = p_cancellation_reason,
    notes = p_notes,
    attachment_url = p_attachment_url,
    updated_at = now()
  where id = p_contract_id;

  return (select to_jsonb(c) from public.contracts c where c.id = p_contract_id);
end;
$function$;

revoke execute on function public.update_contract_atomic(text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text) from public, anon;
grant execute on function public.update_contract_atomic(text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text) to authenticated, service_role;

commit;
