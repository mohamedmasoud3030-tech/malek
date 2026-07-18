begin;

create or replace function public.create_contract_atomic(
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
  v_contract_id public.contracts.id%type;
  v_property_id public.contracts.property_id%type;
  v_unit_id public.contracts.unit_id%type;
  v_tenant_id public.contracts.tenant_id%type;
  v_agreement_id public.contracts.agreement_id%type;
  v_payment_terms_id public.contracts.payment_terms_id%type;
  v_start_date public.contracts.start_date%type;
  v_end_date public.contracts.end_date%type;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عقد' using errcode = '42501';
  end if;

  v_property_id := p_property_id;
  v_unit_id := p_unit_id;
  v_tenant_id := p_tenant_id;
  v_agreement_id := p_agreement_id;
  v_payment_terms_id := p_payment_terms_id;
  v_start_date := p_start_date;
  v_end_date := p_end_date;

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
    select 1 from public.people person_record
    where person_record.id::text = v_tenant_id::text
      and person_record.type = 'tenant'
      and person_record.deleted_at is null
  ) then
    raise exception 'المستأجر غير موجود أو نوعه غير صحيح';
  end if;

  if not exists (
    select 1 from public.properties property_record
    where property_record.id::text = v_property_id::text
      and property_record.deleted_at is null
  ) then
    raise exception 'العقار غير موجود';
  end if;

  if v_unit_id is null or not exists (
    select 1 from public.units unit_record
    where unit_record.id::text = v_unit_id::text
      and unit_record.property_id::text = v_property_id::text
      and unit_record.deleted_at is null
  ) then
    raise exception 'الوحدة لا تنتمي إلى العقار المحدد';
  end if;

  if exists (
    select 1 from public.units unit_record
    where unit_record.id::text = v_unit_id::text
      and unit_record.status in ('maintenance', 'reserved')
  ) then
    raise exception 'لا يمكن التعاقد على وحدة تحت الصيانة أو محجوزة تشغيلياً';
  end if;

  if exists (
    select 1 from public.contracts contract_record
    where contract_record.unit_id::text = v_unit_id::text
      and contract_record.deleted_at is null
      and lower(contract_record.status) in ('active', 'draft')
      and btrim(coalesce(contract_record.start_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
      and btrim(coalesce(contract_record.end_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
      and btrim(contract_record.start_date::text)::date <= p_end_date
      and btrim(contract_record.end_date::text)::date >= p_start_date
  ) then
    raise exception 'الوحدة محجوزة خلال هذه الفترة';
  end if;

  if v_agreement_id is null then
    raise exception 'لا توجد اتفاقية مالك نشطة تغطي فترة العقد — أنشئ اتفاقية مالك أولاً';
  end if;

  if not exists (
    select 1 from public.owner_agreements agreement_record
    where agreement_record.id::text = v_agreement_id::text
      and agreement_record.property_id::text = v_property_id::text
      and agreement_record.starts_on <= p_start_date
      and (agreement_record.ends_on is null or agreement_record.ends_on >= p_end_date)
  ) then
    raise exception 'اتفاقية المالك لا تغطي فترة العقد بالكامل أو لا تنتمي لهذا العقار';
  end if;

  insert into public.contracts (
    property_id, unit_id, tenant_id, agreement_id, start_date, end_date,
    rent_amount, payment_cycle, payment_terms_id, status,
    cancellation_reason, notes, attachment_url
  ) values (
    v_property_id, v_unit_id, v_tenant_id, v_agreement_id,
    v_start_date, v_end_date, p_rent_amount,
    p_payment_cycle, v_payment_terms_id, p_status,
    p_cancellation_reason, p_notes, p_attachment_url
  )
  returning id into v_contract_id;

  return (select to_jsonb(c) from public.contracts c where c.id::text = v_contract_id::text);
end;
$function$;

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
  v_property_id public.contracts.property_id%type;
  v_unit_id public.contracts.unit_id%type;
  v_tenant_id public.contracts.tenant_id%type;
  v_agreement_id public.contracts.agreement_id%type;
  v_payment_terms_id public.contracts.payment_terms_id%type;
  v_start_date public.contracts.start_date%type;
  v_end_date public.contracts.end_date%type;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لتعديل عقد' using errcode = '42501';
  end if;

  v_property_id := p_property_id;
  v_unit_id := p_unit_id;
  v_tenant_id := p_tenant_id;
  v_agreement_id := p_agreement_id;
  v_payment_terms_id := p_payment_terms_id;
  v_start_date := p_start_date;
  v_end_date := p_end_date;

  select * into v_old
  from public.contracts
  where id::text = p_contract_id and deleted_at is null
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
    select 1 from public.people person_record
    where person_record.id::text = v_tenant_id::text
      and person_record.type = 'tenant'
      and person_record.deleted_at is null
  ) then
    raise exception 'المستأجر غير موجود أو نوعه غير صحيح';
  end if;

  if not exists (
    select 1 from public.properties property_record
    where property_record.id::text = v_property_id::text
      and property_record.deleted_at is null
  ) then
    raise exception 'العقار غير موجود';
  end if;

  if v_unit_id is null or not exists (
    select 1 from public.units unit_record
    where unit_record.id::text = v_unit_id::text
      and unit_record.property_id::text = v_property_id::text
      and unit_record.deleted_at is null
  ) then
    raise exception 'الوحدة لا تنتمي إلى العقار المحدد';
  end if;

  if v_unit_id::text is distinct from v_old.unit_id::text and exists (
    select 1 from public.units unit_record
    where unit_record.id::text = v_unit_id::text
      and unit_record.status in ('maintenance', 'reserved')
  ) then
    raise exception 'لا يمكن نقل العقد إلى وحدة تحت الصيانة أو محجوزة تشغيلياً';
  end if;

  if exists (
    select 1 from public.contracts contract_record
    where contract_record.unit_id::text = v_unit_id::text
      and contract_record.id::text <> p_contract_id
      and contract_record.deleted_at is null
      and lower(contract_record.status) in ('active', 'draft')
      and btrim(coalesce(contract_record.start_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
      and btrim(coalesce(contract_record.end_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
      and btrim(contract_record.start_date::text)::date <= p_end_date
      and btrim(contract_record.end_date::text)::date >= p_start_date
  ) then
    raise exception 'الوحدة محجوزة خلال هذه الفترة';
  end if;

  if v_agreement_id is null then
    raise exception 'لا توجد اتفاقية مالك نشطة تغطي فترة العقد — أنشئ اتفاقية مالك أولاً';
  end if;

  if not exists (
    select 1 from public.owner_agreements agreement_record
    where agreement_record.id::text = v_agreement_id::text
      and agreement_record.property_id::text = v_property_id::text
      and agreement_record.starts_on <= p_start_date
      and (agreement_record.ends_on is null or agreement_record.ends_on >= p_end_date)
  ) then
    raise exception 'اتفاقية المالك لا تغطي فترة العقد بالكامل أو لا تنتمي لهذا العقار';
  end if;

  update public.contracts set
    property_id = v_property_id,
    unit_id = v_unit_id,
    tenant_id = v_tenant_id,
    agreement_id = v_agreement_id,
    start_date = v_start_date,
    end_date = v_end_date,
    rent_amount = p_rent_amount,
    payment_cycle = p_payment_cycle,
    payment_terms_id = v_payment_terms_id,
    status = p_status,
    cancellation_reason = p_cancellation_reason,
    notes = p_notes,
    attachment_url = p_attachment_url,
    updated_at = now()
  where id::text = p_contract_id;

  return (select to_jsonb(c) from public.contracts c where c.id::text = p_contract_id);
end;
$function$;

revoke execute on function public.create_contract_atomic(text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text) from public, anon;
grant execute on function public.create_contract_atomic(text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text) to authenticated, service_role;
revoke execute on function public.update_contract_atomic(text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text) from public, anon;
grant execute on function public.update_contract_atomic(text, text, uuid, uuid, uuid, date, date, numeric, text, uuid, text, text, text, text) to authenticated, service_role;

commit;
