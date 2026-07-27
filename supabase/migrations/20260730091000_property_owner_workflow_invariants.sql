begin;

create or replace function public.create_property_with_agreement(
  p_title text,
  p_type text,
  p_address text,
  p_owner_id uuid,
  p_agreement_type text,
  p_commission_type text,
  p_commission_value numeric,
  p_agreement_starts_on date,
  p_agreement_ends_on date default null::date,
  p_owner_name text default null::text,
  p_purchase_value numeric default null::numeric,
  p_current_value numeric default null::numeric,
  p_status text default 'active'::text,
  p_notes text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
  v_property_id public.properties.id%type;
  v_agreement_id uuid;
  v_owner_name text;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عقار'
      using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'سياق الشركة مطلوب لإنشاء العقار'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_title), '') is null
     or nullif(btrim(p_type), '') is null
     or nullif(btrim(p_address), '') is null then
    raise exception 'اسم العقار ونوعه وعنوانه مطلوبة';
  end if;
  if p_agreement_starts_on is null
     or (p_agreement_ends_on is not null and p_agreement_ends_on < p_agreement_starts_on) then
    raise exception 'فترة اتفاقية التشغيل غير صحيحة';
  end if;
  if p_agreement_type not in ('property_management', 'master_lease') then
    raise exception 'نوع اتفاقية التشغيل غير مدعوم';
  end if;
  if p_commission_type not in ('RATE', 'FIXED_MONTHLY') then
    raise exception 'نوع العمولة غير مدعوم';
  end if;
  if p_commission_type = 'RATE' and (p_commission_value < 0 or p_commission_value > 100) then
    raise exception 'نسبة العمولة يجب أن تكون بين 0 و100 عند نوع RATE';
  end if;
  if p_commission_type = 'FIXED_MONTHLY' and p_commission_value < 0 then
    raise exception 'قيمة العمولة الثابتة لا يمكن أن تكون سالبة';
  end if;

  -- The relationship is the source of truth. The legacy p_owner_name input
  -- remains only for client signature compatibility and is never trusted.
  select coalesce(nullif(btrim(o.display_name), ''), nullif(btrim(o.full_name), ''), o.name)
    into v_owner_name
  from public.owners o
  where o.id = p_owner_id
    and o.company_id = v_company_id
    and o.deleted_at is null
    and o.is_active;

  if not found then
    raise exception 'المالك غير موجود في شركتك أو غير نشط أو مؤرشف'
      using errcode = '23514';
  end if;

  insert into public.properties (
    name, title, type, address, owner_id, owner_name, purchase_value,
    current_value, status, notes, company_id
  ) values (
    btrim(p_title), btrim(p_title), btrim(p_type), btrim(p_address),
    p_owner_id, v_owner_name, p_purchase_value, p_current_value,
    p_status, p_notes, v_company_id
  )
  returning id into v_property_id;

  insert into public.property_owners (
    property_id, owner_id, ownership_percentage, is_primary,
    starts_on, ends_on, company_id
  ) values (
    v_property_id, p_owner_id, 100, true,
    p_agreement_starts_on, p_agreement_ends_on, v_company_id
  );

  insert into public.owner_agreements (
    owner_id, property_id, agreement_type, commission_type,
    commission_value, starts_on, ends_on, company_id
  ) values (
    p_owner_id, v_property_id, p_agreement_type, p_commission_type,
    p_commission_value, p_agreement_starts_on, p_agreement_ends_on, v_company_id
  )
  returning id into v_agreement_id;

  return jsonb_build_object('property_id', v_property_id, 'agreement_id', v_agreement_id);
end;
$function$;

revoke all on function public.create_property_with_agreement(
  text, text, text, uuid, text, text, numeric, date, date,
  text, numeric, numeric, text, text
) from public, anon, authenticated;
grant execute on function public.create_property_with_agreement(
  text, text, text, uuid, text, text, numeric, date, date,
  text, numeric, numeric, text, text
) to authenticated;

-- Property archive guard (DB-level enforcement)
-- Prevents archiving a property that still has live units, owner agreements,
-- open maintenance, or active/draft contracts. This mirrors the client-side
-- assertPropertyCanBeArchived check so a direct Data API update cannot bypass
-- it — matching the hardening already done for units and contracts.
create or replace function public.guard_property_archive()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if old.deleted_at is not null or new.deleted_at is null then
    return new;
  end if;

  if exists (
    select 1
    from public.units u
    where u.property_id::text = new.id::text
      and u.company_id = new.company_id
      and u.deleted_at is null
  ) then
    raise exception 'Cannot archive a property that still has non-archived units. Archive or reassign units first.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.owner_agreements a
    where a.property_id::text = new.id::text
      and a.company_id = new.company_id
  ) then
    raise exception 'Cannot archive a property with a saved owner agreement. Use inactive or sold status to preserve history.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.maintenance_records m
    where m.property_id::text = new.id::text
      and m.company_id = new.company_id
      and m.deleted_at is null
      and lower(coalesce(m.status, '')) in ('open', 'in_progress')
  ) then
    raise exception 'Cannot archive property while it has open or in-progress maintenance.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.contracts c
    where c.property_id::text = new.id::text
      and c.company_id = new.company_id
      and c.deleted_at is null
      and lower(c.status) in ('active', 'draft')
  ) then
    raise exception 'Cannot archive property with an active or draft contract. Complete the contract cycle first.'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_property_archive() from public, anon, authenticated;

drop trigger if exists properties_archive_guard on public.properties;
create trigger properties_archive_guard
before update of deleted_at on public.properties
for each row execute function public.guard_property_archive();

commit;
