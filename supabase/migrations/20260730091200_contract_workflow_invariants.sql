begin;

create or replace function public.enforce_contract_workflow_invariants()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_start_date date;
  v_end_date date;
begin
  if new.deleted_at is not null then
    return new;
  end if;

  if new.company_id is null then
    raise exception 'Company context is required for contract records.'
      using errcode = '23514';
  end if;

  if nullif(btrim(new.start_date::text), '') is null
     or btrim(new.start_date::text) !~ '^\d{4}-\d{2}-\d{2}$'
     or nullif(btrim(new.end_date::text), '') is null
     or btrim(new.end_date::text) !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Contract dates must use YYYY-MM-DD.'
      using errcode = '22007';
  end if;

  v_start_date := btrim(new.start_date::text)::date;
  v_end_date := btrim(new.end_date::text)::date;

  if v_end_date <= v_start_date then
    raise exception 'Contract end date must be after its start date.'
      using errcode = '23514';
  end if;

  if lower(coalesce(new.status, '')) not in ('draft', 'active', 'expired', 'terminated', 'ended') then
    raise exception 'Unsupported contract status: %', new.status
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.properties p
    where p.id::text = new.property_id::text
      and p.company_id = new.company_id
      and p.deleted_at is null
      and (
        lower(new.status) not in ('active', 'draft')
        or lower(p.status) = 'active'
      )
  ) then
    raise exception 'Contract property must be live, company-owned, and active for operational contracts.'
      using errcode = '23514';
  end if;

  if lower(new.status) in ('active', 'draft') then
    if new.unit_id is null or not exists (
      select 1
      from public.units u
      where u.id::text = new.unit_id::text
        and u.property_id::text = new.property_id::text
        and u.company_id = new.company_id
        and u.deleted_at is null
    ) then
      raise exception 'Contract unit must belong to the selected property and company.'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.people person_record
      where person_record.id::text = new.tenant_id::text
        and person_record.company_id = new.company_id
        and person_record.deleted_at is null
        and person_record.type = 'tenant'
    ) then
      raise exception 'Contract tenant must be a live tenant in the same company.'
        using errcode = '23514';
    end if;
  end if;

  if lower(new.status) in ('active', 'draft') and (
    new.agreement_id is null
    or not exists (
      select 1
      from public.owner_agreements agreement_record
      join public.owners owner_record
        on owner_record.id = agreement_record.owner_id
       and owner_record.company_id = new.company_id
       and owner_record.deleted_at is null
       and owner_record.is_active
      where agreement_record.id = new.agreement_id
        and agreement_record.property_id::text = new.property_id::text
        and agreement_record.starts_on <= v_start_date
        and (agreement_record.ends_on is null or agreement_record.ends_on >= v_end_date)
    )
  ) then
    raise exception 'Operational contract requires a covering agreement with an active owner in the same company.'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_contract_workflow_invariants() from public, anon, authenticated;

drop trigger if exists contracts_workflow_invariants on public.contracts;
create trigger contracts_workflow_invariants
before insert or update of property_id, unit_id, tenant_id, agreement_id, start_date, end_date, status, company_id, deleted_at
on public.contracts
for each row execute function public.enforce_contract_workflow_invariants();

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
  v_company_id uuid;
  v_old public.contracts%rowtype;
  v_property_id public.contracts.property_id%type;
  v_unit_id public.contracts.unit_id%type;
  v_tenant_id public.contracts.tenant_id%type;
  v_agreement_id public.contracts.agreement_id%type;
  v_payment_terms_id public.contracts.payment_terms_id%type;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لتعديل عقد'
      using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'سياق الشركة مطلوب لتعديل العقد'
      using errcode = '42501';
  end if;

  -- Assignment through destination-column types keeps this RPC compatible
  -- with both the clean UUID replay and the live text compatibility schema.
  v_property_id := p_property_id;
  v_unit_id := p_unit_id;
  v_tenant_id := p_tenant_id;
  v_agreement_id := p_agreement_id;
  v_payment_terms_id := p_payment_terms_id;

  select *
    into v_old
  from public.contracts
  where id::text = p_contract_id
    and company_id = v_company_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'العقد غير موجود'
      using errcode = 'P0002';
  end if;

  if lower(coalesce(v_old.status, '')) = 'terminated'
     and lower(coalesce(p_status, '')) <> 'terminated' then
    raise exception 'لا يمكن إعادة فتح عقد تم إنهاؤه بالفعل';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date then
    raise exception 'تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية';
  end if;
  if p_rent_amount is null or p_rent_amount <= 0 then
    raise exception 'قيمة الإيجار يجب أن تكون أكبر من صفر';
  end if;
  if lower(coalesce(p_status, '')) not in ('draft', 'active', 'expired', 'terminated') then
    raise exception 'حالة العقد غير مدعومة';
  end if;
  if p_payment_cycle not in ('monthly', 'quarterly', 'semi_annual', 'annual') then
    raise exception 'دورة السداد غير مدعومة';
  end if;

  if v_unit_id::text is distinct from v_old.unit_id::text and exists (
    select 1
    from public.units u
    where u.id::text = v_unit_id::text
      and u.company_id = v_company_id
      and u.deleted_at is null
      and lower(u.status) in ('maintenance', 'reserved')
  ) then
    raise exception 'لا يمكن نقل العقد إلى وحدة تحت الصيانة أو محجوزة تشغيلياً';
  end if;

  if exists (
    select 1
    from public.contracts c
    where c.unit_id::text = v_unit_id::text
      and c.id::text <> p_contract_id
      and c.company_id = v_company_id
      and c.deleted_at is null
      and lower(c.status) in ('active', 'draft')
      and btrim(coalesce(c.start_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
      and btrim(coalesce(c.end_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
      and btrim(c.start_date::text)::date <= p_end_date
      and btrim(c.end_date::text)::date >= p_start_date
  ) then
    raise exception 'الوحدة محجوزة خلال هذه الفترة';
  end if;

  update public.contracts as contract_record
  set
    property_id = v_property_id,
    unit_id = v_unit_id,
    tenant_id = v_tenant_id,
    agreement_id = v_agreement_id,
    start_date = p_start_date,
    end_date = p_end_date,
    rent_amount = p_rent_amount,
    payment_cycle = p_payment_cycle,
    payment_terms_id = v_payment_terms_id,
    status = lower(p_status),
    cancellation_reason = nullif(btrim(p_cancellation_reason), ''),
    notes = nullif(btrim(p_notes), ''),
    attachment_url = nullif(btrim(p_attachment_url), ''),
    updated_at = now()
  where contract_record.id::text = p_contract_id
    and contract_record.company_id = v_company_id
    and contract_record.deleted_at is null
  returning to_jsonb(contract_record) into v_result;

  if v_result is null then
    raise exception 'العقد غير موجود'
      using errcode = 'P0002';
  end if;

  return v_result;
end;
$function$;

revoke all on function public.update_contract_atomic(
  text, text, uuid, uuid, uuid, date, date, numeric,
  text, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.update_contract_atomic(
  text, text, uuid, uuid, uuid, date, date, numeric,
  text, uuid, text, text, text, text
) to authenticated;

commit;
