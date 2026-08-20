-- Fix critical bug in renew_contract_atomic:
-- The frontend sends {new_start, new_end, new_amount} but the previous
-- implementation ran jsonb_populate_record(null::contracts, new_contract_data)
-- on that exact payload, expecting columns like unit_id/tenant_id/rent_amount/
-- start_date/end_date/no/due_day/deposit/sponsor_*. Every one of those came
-- back NULL, and the INSERT additionally referenced a non-existent "is_demo"
-- column, so the call raised a hard error and rolled back atomically
-- (confirmed: no corrupted contract rows exist on production, and no user has
-- exercised this path yet).
--
-- Fix: read unit_id/tenant_id/no/due_day/deposit/sponsor_*/property_id/
-- organization_id/payment_cycle/commission_rate/payment_terms_id/agreement_id
-- from the OLD contract row itself (locked FOR UPDATE), and use only
-- new_start/new_end/new_amount from the payload for the renewed dates and
-- rent. Also link renewed_from_id so the existing renewed_from relation the
-- frontend already queries is populated. Return status:'renewed' to match
-- what the frontend's parseRenewalResult expects.

create or replace function public.renew_contract_atomic(old_contract_id text, new_contract_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_new_id text;
  v_old public.contracts%rowtype;
  v_active_count integer;
  v_new_start text;
  v_new_end text;
  v_new_amount numeric;
begin
  -- Internal auth guard
  if auth.uid() is null or not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('ADMIN', 'MANAGER')
  ) then
    raise exception 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول';
  end if;

  v_new_start := new_contract_data ->> 'new_start';
  v_new_end := new_contract_data ->> 'new_end';
  v_new_amount := (new_contract_data ->> 'new_amount')::numeric;

  if v_new_start is null or v_new_end is null or v_new_amount is null then
    raise exception 'new_start / new_end / new_amount مطلوبة';
  end if;

  -- Lock the original contract row so a concurrent renewal can't race us
  select * into v_old
  from public.contracts
  where id = old_contract_id and status = 'ACTIVE' and deleted_at is null
  for update;

  if not found then
    raise exception 'Original contract is not ACTIVE';
  end if;

  select count(*) into v_active_count
  from public.contracts
  where unit_id = v_old.unit_id and status = 'ACTIVE' and deleted_at is null and id <> old_contract_id;

  if v_active_count > 0 then
    raise exception 'Unit already has another ACTIVE contract';
  end if;

  -- إنهاء العقد القديم
  update public.contracts
  set status = 'ENDED',
      updated_at = now()
  where id = old_contract_id;

  -- إنشاء العقد الجديد: كل الحقول الثابتة من العقد القديم، والتواريخ/القيمة من new_contract_data فقط
  insert into public.contracts (
    no, unit_id, tenant_id, rent_amount, due_day,
    start_date, end_date, deposit, status,
    sponsor_name, sponsor_id, sponsor_phone,
    property_id, organization_id, payment_cycle, commission_rate,
    payment_terms_id, agreement_id, monthly_rent,
    renewed_from_id,
    created_at, updated_at, deleted_at
  )
  values (
    v_old.no, v_old.unit_id, v_old.tenant_id, v_new_amount, v_old.due_day,
    v_new_start, v_new_end, coalesce(v_old.deposit, 0), 'ACTIVE',
    v_old.sponsor_name, v_old.sponsor_id, v_old.sponsor_phone,
    v_old.property_id, v_old.organization_id, v_old.payment_cycle, v_old.commission_rate,
    v_old.payment_terms_id, v_old.agreement_id, v_new_amount,
    old_contract_id,
    now(), now(), null
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'status', 'renewed',
    'old_contract_id', old_contract_id,
    'new_contract_id', v_new_id
  );
end;
$function$;
