-- ============================================================================
-- R4 fix-forward — renew_contract_atomic payload contract restoration
-- ============================================================================
--
-- Defect introduced by 20260823000000 (R4 billing policy): the renewal body
-- was rewritten reading `start_date`/`end_date`/`rent_amount` from
-- new_contract_data, but the canonical GAP-004 contract — enforced by the
-- pgTAP gate (supabase/tests/wp03_gap004_renewal_termination_authority.sql)
-- and used by the frontend service (contractService.renewContract) — sends
-- `new_start`/`new_end`/`new_amount`. Renewals through the official callers
-- failed with «فترة التجديد غير صالحة».
--
-- Fix: accept the CANONICAL keys (new_start/new_end/new_amount) primarily,
-- with the R4-era spellings as fallbacks so no caller written against the
-- brief R4 window breaks. The R4 billing-policy inheritance is preserved.
-- ============================================================================

begin;

create or replace function public.renew_contract_atomic(old_contract_id text, new_contract_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid;
  v_old public.contracts%rowtype;
  v_new_id text;
  v_new_start_date date;
  v_new_end_date date;
  v_new_amount numeric;
  v_effective_agreement_id public.contracts.agreement_id%type;
  v_requested_agreement text;
  v_billing_day integer;
  v_grace_days integer;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لتجديد عقد'
      using errcode = '42501';
  end if;

  v_company := public.current_company_id();
  if v_company is null then
    raise exception 'سياق الشركة مطلوب لتجديد العقد' using errcode = '42501';
  end if;

  select * into v_old
  from public.contracts
  where id::text = old_contract_id and company_id = v_company and deleted_at is null
  for update;
  if not found then
    raise exception 'العقد الأصلي غير موجود' using errcode = 'P0002';
  end if;
  if lower(coalesce(v_old.status, '')) <> 'active' then
    raise exception 'يمكن تجديد العقود النشطة فقط' using errcode = '23514';
  end if;

  -- Canonical GAP-004 keys first; R4-era spellings accepted as fallback.
  v_new_start_date := coalesce(
    nullif(new_contract_data ->> 'new_start', ''),
    nullif(new_contract_data ->> 'start_date', '')
  )::date;
  v_new_end_date := coalesce(
    nullif(new_contract_data ->> 'new_end', ''),
    nullif(new_contract_data ->> 'end_date', '')
  )::date;
  v_new_amount := coalesce(
    nullif(new_contract_data ->> 'new_amount', ''),
    nullif(new_contract_data ->> 'rent_amount', '')
  )::numeric;
  if v_new_start_date is null or v_new_end_date is null or v_new_end_date <= v_new_start_date then
    raise exception 'فترة التجديد غير صالحة';
  end if;
  if v_new_amount is null or v_new_amount <= 0 then
    raise exception 'قيمة إيجار التجديد يجب أن تكون أكبر من صفر';
  end if;

  -- R4: the renewal inherits the ORIGINAL billing policy unless explicitly
  -- overridden — never a silent reset to billing_day=1.
  v_billing_day := coalesce(nullif(new_contract_data ->> 'billing_day', '')::integer, v_old.billing_day, 1);
  v_grace_days := coalesce(nullif(new_contract_data ->> 'grace_days', '')::integer, v_old.grace_days, 0);
  if v_billing_day < 1 or v_billing_day > 28 then
    raise exception 'CONTRACT_BILLING_DAY_INVALID: يوم الفوترة يجب أن يكون بين 1 و28' using errcode = '23514';
  end if;
  if v_grace_days < 0 or v_grace_days > 90 then
    raise exception 'CONTRACT_GRACE_DAYS_INVALID: أيام السماح يجب أن تكون بين 0 و90' using errcode = '23514';
  end if;

  v_requested_agreement := nullif(new_contract_data ->> 'agreement_id', '');
  if v_requested_agreement is not null then
    if not exists (
      select 1 from public.owner_agreements oa
      where oa.id::text = v_requested_agreement
        and oa.company_id = v_company
        and oa.property_id::text = v_old.property_id::text
        and oa.starts_on <= v_new_start_date
        and (oa.ends_on is null or oa.ends_on >= v_new_end_date)
    ) then
      raise exception 'اتفاقية المالك المحددة لا تغطي فترة التجديد' using errcode = '23514';
    end if;
    v_effective_agreement_id := v_requested_agreement;
  else
    select oa.id into v_effective_agreement_id
    from public.owner_agreements oa
    where oa.company_id = v_company
      and oa.property_id::text = v_old.property_id::text
      and oa.starts_on <= v_new_start_date
      and (oa.ends_on is null or oa.ends_on >= v_new_end_date)
    order by oa.starts_on desc
    limit 1;
    if v_effective_agreement_id is null then
      raise exception 'لا توجد اتفاقية مالك تغطي فترة التجديد' using errcode = '23514';
    end if;
  end if;

  insert into public.contracts (
    property_id, unit_id, tenant_id, agreement_id, start_date, end_date,
    rent_amount, payment_cycle, payment_terms_id, status, company_id,
    renewed_from_id, notes, billing_day, grace_days
  ) values (
    v_old.property_id, v_old.unit_id, v_old.tenant_id, v_effective_agreement_id,
    v_new_start_date, v_new_end_date, v_new_amount, v_old.payment_cycle,
    v_old.payment_terms_id, 'draft', v_company, v_old.id,
    nullif(btrim(coalesce(new_contract_data ->> 'notes', '')), ''),
    v_billing_day, v_grace_days
  )
  returning id::text into v_new_id;

  return jsonb_build_object(
    'status', 'renewed',
    'old_contract_id', old_contract_id,
    'new_contract_id', v_new_id,
    'agreement_id', v_effective_agreement_id,
    'billing_day', v_billing_day,
    'grace_days', v_grace_days
  );
end;
$function$;

revoke all on function public.renew_contract_atomic(text, jsonb) from public, anon;
grant execute on function public.renew_contract_atomic(text, jsonb) to authenticated, service_role;

comment on function public.renew_contract_atomic(text, jsonb) is
  'GAP-004 renewal authority + R4 billing-policy inheritance. Canonical payload keys: '
  'new_start/new_end/new_amount (R4-era start_date/end_date/rent_amount accepted as fallback).';

notify pgrst, 'reload schema';

commit;
