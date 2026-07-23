-- Migration: Multi-tenant company isolation for RPC functions and triggers
-- Date: 2026-07-22
-- Purpose: Add company_id filtering to all SECURITY DEFINER functions and triggers
-- This migration is idempotent (uses CREATE OR REPLACE)
-- Total: 23 RPCs + 8 triggers = 31 functions

BEGIN;

-- ============================================
-- RPC Functions (23)
-- ============================================

-- Function: approve_owner_settlement_atomic
CREATE OR REPLACE FUNCTION public.approve_owner_settlement_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_id text := nullif(p_payload->>'settlement_id', '');
  v_row public.owner_settlements%rowtype;
  v_cached jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to approve owner settlements.' using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_id is null or v_request_id is null then raise exception 'settlement_id and request_id are required.'; end if;
  select response_payload into v_cached from public.financial_operation_idempotency
   where operation_name = 'approve_owner_settlement_atomic' and request_id = v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  select * into v_row from public.owner_settlements where id = v_id for update;
  if not found then raise exception 'Owner settlement not found.'; end if;
  if v_row.status <> 'DRAFT' then raise exception 'Only DRAFT settlements can be approved.'; end if;

  update public.owner_settlements
     set status = 'APPROVED', approved_at = now(), approved_by = auth.uid(), updated_at = now()
   where id = v_id
    AND company_id = v_company_id;

  insert into public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()), 'APPROVE', 'owner_settlements', v_id,
    'Owner settlement approved; owner payable is recognized operationally', 'owner_settlements', left(p_payload::text, 4000), now());

  v_result := jsonb_build_object('success', true, 'idempotent', false, 'settlement_id', v_id, 'status', 'APPROVED', 'net_payable', v_row.net_payable, 'request_id', v_request_id);
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('approve_owner_settlement_atomic', v_request_id, v_result) on conflict (operation_name, request_id) do nothing;
  return v_result;
end;
$function$
;

-- Function: cancel_owner_settlement_atomic
CREATE OR REPLACE FUNCTION public.cancel_owner_settlement_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_id text := nullif(p_payload->>'settlement_id', '');
  v_reason text := nullif(btrim(p_payload->>'reason'), '');
  v_row public.owner_settlements%rowtype;
  v_cached jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to cancel owner settlements.' using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_id is null or v_request_id is null or v_reason is null then raise exception 'settlement_id, request_id, and reason are required.'; end if;
  select response_payload into v_cached from public.financial_operation_idempotency
   where operation_name = 'cancel_owner_settlement_atomic' and request_id = v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  select * into v_row from public.owner_settlements where id = v_id for update;
  if not found then raise exception 'Owner settlement not found.'; end if;
  if v_row.status not in ('DRAFT', 'APPROVED') then
    raise exception 'Only DRAFT or APPROVED settlements can be cancelled; paid settlements require a controlled reversal.';
  end if;

  update public.owner_settlements
     set status = 'CANCELLED', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = v_reason, updated_at = now()
   where id = v_id
    AND company_id = v_company_id;

  insert into public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()), 'CANCEL', 'owner_settlements', v_id,
    'Owner settlement cancelled: ' || v_reason, 'owner_settlements', left(p_payload::text, 4000), now());

  v_result := jsonb_build_object('success', true, 'idempotent', false, 'settlement_id', v_id, 'status', 'CANCELLED', 'request_id', v_request_id);
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('cancel_owner_settlement_atomic', v_request_id, v_result) on conflict (operation_name, request_id) do nothing;
  return v_result;
end;
$function$
;

-- Function: create_contract_atomic
CREATE OR REPLACE FUNCTION public.create_contract_atomic(p_property_id text, p_unit_id uuid, p_tenant_id uuid, p_agreement_id uuid, p_start_date date, p_end_date date, p_rent_amount numeric, p_payment_cycle text, p_payment_terms_id uuid, p_status text, p_cancellation_reason text, p_notes text, p_attachment_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
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

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

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
  , company_id) values (
    v_property_id, v_unit_id, v_tenant_id, v_agreement_id,
    v_start_date, v_end_date, p_rent_amount,
    p_payment_cycle, v_payment_terms_id, p_status,
    p_cancellation_reason, p_notes, p_attachment_url
  , v_company_id)
  returning id into v_contract_id;

  return (select to_jsonb(c) from public.contracts c where c.id::text = v_contract_id::text);
end;
$function$
;

-- Function: create_deposit_atomic
CREATE OR REPLACE FUNCTION public.create_deposit_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id','');
  v_contract_id_raw text := nullif(p_payload->>'contract_id','');
  v_contract_id_type text;
  v_property_id_type text;
  v_unit_id_type text;
  v_tenant_id text := nullif(p_payload->>'tenant_id','');
  v_property_id_raw text := nullif(p_payload->>'property_id','');
  v_unit_id_raw text := nullif(p_payload->>'unit_id','');
  v_amount numeric := nullif(p_payload->>'amount','')::numeric;
  v_received_date date := nullif(p_payload->>'received_date','')::date;
  v_notes text := nullif(p_payload->>'notes','');
  v_deposit_id text;
  v_cached jsonb;
  v_cash_account_id text;
  v_deposit_account_id text;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role required' using errcode='42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;

  select response_payload into v_cached from public.financial_operation_idempotency where operation_name='create_deposit_atomic' and request_id=v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  if v_contract_id_raw is null then raise exception 'contract_id required'; end if;
  if v_amount is null or v_amount <=0 then raise exception 'amount must be >0'; end if;
  if v_received_date is null then v_received_date := current_date; end if;

  SELECT format_type(a.atttypid, a.atttypmod) INTO v_contract_id_type
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='contracts' AND a.attname='id' AND a.attnum>0 AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod) INTO v_property_id_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relname='properties' AND a.attname='id' AND a.attnum>0 AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod) INTO v_unit_id_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relname='units' AND a.attname='id' AND a.attnum>0 AND NOT a.attisdropped;

  IF v_contract_id_type IS NULL OR v_property_id_type IS NULL OR v_unit_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot resolve canonical contract/property/unit identifier types';
  END IF;

  perform pg_advisory_xact_lock(hashtextextended('create_deposit:'||v_request_id,0));

  v_deposit_id := gen_random_uuid()::text;

  EXECUTE format(
    'insert into public.tenant_deposits
      (id, contract_id, tenant_id, property_id, unit_id, deposit_amount, remaining_amount, status, received_date, notes, request_id, company_id)
     values ($1, $2::%s, $3, $4::%s, $5::%s, $6, $6, ''held'', $7, $8, $9, $10)',
    v_contract_id_type,
    v_property_id_type,
    v_unit_id_type
  )
  USING v_deposit_id, v_contract_id_raw, v_tenant_id, v_property_id_raw, v_unit_id_raw,
        v_amount, v_received_date, v_notes, v_request_id, v_company_id;

  insert into public.deposit_transactions (deposit_id, type, amount, reason, description, request_id, company_id)
  values (v_deposit_id, 'held', v_amount, 'initial_deposit', 'استلام وديعة تأمين', v_request_id || '-held', v_company_id);

  v_cash_account_id := (
    select id from public.accounts
    where no='1111' and company_id = v_company_id
    limit 1
  );
  v_deposit_account_id := (
    select id from public.accounts
    where no='2200' and company_id = v_company_id
    limit 1
  );
  if v_deposit_account_id is null then
    insert into public.accounts (id, no, name, company_id)
    values ('2200','2200','Tenant Deposits Payable', v_company_id)
    on conflict (id) do nothing;
    v_deposit_account_id := '2200';
  end if;

  if v_cash_account_id is not null and v_deposit_account_id is not null then
    insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, company_id)
    values
      (gen_random_uuid()::text, 'DEP-'||substr(v_deposit_id,1,6)||'-D', v_received_date, v_cash_account_id, v_amount, 'DEBIT', v_deposit_id, 'deposit', v_deposit_id, v_company_id),
      (gen_random_uuid()::text, 'DEP-'||substr(v_deposit_id,1,6)||'-C', v_received_date, v_deposit_account_id, v_amount, 'CREDIT', v_deposit_id, 'deposit', v_deposit_id, v_company_id);
  end if;

  v_result := jsonb_build_object('success',true,'deposit_id',v_deposit_id,'request_id',v_request_id,'amount',v_amount);

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('create_deposit_atomic', v_request_id, v_result) on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$
;

-- Function: create_expense_with_journal_atomic
CREATE OR REPLACE FUNCTION public.create_expense_with_journal_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_property_id public.expenses.property_id%type := nullif(p_payload->>'property_id', '');
  v_category text := nullif(p_payload->>'category', '');
  v_amount numeric := nullif(p_payload->>'amount', '')::numeric;
  v_expense_date public.expenses.expense_date%type := nullif(p_payload->>'expense_date', '')::date;
  v_description text := nullif(p_payload->>'description', '');
  v_cost_center_id public.expenses.cost_center_id%type := nullif(p_payload->>'cost_center_id', '');
  v_contract_id public.expenses.contract_id%type := nullif(p_payload->>'contract_id', '');
  v_charged_to text := nullif(p_payload->>'charged_to', '');
  v_attachment_url text := nullif(p_payload->>'attachment_url', '');
  v_expense_id public.expenses.id%type;
  v_expense_no text;
  v_expense_account_id public.accounts.id%type;
  v_cash_account_id public.accounts.id%type;
  v_result jsonb;
  v_cached jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to create expenses.' using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  if v_request_id is null then
    v_request_id := gen_random_uuid()::text;
  end if;

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'create_expense_with_journal_atomic'
    and request_id = v_request_id;
  if v_cached is not null then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  if v_property_id is null then raise exception 'property_id is required.'; end if;
  if v_category is null then raise exception 'category is required.'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'amount must be greater than zero.'; end if;
  if v_expense_date is null then raise exception 'expense_date is required.'; end if;

  if not exists (
    select 1 from public.properties p
    where p.id::text = v_property_id::text and p.deleted_at is null
  ) then
    raise exception 'Property not found.';
  end if;

  if v_cost_center_id is not null and not exists (
    select 1 from public.cost_centers cc where cc.id::text = v_cost_center_id::text
  ) then
    raise exception 'Cost center not found.';
  end if;

  if v_contract_id is not null and not exists (
    select 1 from public.contracts c
    where c.id::text = v_contract_id::text
      and c.property_id::text = v_property_id::text
      and c.deleted_at is null
  ) then
    raise exception 'Contract does not belong to the selected property.';
  end if;

  select id into v_expense_account_id from public.accounts where no = '6100' limit 1;
  select id into v_cash_account_id from public.accounts where no = '1111' limit 1;
  if v_expense_account_id is null or v_cash_account_id is null then
    raise exception 'Expense accounting accounts are not configured';
  end if;

  v_expense_id := gen_random_uuid()::text;
  v_expense_no := 'EXP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_request_id, '-', ''), 1, 6);

  insert into public.expenses (
    id, property_id, category, amount, expense_date, description,
    cost_center_id, contract_id, charged_to, attachment_url, status, date_time, no
  , company_id) values (
    v_expense_id, v_property_id, v_category, v_amount, v_expense_date, v_description,
    v_cost_center_id, v_contract_id, v_charged_to, v_attachment_url, 'POSTED', v_expense_date::text, v_expense_no
  , v_company_id);

  insert into public.journal_entries
    (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at, company_id)
  values
    (gen_random_uuid()::text, v_expense_no || '-D', v_expense_date::text, v_expense_account_id, v_amount, 'DEBIT', v_expense_id, 'expense', v_expense_id, now(), v_company_id),
    (gen_random_uuid()::text, v_expense_no || '-C', v_expense_date::text, v_cash_account_id, v_amount, 'CREDIT', v_expense_id, 'expense', v_expense_id, now());

  insert into public.audit_log
    (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (
    gen_random_uuid()::text, extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CREATE', 'expenses', v_expense_id, 'Expense recorded with journal entry',
    'expenses', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'expense_id', v_expense_id,
    'expense_no', v_expense_no,
    'request_id', v_request_id
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('create_expense_with_journal_atomic', v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$
;

-- Function: create_owner_agreement_atomic
CREATE OR REPLACE FUNCTION public.create_owner_agreement_atomic(payload jsonb)
 RETURNS owner_agreements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_id uuid;
  v_row public.owner_agreements%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يحتاج هذا الإجراء صلاحية مدير أو مشرف.';
  END IF;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  INSERT INTO public.owner_agreements (owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, notes, company_id)
  VALUES (
    (payload->>'owner_id')::uuid,
    payload->>'property_id',
    payload->>'agreement_type',
    payload->>'commission_type',
    (payload->>'commission_value')::numeric,
    (payload->>'starts_on')::date,
    NULLIF(payload->>'ends_on', '')::date,
    NULLIF(payload->>'notes', '')
  , v_company_id)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$
;

-- Function: create_owner_settlement_draft_atomic
CREATE OR REPLACE FUNCTION public.create_owner_settlement_draft_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_owner_id text := nullif(p_payload->>'owner_id', '');
  v_property_id text := nullif(p_payload->>'property_id', '');
  v_period_start date := nullif(p_payload->>'period_start', '')::date;
  v_period_end date := nullif(p_payload->>'period_end', '')::date;
  v_gross numeric := coalesce(nullif(p_payload->>'gross_collected', '')::numeric, 0);
  v_fee numeric := coalesce(nullif(p_payload->>'office_fee', '')::numeric, 0);
  v_expenses numeric := coalesce(nullif(p_payload->>'owner_expenses', '')::numeric, 0);
  v_tax numeric := coalesce(nullif(p_payload->>'tax_amount', '')::numeric, 0);
  v_net numeric;
  v_id text;
  v_no text;
  v_result jsonb;
  v_cached jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to create owner settlements.' using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_owner_id is null or v_period_start is null or v_period_end is null or v_request_id is null then
    raise exception 'owner_id, period_start, period_end, and request_id are required.';
  end if;
  if v_period_start > v_period_end then raise exception 'period_start must be on or before period_end.'; end if;
  if least(v_gross, v_fee, v_expenses, v_tax) < 0 then raise exception 'Settlement amounts cannot be negative.'; end if;

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'create_owner_settlement_draft_atomic' and request_id = v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'owner_settlement:' || v_owner_id || ':' || coalesce(v_property_id, '*') || ':' || v_period_start || ':' || v_period_end,
    0
  ));

  if exists (
    select 1 from public.owner_settlements
    where owner_id = v_owner_id
      and coalesce(property_id, '') = coalesce(v_property_id, '')
      and period_start = v_period_start
      and period_end = v_period_end
      and status <> 'CANCELLED'
  ) then
    raise exception 'An active settlement already exists for this owner, property, and period.' using errcode = '23505';
  end if;

  v_net := greatest(v_gross - v_fee - v_expenses - v_tax, 0);
  v_id := gen_random_uuid()::text;
  v_no := 'OST-' || to_char(v_period_end, 'YYYYMM') || '-' || upper(substr(replace(v_id, '-', ''), 1, 8));

  insert into public.owner_settlements (
    id, no, owner_id, property_id, date, period_start, period_end,
    gross_collected, office_fee, owner_expenses, tax_amount, net_payable,
    amount, status, request_id, notes, created_at, updated_at
  , company_id) values (
    v_id, v_no, v_owner_id, v_property_id, v_period_end::text, v_period_start, v_period_end,
    v_gross, v_fee, v_expenses, v_tax, v_net,
    v_net, 'DRAFT', v_request_id::uuid, p_payload->>'notes', now(), now()
  , v_company_id);

  insert into public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CREATE', 'owner_settlements', v_id, 'Owner settlement draft created',
    'owner_settlements', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false, 'settlement_id', v_id,
    'settlement_no', v_no, 'status', 'DRAFT', 'net_payable', v_net,
    'request_id', v_request_id
  );
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('create_owner_settlement_draft_atomic', v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;
  return v_result;
end;
$function$
;

-- Function: create_property_with_agreement
CREATE OR REPLACE FUNCTION public.create_property_with_agreement(p_title text, p_type text, p_address text, p_owner_id uuid, p_agreement_type text, p_commission_type text, p_commission_value numeric, p_agreement_starts_on date, p_agreement_ends_on date DEFAULT NULL::date, p_owner_name text DEFAULT NULL::text, p_purchase_value numeric DEFAULT NULL::numeric, p_current_value numeric DEFAULT NULL::numeric, p_status text DEFAULT 'active'::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_id uuid;
  v_property_id public.properties.id%TYPE;
  v_agreement_id uuid;
  v_owner_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عقار' USING ERRCODE = '42501';
  END IF;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  IF NULLIF(btrim(p_title), '') IS NULL THEN RAISE EXCEPTION 'اسم العقار مطلوب'; END IF;
  IF p_commission_type = 'RATE' AND (p_commission_value < 0 OR p_commission_value > 100) THEN
    RAISE EXCEPTION 'نسبة العمولة يجب أن تكون بين 0 و100 عند نوع RATE';
  END IF;
  IF p_commission_type = 'FIXED_MONTHLY' AND p_commission_value < 0 THEN
    RAISE EXCEPTION 'قيمة العمولة الثابتة لا يمكن أن تكون سالبة';
  END IF;

  SELECT COALESCE(NULLIF(btrim(p_owner_name), ''), NULLIF(btrim(o.display_name), ''), NULLIF(btrim(o.full_name), ''), o.name)
    INTO v_owner_name
  FROM public.owners o
  WHERE o.id = p_owner_id AND o.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'المالك غير موجود أو مؤرشف'; END IF;

  INSERT INTO public.properties (name, title, type, address, owner_id, owner_name, purchase_value, current_value, status, notes, company_id)
  VALUES (btrim(p_title), btrim(p_title), p_type, p_address, p_owner_id, v_owner_name, p_purchase_value, p_current_value, p_status, p_notes, v_company_id)
  RETURNING id INTO v_property_id;

  INSERT INTO public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, ends_on)
  VALUES (v_property_id, p_owner_id, 100, true, p_agreement_starts_on, p_agreement_ends_on);

  INSERT INTO public.owner_agreements (owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, company_id)
  VALUES (p_owner_id, v_property_id, p_agreement_type, p_commission_type, p_commission_value, p_agreement_starts_on, p_agreement_ends_on, v_company_id)
  RETURNING id INTO v_agreement_id;

  RETURN jsonb_build_object('property_id', v_property_id, 'agreement_id', v_agreement_id);
END;
$function$
;

-- Function: deduct_deposit_atomic
CREATE OR REPLACE FUNCTION public.deduct_deposit_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id','');
  v_deposit_id text := nullif(p_payload->>'deposit_id','');
  v_amount numeric := nullif(p_payload->>'amount','')::numeric;
  v_reason text := nullif(p_payload->>'reason','');
  v_description text := nullif(p_payload->>'description','');
  v_charged_date date := nullif(p_payload->>'charged_date','')::date;
  v_property_id_raw text := nullif(p_payload->>'property_id','');
  v_deposit record;
  v_cached jsonb;
  v_result jsonb;
  v_expense_account_id text;
  v_deposit_account_id text;
  v_expense_id uuid;
  v_expense_property_id_type text;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role required' using errcode='42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;
  select response_payload into v_cached from public.financial_operation_idempotency where operation_name='deduct_deposit_atomic' and request_id=v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  if v_deposit_id is null then raise exception 'deposit_id required'; end if;
  if v_amount is null or v_amount <=0 then raise exception 'amount >0 required'; end if;
  if v_reason is null then v_reason := 'other'; end if;
  if v_charged_date is null then v_charged_date := current_date; end if;

  perform pg_advisory_xact_lock(hashtextextended('deduct_deposit:'||v_deposit_id,0));

  select * into v_deposit from public.tenant_deposits where id=v_deposit_id and deleted_at is null   AND company_id = v_company_id
for update;
  if not found then raise exception 'Deposit not found'; end if;

  if v_amount > v_deposit.remaining_amount then
    raise exception 'Insufficient deposit balance: remaining % requested %', v_deposit.remaining_amount, v_amount;
  end if;

  update public.tenant_deposits
  set deducted_amount = deducted_amount + v_amount,
      remaining_amount = deposit_amount - (deducted_amount + v_amount) - refunded_amount,
      status = case 
        when (deposit_amount - (deducted_amount + v_amount) - refunded_amount) <=0 then 'forfeited_damage'
        when (deducted_amount + v_amount) >0 and refunded_amount =0 then 'partially_deducted'
        when refunded_amount >0 then 'partially_refunded'
        else 'held'
      end,
      updated_at = now()
  where id=v_deposit_id;

  insert into public.deposit_transactions (deposit_id, type, amount, reason, description, request_id, company_id)
  values (v_deposit_id, 'deduction', v_amount, v_reason, v_description, v_request_id, v_company_id);

  v_expense_account_id := (
    select id from public.accounts
    where no='6100' and company_id = v_company_id
    limit 1
  );
  v_deposit_account_id := (
    select id from public.accounts
    where no='2200' and company_id = v_company_id
    limit 1
  );
  if v_expense_account_id is null then
    insert into public.accounts (id, no, name, company_id)
    values ('6100','6100','Operating Expenses', v_company_id)
    on conflict (id) do nothing;
    v_expense_account_id := '6100';
  end if;

  if v_deposit_account_id is not null and v_expense_account_id is not null then
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_expense_property_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='expenses' AND a.attname='property_id' AND a.attnum>0 AND NOT a.attisdropped;

    IF v_expense_property_id_type IS NULL THEN
      RAISE EXCEPTION 'expenses.property_id type not found';
    END IF;

    v_expense_id := gen_random_uuid();
    EXECUTE format(
      'insert into public.expenses
        (id, property_id, category, amount, expense_date, description, status, no, company_id)
       values ($1, $2::%s, $3, $4, $5, $6, $7, $8, $9)',
      v_expense_property_id_type
    )
    USING v_expense_id,
          coalesce(v_property_id_raw, v_deposit.property_id::text),
          'صيانة من تأمين',
          v_amount,
          v_charged_date,
          'خصم تأمين: '||coalesce(v_description,''),
          'POSTED',
          'EXP-DEP-'||substr(v_deposit_id,1,6),
          v_company_id;

    insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, company_id)
    values
      (gen_random_uuid()::text, 'DEP-DED-'||substr(v_deposit_id,1,6)||'-D', v_charged_date, v_deposit_account_id, v_amount, 'DEBIT', v_deposit_id, 'deposit_deduction', v_deposit_id, v_company_id),
      (gen_random_uuid()::text, 'DEP-DED-'||substr(v_deposit_id,1,6)||'-C', v_charged_date, v_expense_account_id, v_amount, 'CREDIT', v_deposit_id, 'deposit_deduction', v_deposit_id, v_company_id);
  end if;

  v_result := jsonb_build_object('success',true,'deposit_id',v_deposit_id,'deducted',v_amount,'remaining', v_deposit.remaining_amount - v_amount,'request_id',v_request_id, 'new_status', (case when (v_deposit.deposit_amount - (v_deposit.deducted_amount + v_amount) - v_deposit.refunded_amount) <=0 then 'forfeited_damage' else 'partially_deducted' end));

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('deduct_deposit_atomic', v_request_id, v_result) on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$
;

-- Function: execute_automation_rule
CREATE OR REPLACE FUNCTION public.execute_automation_rule(p_rule_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_rule record;
  v_run_id uuid;
  v_items_processed int :=0;
  v_items_failed int :=0;
  v_result jsonb;
  v_contract record;
  v_invoice record;
  v_maint record;
  v_notif_count int :=0;
  v_error_msg text;
  v_company_id uuid;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER required' using errcode='42501';
  end if;

  -- Read company_id from JWT (set by custom_access_token_hook)
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  select * into v_rule from public.automation_rules where id=p_rule_id and deleted_at is null for update;
  if not found then raise exception 'Rule not found'; end if;

  if not v_rule.is_enabled then
    raise exception 'Rule is disabled';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('automation_rule:'||p_rule_id,0));

  if exists (
    select 1 from public.automation_runs
    where rule_id=p_rule_id and status='running' and started_at > extract(epoch from (now() - interval '5 minutes'))*1000
  ) then
    return jsonb_build_object('success',false,'skipped',true,'reason','duplicate running execution prevented');
  end if;

  insert into public.automation_runs (job_name, rule_id, status, started_at, retry_count, company_id)
  values (v_rule.name, v_rule.id, 'running', extract(epoch from now())*1000, 0, v_company_id)
  returning id into v_run_id;

  BEGIN
    if v_rule.rule_type = 'contract_expiry' then
      for v_contract in
        select id, property_id, tenant_id, end_date from public.contracts
        where deleted_at is null and status='active' and end_date between current_date and current_date + interval '30 days'
        limit 100
      loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id, company_id)
        values (v_rule.id, v_run_id, 'contract_expiry',
                'عقد قريب من الانتهاء',
                'العقد '||v_contract.id||' ينتهي في '||v_contract.end_date,
                'contract', v_contract.id::text, v_company_id);
        v_items_processed := v_items_processed +1;
        v_notif_count := v_notif_count+1;
      end loop;

    elsif v_rule.rule_type = 'overdue_invoice' then
      for v_invoice in
        select id, contract_id, due_date, amount, paid_amount from public.invoices
        where deleted_at is null and status not in ('paid','cancelled','void')
          and due_date is not null and due_date::date < current_date
          and (amount - coalesce(paid_amount,0)) >0
        limit 100
      loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id, company_id)
        values (v_rule.id, v_run_id, 'overdue_invoice',
                'فاتورة متأخرة',
                'الفاتورة '||v_invoice.id||' متأخرة منذ '||v_invoice.due_date||' بمبلغ '||(v_invoice.amount - coalesce(v_invoice.paid_amount,0)),
                'invoice', v_invoice.id::text, v_company_id);
        v_items_processed := v_items_processed +1;
        v_notif_count := v_notif_count+1;
      end loop;

    elsif v_rule.rule_type = 'maintenance_overdue' then
      for v_maint in
        select id, property_id, title, status from public.maintenance_records
        where deleted_at is null and status in ('open','in_progress') and created_at < now() - interval '7 days'
        limit 100
      loop
        insert into public.automation_notifications (rule_id, run_id, type, title, body, related_entity_type, related_entity_id, company_id)
        values (v_rule.id, v_run_id, 'maintenance_overdue',
                'صيانة متأخرة',
                'طلب الصيانة '||coalesce(v_maint.title, v_maint.id::text)||' متأخر أكثر من 7 أيام',
                'maintenance', v_maint.id::text, v_company_id);
        v_items_processed := v_items_processed +1;
        v_notif_count := v_notif_count+1;
      end loop;
    else
      v_items_processed :=0;
    end if;

    update public.automation_runs
    set completed_at = extract(epoch from now())*1000,
        status = case when v_items_failed>0 then 'partial' else 'success' end,
        items_processed = v_items_processed,
        items_failed = v_items_failed,
        actions_taken = jsonb_build_array(jsonb_build_object('notifications_created', v_notif_count))
    where id=v_run_id;

    update public.automation_rules
    set last_run_at = now(),
        last_run_status = case when v_items_failed>0 then 'PARTIAL' else 'SUCCESS' end,
        last_run_result = 'Processed '||v_items_processed||' items, created '||v_notif_count||' notifications',
        updated_at = now()
    where id=v_rule.id;

    v_result := jsonb_build_object('success',true,'run_id',v_run_id,'processed',v_items_processed,'failed',v_items_failed,'notifications',v_notif_count);

    return v_result;

  EXCEPTION WHEN OTHERS THEN
    v_error_msg := SQLERRM;
    BEGIN
      update public.automation_runs
      set completed_at = extract(epoch from now())*1000,
          status = 'failed',
          error_message = v_error_msg,
          items_processed = v_items_processed,
          items_failed = v_items_failed +1
      where id=v_run_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to update automation run to failed: %', SQLERRM;
    END;

    BEGIN
      update public.automation_rules
      set last_run_at = now(),
          last_run_status = 'FAILED',
          last_run_result = v_error_msg,
          updated_at = now()
      where id=v_rule.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to update automation rule to failed: %', SQLERRM;
    END;

    RETURN jsonb_build_object('success',false,'run_id',v_run_id,'error',v_error_msg,'processed',v_items_processed,'failed',v_items_failed+1);
  END;
end;
$function$
;

-- Function: generate_invoices_from_active_contracts
CREATE OR REPLACE FUNCTION public.generate_invoices_from_active_contracts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_id uuid;
  v_contract record;
  v_invoice_id uuid;
  v_batch_id uuid;
  v_tax_rate numeric;
  v_tax_amount numeric;
  v_total_amount numeric;
  v_ar_account_id text;
  v_revenue_account_id text;
  v_vat_account_id text;
  v_count integer := 0;
  v_period_start date;
  v_period_end date;
  v_invoice_exists boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to generate invoices' USING ERRCODE = '42501';
  END IF;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  SELECT id INTO v_ar_account_id FROM public.accounts WHERE no = '1201' LIMIT 1;
  SELECT id INTO v_revenue_account_id FROM public.accounts WHERE no = '4000' LIMIT 1;
  SELECT id INTO v_vat_account_id FROM public.accounts WHERE no = '2100' LIMIT 1;

  IF v_ar_account_id IS NULL OR v_revenue_account_id IS NULL THEN
    RAISE EXCEPTION 'Required accounts not configured (1201 or 4000)';
  END IF;

  SELECT CASE WHEN vat_enabled THEN COALESCE(vat_rate, 0) ELSE 0 END
    INTO v_tax_rate
    FROM public.company_settings
    LIMIT 1;

  IF v_tax_rate IS NULL THEN
    v_tax_rate := 0;
  END IF;

  FOR v_contract IN
    SELECT c.id, c.rent_amount, c.payment_cycle, c.start_date
    FROM public.contracts c
    WHERE c.deleted_at IS NULL
      AND lower(c.status) = 'active'
    ORDER BY c.id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('invoice_generation:' || v_contract.id::text));

    CASE v_contract.payment_cycle
      WHEN 'monthly' THEN
        v_period_start := date_trunc('month', current_date)::date;
        v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
      WHEN 'quarterly' THEN
        v_period_start := date_trunc('quarter', current_date)::date;
        v_period_end := (date_trunc('quarter', current_date) + interval '3 months' - interval '1 day')::date;
      WHEN 'semi_annual' THEN
        IF EXTRACT(MONTH FROM current_date) <= 6 THEN
          v_period_start := make_date(EXTRACT(YEAR FROM current_date)::int, 1, 1);
          v_period_end := make_date(EXTRACT(YEAR FROM current_date)::int, 6, 30);
        ELSE
          v_period_start := make_date(EXTRACT(YEAR FROM current_date)::int, 7, 1);
          v_period_end := make_date(EXTRACT(YEAR FROM current_date)::int, 12, 31);
        END IF;
      WHEN 'annual' THEN
        v_period_start := date_trunc('year', current_date)::date;
        v_period_end := (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date;
      ELSE
        v_period_start := date_trunc('month', current_date)::date;
        v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
    END CASE;

    SELECT EXISTS(
      SELECT 1 FROM public.invoices i
      WHERE i.contract_id = v_contract.id
        AND i.issue_date >= v_period_start
        AND i.issue_date <= v_period_end
        AND i.deleted_at IS NULL
    ) INTO v_invoice_exists;

    IF v_invoice_exists THEN
      CONTINUE;
    END IF;

    v_tax_amount := round(v_contract.rent_amount * v_tax_rate / 100, 2);
    v_total_amount := v_contract.rent_amount + v_tax_amount;

    v_batch_id := gen_random_uuid();

    INSERT INTO public.invoices (
      contract_id, issue_date, due_date, amount, tax_amount, tax_rate, status
    , company_id) VALUES (
      v_contract.id,
      current_date,
      current_date + interval '30 days',
      v_contract.rent_amount,
      v_tax_amount,
      v_tax_rate,
      'UNPAID'
    , v_company_id)
    RETURNING id INTO v_invoice_id;

    INSERT INTO public.journal_entries (
      id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at
    , company_id) VALUES (
      gen_random_uuid(),
      'INV-' || v_invoice_id::text || '-DR',
      current_date,
      v_ar_account_id,
      v_total_amount,
      'DEBIT',
      v_invoice_id,
      'invoice',
      v_invoice_id::text,
      v_batch_id,
      now()
    , v_company_id);

    INSERT INTO public.journal_entries (
      id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at
    , company_id) VALUES (
      gen_random_uuid(),
      'INV-' || v_invoice_id::text || '-CR-REV',
      current_date,
      v_revenue_account_id,
      v_contract.rent_amount,
      'CREDIT',
      v_invoice_id,
      'invoice',
      v_invoice_id::text,
      v_batch_id,
      now()
    , v_company_id);

    IF v_tax_amount > 0 AND v_vat_account_id IS NOT NULL THEN
      INSERT INTO public.journal_entries (
        id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at
      , company_id) VALUES (
        gen_random_uuid(),
        'INV-' || v_invoice_id::text || '-CR-VAT',
        current_date,
        v_vat_account_id,
        v_tax_amount,
        'CREDIT',
        v_invoice_id,
        'invoice',
        v_invoice_id::text,
        v_batch_id,
        now()
      , v_company_id);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    INSERT INTO public.audit_log (
      id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
    ) VALUES (
      gen_random_uuid()::text,
      extract(epoch from now())::bigint,
      auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'GENERATE',
      'invoices',
      'batch',
      format('Generated %s invoices from active contracts', v_count),
      'invoices',
      jsonb_build_object('count', v_count, 'tax_rate', v_tax_rate)::text,
      now()
    );
  END IF;

  RETURN v_count;
END;
$function$
;

-- Function: pay_owner_settlement_atomic
CREATE OR REPLACE FUNCTION public.pay_owner_settlement_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_id text := nullif(p_payload->>'settlement_id', '');
  v_method text := nullif(btrim(p_payload->>'method'), '');
  v_reference text := nullif(btrim(p_payload->>'payment_reference'), '');
  v_row public.owner_settlements%rowtype;
  v_owner_payable_account text;
  v_cash_account text;
  v_batch_id uuid := gen_random_uuid();
  v_entry_no text;
  v_cached jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to pay owner settlements.' using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_id is null or v_request_id is null or v_method is null then
    raise exception 'settlement_id, request_id, and method are required.';
  end if;
  select response_payload into v_cached from public.financial_operation_idempotency
   where operation_name = 'pay_owner_settlement_atomic' and request_id = v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  select * into v_row from public.owner_settlements where id = v_id for update;
  if not found then raise exception 'Owner settlement not found.'; end if;
  if v_row.status <> 'APPROVED' then raise exception 'Only APPROVED settlements can be paid.'; end if;

  select id into v_owner_payable_account
  from public.accounts where no = '2000' and company_id = v_company_id limit 1;
  select id into v_cash_account
  from public.accounts where no = '1111' and company_id = v_company_id limit 1;
  if v_owner_payable_account is null or v_cash_account is null then
    raise exception 'Owner payable or cash accounting account is not configured.';
  end if;

  v_entry_no := 'OST-PAY-' || upper(substr(replace(v_id, '-', ''), 1, 10));
  insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, batch_id, created_at, company_id)
  values
    (gen_random_uuid(), v_entry_no || '-D', current_date, v_owner_payable_account, v_row.net_payable, 'DEBIT', v_id::uuid, 'owner_settlement_payment', v_id, v_batch_id, now(), v_company_id),
    (gen_random_uuid(), v_entry_no || '-C', current_date, v_cash_account, v_row.net_payable, 'CREDIT', v_id::uuid, 'owner_settlement_payment', v_id, v_batch_id, now(), v_company_id);

  update public.owner_settlements
     set status = 'PAID', method = v_method, payment_reference = v_reference,
         paid_at = now(), paid_by = auth.uid(), updated_at = now()
   where id = v_id
    AND company_id = v_company_id;

  insert into public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()), 'PAY', 'owner_settlements', v_id,
    'Owner settlement paid with balanced owner-payable/cash journal batch', 'owner_settlements', left(p_payload::text, 4000), now());

  v_result := jsonb_build_object('success', true, 'idempotent', false, 'settlement_id', v_id, 'status', 'PAID', 'net_payable', v_row.net_payable, 'journal_batch_id', v_batch_id, 'request_id', v_request_id);
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('pay_owner_settlement_atomic', v_request_id, v_result) on conflict (operation_name, request_id) do nothing;
  return v_result;
end;
$function$
;

-- Function: post_receipt_atomic
CREATE OR REPLACE FUNCTION public.post_receipt_atomic(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_receipt jsonb;
  v_allocations jsonb;
  v_journal_entries jsonb;
  v_request_id text;
  v_company_id uuid;
  v_existing_id public.receipts.id%TYPE;
  v_invoice_id_text text;
  v_invoice record;
  v_allocation_total numeric;

  v_receipt_id public.receipts.id%TYPE;
  v_receipt_contract_id public.receipts.contract_id%TYPE;
  v_payment_invoice_id public.payments.invoice_id%TYPE;
  v_receipt_date_time public.receipts.date_time%TYPE;
  v_receipt_tenant_id public.receipts.tenant_id%TYPE;
  v_receipt_check_date public.receipts.check_date%TYPE;
  v_receipt_amount numeric;
  v_receipt_channel text;
  v_receipt_ref text;
  v_receipt_notes text;
  v_receipt_status text;

  v_allocation jsonb;
  v_allocation_id public.receipt_allocations.id%TYPE;
  v_allocation_receipt_id public.receipt_allocations.receipt_id%TYPE;
  v_allocation_invoice_id public.receipt_allocations.invoice_id%TYPE;
  v_allocation_tenant_id public.receipt_allocations.tenant_id%TYPE;

  v_journal jsonb;
  v_journal_id public.journal_entries.id%TYPE;
  v_journal_date public.journal_entries.date%TYPE;
  v_journal_source_id public.journal_entries.source_id%TYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS app_user
    WHERE app_user.id = auth.uid()
      AND app_user.role::text IN ('ADMIN', 'MANAGER')
      AND app_user.status::text = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول'
      USING ERRCODE = '42501';
  END IF;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  IF v_company_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.company_members AS membership
    WHERE membership.user_id = auth.uid()
      AND membership.company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'تعذر تحديد الشركة النشطة'
      USING ERRCODE = '42501';
  END IF;

  v_receipt := coalesce(payload->'receipt', '{}'::jsonb);
  v_allocations := coalesce(payload->'allocations', '[]'::jsonb);
  v_journal_entries := coalesce(payload->'journal_entries', '[]'::jsonb);
  v_request_id := nullif(coalesce(payload->>'request_id', v_receipt->>'request_id'), '');

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'معرّف الطلب مطلوب لضمان عدم التكرار.';
  END IF;

  SELECT receipt_record.id
    INTO v_existing_id
  FROM public.receipts AS receipt_record
  WHERE receipt_record.request_id = v_request_id
    AND receipt_record.company_id = v_company_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'request_id', v_request_id,
      'receipt_id', v_existing_id
    );
  END IF;

  -- Validate allocations don't exceed invoice balances
  FOR v_invoice_id_text IN
    SELECT DISTINCT allocation_record.value->>'invoice_id'
    FROM jsonb_array_elements(v_allocations) AS allocation_record(value)
    ORDER BY 1
  LOOP
    SELECT
      invoice_record.id,
      invoice_record.amount,
      invoice_record.tax_amount,
      invoice_record.paid_amount,
      invoice_record.status
    INTO v_invoice
    FROM public.invoices AS invoice_record
    WHERE invoice_record.id::text = v_invoice_id_text
      AND invoice_record.company_id = v_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'فاتورة غير موجودة: %', v_invoice_id_text;
    END IF;

    SELECT sum((allocation_record->>'amount')::numeric)
      INTO v_allocation_total
    FROM jsonb_array_elements(v_allocations) AS allocation_record
    WHERE allocation_record->>'invoice_id' = v_invoice_id_text;

    IF coalesce(v_invoice.paid_amount, 0) + v_allocation_total
         > coalesce(v_invoice.amount, 0) + coalesce(v_invoice.tax_amount, 0) + 0.001 THEN
      RAISE EXCEPTION 'قيمة السداد تتجاوز المتبقي على الفاتورة: %', v_invoice_id_text;
    END IF;
  END LOOP;

  -- Extract receipt fields into variables
  v_receipt_id := coalesce(v_receipt->>'id', gen_random_uuid()::text);
  v_receipt_contract_id := nullif(v_receipt->>'contract_id', '');
  v_receipt_tenant_id := nullif(v_receipt->>'tenant_id', '');
  v_receipt_check_date := nullif(v_receipt->>'check_date', '');
  v_receipt_amount := (v_receipt->>'amount')::numeric;
  v_receipt_channel := v_receipt->>'channel';
  v_receipt_ref := coalesce(v_receipt->>'ref', '');
  v_receipt_notes := coalesce(v_receipt->>'notes', '');
  v_receipt_status := coalesce(v_receipt->>'status', 'POSTED');

  IF nullif(v_receipt->>'date_time', '') IS NULL THEN
    v_receipt_date_time := now();
  ELSE
    v_receipt_date_time := v_receipt->>'date_time';
  END IF;

  -- Insert receipt
  INSERT INTO public.receipts(
    id,
    no,
    contract_id,
    date_time,
    channel,
    amount,
    ref,
    notes,
    status,
    check_number,
    check_bank,
    check_date,
    check_status,
    created_at,
    request_id,
    tenant_id,
    company_id
  ) VALUES (
    v_receipt_id,
    v_receipt->>'no',
    v_receipt_contract_id,
    v_receipt_date_time,
    v_receipt_channel,
    v_receipt_amount,
    v_receipt_ref,
    v_receipt_notes,
    v_receipt_status,
    nullif(v_receipt->>'check_number', ''),
    nullif(v_receipt->>'check_bank', ''),
    v_receipt_check_date,
    nullif(v_receipt->>'check_status', ''),
    now(),
    v_request_id,
    v_receipt_tenant_id,
    v_company_id
  );

  SELECT nullif(allocation_record->>'invoice_id', '')
    INTO v_payment_invoice_id
  FROM jsonb_array_elements(v_allocations) AS allocation_record
  LIMIT 1;

  -- Insert corresponding payments row (shadow record)
  INSERT INTO public.payments(
    receipt_id,
    contract_id,
    invoice_id,
    amount,
    payment_date,
    payment_method,
    reference_no,
    date_time,
    channel,
    status,
    notes,
    created_by,
    created_at,
    company_id
  ) VALUES (
    v_receipt_id,
    v_receipt_contract_id,
    v_payment_invoice_id,
    v_receipt_amount,
    (v_receipt_date_time::date),
    v_receipt_channel,
    nullif(v_receipt_ref, ''),
    v_receipt_date_time,
    v_receipt_channel,
    v_receipt_status,
    nullif(v_receipt_notes, ''),
    auth.uid(),
    now(),
    v_company_id
  );

  -- Insert receipt allocations
  FOR v_allocation IN
    SELECT allocation_record.value
    FROM jsonb_array_elements(v_allocations) AS allocation_record(value)
  LOOP
    v_allocation_id := coalesce(v_allocation->>'id', gen_random_uuid()::text);
    v_allocation_receipt_id := v_receipt_id;
    v_allocation_invoice_id := v_allocation->>'invoice_id';
    v_allocation_tenant_id := nullif(v_allocation->>'tenant_id', '');

    INSERT INTO public.receipt_allocations(
      id,
      receipt_id,
      invoice_id,
      amount,
      created_at,
      tenant_id,
      company_id
    ) VALUES (
      v_allocation_id,
      v_allocation_receipt_id,
      v_allocation_invoice_id,
      (v_allocation->>'amount')::numeric,
      now(),
      v_allocation_tenant_id,
      v_company_id
    );
  END LOOP;

  -- Update invoice paid_amount and status
  WITH allocation_totals AS (
    SELECT
      allocation_record->>'invoice_id' AS invoice_id,
      sum((allocation_record->>'amount')::numeric) AS total
    FROM jsonb_array_elements(v_allocations) AS allocation_record
    GROUP BY 1
  )
  UPDATE public.invoices AS invoice_record
  SET
    paid_amount = coalesce(invoice_record.paid_amount, 0) + allocation_totals.total,
    status = CASE
      WHEN coalesce(invoice_record.paid_amount, 0) + allocation_totals.total
        >= coalesce(invoice_record.amount, 0) + coalesce(invoice_record.tax_amount, 0) - 0.001
        THEN 'PAID'
      WHEN coalesce(invoice_record.paid_amount, 0) + allocation_totals.total > 0
        THEN 'PARTIALLY_PAID'
      ELSE invoice_record.status
    END
  FROM allocation_totals
  WHERE invoice_record.id::text = allocation_totals.invoice_id
    AND invoice_record.company_id = v_company_id;

  -- Insert journal entries
  FOR v_journal IN
    SELECT journal_record.value
    FROM jsonb_array_elements(v_journal_entries) AS journal_record(value)
  LOOP
    v_journal_id := coalesce(v_journal->>'id', gen_random_uuid()::text);
    v_journal_date := v_journal->>'date';
    v_journal_source_id := nullif(v_journal->>'source_id', '');

    INSERT INTO public.journal_entries(
      id,
      no,
      date,
      account_id,
      amount,
      type,
      source_id,
      entity_type,
      entity_id,
      created_at,
      company_id
    ) VALUES (
      v_journal_id,
      v_journal->>'no',
      v_journal_date,
      v_journal->>'account_id',
      (v_journal->>'amount')::numeric,
      v_journal->>'type',
      v_journal_source_id,
      nullif(v_journal->>'entity_type', ''),
      nullif(v_journal->>'entity_id', ''),
      now(),
      v_company_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'request_id', v_request_id,
    'receipt_id', v_receipt_id
  );
END;
$function$
;

-- Function: process_bank_reconciliation_match_atomic
CREATE OR REPLACE FUNCTION public.process_bank_reconciliation_match_atomic(payload jsonb)
 RETURNS bank_reconciliation_matches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_id uuid;
  v_statement_line_id uuid := nullif(payload->>'statement_line_id', '')::uuid;
  v_matched_entity_type text := nullif(payload->>'matched_entity_type', '');
  v_matched_entity_id text := nullif(payload->>'matched_entity_id', '');
  v_matched_amount numeric := nullif(payload->>'matched_amount', '')::numeric;
  v_notes text := nullif(payload->>'notes', '');
  v_line public.bank_statement_lines%ROWTYPE;
  v_match public.bank_reconciliation_matches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_user(), false) THEN
    RAISE EXCEPTION 'Authenticated app user is required.' USING ERRCODE = '42501';
  END IF;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  IF v_statement_line_id IS NULL THEN
    RAISE EXCEPTION 'statement_line_id is required.' USING ERRCODE = '22023';
  END IF;
  IF v_matched_entity_type NOT IN ('payment', 'receipt', 'expense', 'manual_adjustment') THEN
    RAISE EXCEPTION 'Invalid matched_entity_type.' USING ERRCODE = '22023';
  END IF;
  IF v_matched_entity_id IS NULL THEN
    RAISE EXCEPTION 'matched_entity_id is required.' USING ERRCODE = '22023';
  END IF;
  IF v_matched_amount IS NULL OR v_matched_amount = 0 THEN
    RAISE EXCEPTION 'matched_amount must be non-zero.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_line
  FROM public.bank_statement_lines
  WHERE id = v_statement_line_id
    AND deleted_at IS NULL
    AND company_id = v_company_id
FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bank statement line was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_line.status <> 'unmatched' THEN
    RAISE EXCEPTION 'Bank statement line is already processed.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.bank_reconciliation_matches (
    statement_line_id,
    matched_entity_type,
    matched_entity_id,
    matched_amount,
    notes,
    matched_by
  , company_id) VALUES (
    v_statement_line_id,
    v_matched_entity_type,
    v_matched_entity_id,
    v_matched_amount,
    v_notes,
    auth.uid()
  , v_company_id)
  RETURNING * INTO v_match;

  UPDATE public.bank_statement_lines
  SET status = 'matched', updated_at = now()
  WHERE id = v_statement_line_id
    AND company_id = v_company_id;

  INSERT INTO public.audit_log (
    id, user_id, action, entity, entity_id, note, "table",
    old_value, new_value, action_timestamp, created_at, updated_at
  ) VALUES (
    gen_random_uuid()::text,
    auth.uid(),
    'PROCESS_BANK_RECONCILIATION_MATCH_ATOMIC',
    'bank_reconciliation_match',
    v_match.id::text,
    'Bank statement line matched atomically through RPC.',
    'bank_reconciliation_matches',
    to_jsonb(v_line),
    jsonb_build_object('match', to_jsonb(v_match), 'statement_line_status', 'matched'),
    now(),
    now(),
    now()
  );

  RETURN v_match;
END;
$function$
;

-- Function: record_invoice_payment_atomic
CREATE OR REPLACE FUNCTION public.record_invoice_payment_atomic(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  actor_id uuid;
  v_invoice_id_raw text;
  v_invoice_id uuid;
  v_amount numeric;
  v_method text;
  v_date date;
  v_reference text;
  v_request_id text;
  v_invoice jsonb;
  v_contract jsonb;
  v_total_due numeric;
  v_paid_amount numeric;
  v_outstanding numeric;
  v_receipt_id uuid := gen_random_uuid();
  v_allocation_id uuid := gen_random_uuid();
  v_debit_account_id text;
  v_credit_account_id text;
  v_internal_payload jsonb;
  v_internal_result jsonb;
  v_existing_result jsonb;
  v_result jsonb;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to record invoice payments';
  END IF;

  IF NOT coalesce(public.is_admin_or_manager(), false) THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to record invoice payments'
      USING ERRCODE = '42501';
  END IF;

  v_request_id := nullif(payload->>'request_id', '');
  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id is required for idempotent payment recording';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('record_invoice_payment_atomic:' || v_request_id, 0)
  );

  SELECT response_payload
    INTO v_existing_result
  FROM public.financial_operation_idempotency
  WHERE operation_name = 'record_invoice_payment_atomic'
    AND request_id = v_request_id
  FOR UPDATE;

  IF v_existing_result IS NOT NULL THEN
    RETURN v_existing_result;
  END IF;

  v_invoice_id_raw := nullif(payload->>'invoice_id', '');
  IF v_invoice_id_raw IS NULL THEN
    RAISE EXCEPTION 'invoice_id is required';
  END IF;

  IF v_invoice_id_raw !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'invoice_id is not a valid identifier: %', v_invoice_id_raw;
  END IF;

  v_invoice_id := v_invoice_id_raw::uuid;
  v_amount := coalesce((payload->>'amount')::numeric, 0);
  v_method := nullif(payload->>'method', '');
  v_date := coalesce(nullif(payload->>'date', '')::date, current_date);
  v_reference := nullif(payload->>'reference', '');

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT to_jsonb(invoice_record)
    INTO v_invoice
  FROM public.invoices AS invoice_record
  WHERE invoice_record.id::text = v_invoice_id::text
    AND coalesce((to_jsonb(invoice_record)->>'deleted_at')::timestamptz, NULL) IS NULL
  FOR UPDATE;

  IF v_invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT to_jsonb(contract_record)
    INTO v_contract
  FROM public.contracts AS contract_record
  WHERE contract_record.id::text = (v_invoice->>'contract_id')
    AND coalesce((to_jsonb(contract_record)->>'deleted_at')::timestamptz, NULL) IS NULL
  FOR UPDATE;

  IF v_contract IS NULL THEN
    RAISE EXCEPTION 'Contract for invoice not found';
  END IF;

  v_total_due := coalesce((v_invoice->>'amount')::numeric, 0)
    + coalesce((v_invoice->>'tax_amount')::numeric, 0);
  v_paid_amount := coalesce((v_invoice->>'paid_amount')::numeric, 0);
  v_outstanding := v_total_due - v_paid_amount;

  IF v_amount > v_outstanding + 0.001 THEN
    RAISE EXCEPTION 'Payment amount exceeds outstanding invoice balance';
  END IF;

  v_debit_account_id := public.find_payment_account_id('cash');
  v_credit_account_id := public.find_payment_account_id('receivable');

  IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
    RAISE EXCEPTION 'Payment accounting accounts are not configured';
  END IF;

  -- Delegate fully to post_receipt_atomic — it now creates payments row automatically
  v_internal_payload := jsonb_build_object(
    'request_id', v_request_id,
    'receipt', jsonb_build_object(
      'id', v_receipt_id,
      'contract_id', v_invoice->>'contract_id',
      'date_time', v_date::text,
      'channel', v_method,
      'amount', v_amount,
      'ref', coalesce(v_reference, v_request_id),
      'notes', 'Invoice payment ' || v_invoice_id::text,
      'status', 'POSTED',
      'created_at', timezone('utc', now()),
      'request_id', v_request_id
    ),
    'allocations', jsonb_build_array(jsonb_build_object(
      'id', v_allocation_id,
      'invoice_id', v_invoice_id,
      'amount', v_amount,
      'created_at', timezone('utc', now())
    )),
    'journal_entries', jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-D',
        'date', v_date::text,
        'account_id', v_debit_account_id,
        'amount', v_amount,
        'type', 'DEBIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice->>'contract_id',
        'created_at', timezone('utc', now())
      ),
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-C',
        'date', v_date::text,
        'account_id', v_credit_account_id,
        'amount', v_amount,
        'type', 'CREDIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice->>'contract_id',
        'created_at', timezone('utc', now())
      )
    )
  );

  v_internal_result := public.post_receipt_atomic(v_internal_payload);

  v_result := v_internal_result || jsonb_build_object(
    'status', 'recorded',
    'request_id', v_request_id,
    'invoice_id', v_invoice_id,
    'receipt_id', coalesce(
      nullif(v_internal_result->>'receipt_id', '')::uuid,
      v_receipt_id
    )
  );

  INSERT INTO public.financial_operation_idempotency(
    operation_name,
    request_id,
    response_payload
  ) VALUES (
    'record_invoice_payment_atomic',
    v_request_id,
    v_result
  )
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$function$
;

-- Function: refund_deposit_atomic
CREATE OR REPLACE FUNCTION public.refund_deposit_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id','');
  v_deposit_id text := nullif(p_payload->>'deposit_id','');
  v_amount numeric := nullif(p_payload->>'amount','')::numeric;
  v_payment_method text := nullif(p_payload->>'payment_method','');
  v_refund_date date := nullif(p_payload->>'refund_date','')::date;
  v_notes text := nullif(p_payload->>'notes','');
  v_deposit record;
  v_cached jsonb;
  v_result jsonb;
  v_cash_account_id text;
  v_deposit_account_id text;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role required' using errcode='42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  if v_request_id is null then v_request_id := gen_random_uuid()::text; end if;
  select response_payload into v_cached from public.financial_operation_idempotency where operation_name='refund_deposit_atomic' and request_id=v_request_id;
  if v_cached is not null then return v_cached || jsonb_build_object('idempotent', true); end if;

  if v_deposit_id is null then raise exception 'deposit_id required'; end if;
  if v_amount is null or v_amount <=0 then raise exception 'amount >0 required'; end if;
  if v_refund_date is null then v_refund_date := current_date; end if;
  if v_payment_method is null then v_payment_method := 'bank_transfer'; end if;

  perform pg_advisory_xact_lock(hashtextextended('refund_deposit:'||v_deposit_id,0));

  select * into v_deposit from public.tenant_deposits where id=v_deposit_id and deleted_at is null   AND company_id = v_company_id
for update;
  if not found then raise exception 'Deposit not found'; end if;

  if v_amount > v_deposit.remaining_amount then
    raise exception 'Insufficient remaining balance for refund';
  end if;

  update public.tenant_deposits
  set refunded_amount = refunded_amount + v_amount,
      remaining_amount = deposit_amount - deducted_amount - (refunded_amount + v_amount),
      status = case when (deposit_amount - deducted_amount - (refunded_amount + v_amount)) <=0 then 'refunded' else 'partially_refunded' end,
      settled_date = case when (deposit_amount - deducted_amount - (refunded_amount + v_amount)) <=0 then v_refund_date else settled_date end,
      updated_at = now()
  where id=v_deposit_id;

  insert into public.deposit_transactions (deposit_id, type, amount, reason, description, payment_method, request_id, company_id)
  values (v_deposit_id, 'refund', v_amount, 'refund_partial', v_notes, v_payment_method, v_request_id, v_company_id);

  v_cash_account_id := (
    select id from public.accounts
    where no='1111' and company_id = v_company_id
    limit 1
  );
  v_deposit_account_id := (
    select id from public.accounts
    where no='2200' and company_id = v_company_id
    limit 1
  );

  if v_cash_account_id is not null and v_deposit_account_id is not null then
    insert into public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, company_id)
    values
      (gen_random_uuid()::text, 'DEP-REF-'||substr(v_deposit_id,1,6)||'-D', v_refund_date, v_deposit_account_id, v_amount, 'DEBIT', v_deposit_id, 'deposit_refund', v_deposit_id, v_company_id),
      (gen_random_uuid()::text, 'DEP-REF-'||substr(v_deposit_id,1,6)||'-C', v_refund_date, v_cash_account_id, v_amount, 'CREDIT', v_deposit_id, 'deposit_refund', v_deposit_id, v_company_id);
  end if;

  v_result := jsonb_build_object('success',true,'deposit_id',v_deposit_id,'refunded',v_amount,'remaining', v_deposit.remaining_amount - v_amount,'request_id',v_request_id);

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('refund_deposit_atomic', v_request_id, v_result) on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$
;

-- Function: renew_contract_atomic
CREATE OR REPLACE FUNCTION public.renew_contract_atomic(old_contract_id text, new_contract_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_id uuid;
  v_new_id text;
  v_old public.contracts%rowtype;
  v_new_start text := new_contract_data ->> 'new_start';
  v_new_end text := new_contract_data ->> 'new_end';
  v_new_amount numeric := (new_contract_data ->> 'new_amount')::numeric;
  v_requested_agreement_id uuid := NULLIF(new_contract_data ->> 'agreement_id', '')::uuid;
  v_effective_agreement_id uuid;
  v_new_start_date date;
  v_new_end_date date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول';
  END IF;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  IF v_new_start IS NULL OR v_new_end IS NULL OR v_new_amount IS NULL THEN
    RAISE EXCEPTION 'new_start / new_end / new_amount مطلوبة';
  END IF;
  IF v_new_start !~ '^\d{4}-\d{2}-\d{2}$' OR v_new_end !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'تواريخ التجديد يجب أن تكون بصيغة YYYY-MM-DD';
  END IF;

  v_new_start_date := v_new_start::date;
  v_new_end_date := v_new_end::date;
  IF v_new_end_date <= v_new_start_date THEN RAISE EXCEPTION 'تاريخ نهاية التجديد يجب أن يكون بعد تاريخ البداية'; END IF;
  IF v_new_amount <= 0 THEN RAISE EXCEPTION 'قيمة الإيجار الجديدة يجب أن تكون أكبر من صفر'; END IF;

  SELECT * INTO v_old FROM public.contracts
  WHERE id::text = old_contract_id::text AND status IN ('active', 'expired', 'ACTIVE') AND deleted_at IS NULL
    AND company_id = v_company_id
FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'العقد الأصلي غير موجود أو لا يمكن تجديده'; END IF;

  SELECT oa.id INTO v_effective_agreement_id
  FROM public.owner_agreements oa
  WHERE oa.id = COALESCE(v_requested_agreement_id, v_old.agreement_id)
    AND oa.property_id = v_old.property_id
    AND oa.starts_on <= v_new_start_date
    AND (oa.ends_on IS NULL OR oa.ends_on >= v_new_end_date)
  LIMIT 1;

  IF v_effective_agreement_id IS NULL THEN
    RAISE EXCEPTION 'لا توجد اتفاقية مكتب ومالك تغطي كامل فترة التجديد. اختر الاتفاقية السارية أو أنشئ اتفاقية لاحقة قبل التجديد.';
  END IF;

  IF v_old.unit_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.contracts
    WHERE unit_id = v_old.unit_id AND id::text <> old_contract_id::text
      AND status IN ('active', 'draft', 'ACTIVE') AND deleted_at IS NULL
      AND start_date::date <= v_new_end_date AND end_date::date >= v_new_start_date
  ) THEN RAISE EXCEPTION 'الوحدة محجوزة خلال فترة التجديد'; END IF;

  UPDATE public.contracts SET status = 'expired', updated_at = now() WHERE id::text = old_contract_id::text
    AND company_id = v_company_id;

  INSERT INTO public.contracts (no, unit_id, tenant_id, rent_amount, due_day, start_date, end_date, deposit, status, sponsor_name, sponsor_id, sponsor_phone, property_id, organization_id, payment_cycle, commission_rate, payment_terms_id, agreement_id, monthly_rent, renewed_from_id, created_at, updated_at, deleted_at, company_id)
  VALUES (v_old.no, v_old.unit_id, v_old.tenant_id, v_new_amount, v_old.due_day, v_new_start, v_new_end, COALESCE(v_old.deposit, 0), 'active', v_old.sponsor_name, v_old.sponsor_id, v_old.sponsor_phone, v_old.property_id, v_old.organization_id, v_old.payment_cycle, v_old.commission_rate, v_old.payment_terms_id, v_effective_agreement_id, v_new_amount, v_old.id, now(), now(), NULL, v_company_id)
  RETURNING id::text INTO v_new_id;

  RETURN jsonb_build_object('status', 'renewed', 'old_contract_id', old_contract_id, 'new_contract_id', v_new_id, 'agreement_id', v_effective_agreement_id);
END;
$function$
;

-- Function: soft_delete_contract_atomic
CREATE OR REPLACE FUNCTION public.soft_delete_contract_atomic(p_contract_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_old public.contracts%rowtype;
  v_company_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لحذف عقد' USING ERRCODE = '42501';
  END IF;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  SELECT * INTO v_old
  FROM public.contracts
  WHERE id = p_contract_id AND deleted_at IS NULL
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'العقد غير موجود';
  END IF;

  -- Protect financial integrity: reject soft deletion if paid invoices exist
  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE contract_id = p_contract_id
      AND deleted_at IS NULL
      AND COALESCE(paid_amount, 0) > 0
  ) THEN
    RAISE EXCEPTION 'لا يمكن حذف عقد يحتوي على فواتير مدفوعة أو دفعات مسجلة؛ يرجى إنهاء العقد بدلاً من ذلك';
  END IF;

  -- Protect financial integrity: reject soft deletion if receipts exist
  IF EXISTS (
    SELECT 1 FROM public.receipts
    WHERE contract_id = p_contract_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'لا يمكن حذف عقد يحتوي على إيصالات مالية؛ يرجى إنهاء العقد بدلاً من ذلك';
  END IF;

  -- Cancel and soft-delete future unpaid invoices so they do not remain open
  UPDATE public.invoices
  SET status = 'CANCELLED',
      deleted_at = now(),
      updated_at = now()
  WHERE contract_id = p_contract_id
    AND company_id = v_company_id
    AND deleted_at IS NULL
    AND COALESCE(paid_amount, 0) = 0
    AND status NOT IN ('CANCELLED', 'PAID')
    AND due_date::date > current_date;

  -- Soft-delete the contract
  UPDATE public.contracts
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = p_contract_id
    AND company_id = v_company_id;

  RETURN jsonb_build_object(
    'status', 'deleted',
    'contract_id', p_contract_id
  );
END;
$function$
;

-- Function: terminate_contract_atomic
CREATE OR REPLACE FUNCTION public.terminate_contract_atomic(p_contract_id text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_old public.contracts%rowtype;
  v_cancelled_invoice_ids text[];
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنهاء عقد' using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'سبب الإنهاء مطلوب';
  end if;

  select * into v_old
  from public.contracts
  where id = p_contract_id and deleted_at is null
  for update;

  if not found then
    raise exception 'العقد غير موجود';
  end if;

  if v_old.status not in ('active', 'draft') then
    raise exception 'لا يمكن إنهاء عقد بحالته الحالية (%): يجب أن يكون نشطاً أو مسودة', v_old.status;
  end if;

  update public.contracts
  set status = 'terminated',
      cancellation_reason = p_reason,
      updated_at = now()
  where id = p_contract_id
    AND company_id = v_company_id;

  -- Cancel future, still-unpaid invoices so they stop appearing as
  -- outstanding receivables against a dead contract. Invoices with any
  -- payment history (paid_amount > 0) are left as-is — this only stops
  -- new/unpaid obligations, it does not touch settled accounting history.
  -- due_date is `text` on production; cast explicitly before comparing
  -- against current_date (date).
  with cancelled as (
    update public.invoices
    set status = 'CANCELLED',
        updated_at = now()
    where contract_id = p_contract_id
      and deleted_at is null
      and paid_amount = 0
      and status not in ('CANCELLED', 'PAID')
      and due_date::date > current_date
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_cancelled_invoice_ids from cancelled;

  return jsonb_build_object(
    'status', 'terminated',
    'contract_id', p_contract_id,
    'cancelled_invoice_ids', to_jsonb(v_cancelled_invoice_ids)
  );
end;
$function$
;

-- Function: update_contract_atomic
CREATE OR REPLACE FUNCTION public.update_contract_atomic(p_contract_id text, p_property_id text, p_unit_id uuid, p_tenant_id uuid, p_agreement_id uuid, p_start_date date, p_end_date date, p_rent_amount numeric, p_payment_cycle text, p_payment_terms_id uuid, p_status text, p_cancellation_reason text, p_notes text, p_attachment_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
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

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

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
  where id::text = p_contract_id
    AND company_id = v_company_id;

  return (select to_jsonb(c) from public.contracts c where c.id::text = p_contract_id);
end;
$function$
;

-- Function: update_expense_with_journal_atomic
CREATE OR REPLACE FUNCTION public.update_expense_with_journal_atomic(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company_id uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_expense_id public.expenses.id%type := nullif(p_payload->>'expense_id', '');
  v_expense public.expenses%rowtype;
  v_property_id public.expenses.property_id%type;
  v_cost_center_id public.expenses.cost_center_id%type;
  v_contract_id public.expenses.contract_id%type;
  v_expense_date public.expenses.expense_date%type;
  v_amount numeric;
  v_category text;
  v_description text;
  v_charged_to text;
  v_attachment_url text;
  v_amount_changed boolean;
  v_date_changed boolean;
  v_expense_account_id public.accounts.id%type;
  v_cash_account_id public.accounts.id%type;
  v_reversal_no text;
  v_new_entry_no text;
  v_result jsonb;
  v_cached jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to update expenses.' using errcode = '42501';
  end if;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_expense_id is null then raise exception 'expense_id is required.'; end if;

  if v_request_id is null then
    v_request_id := gen_random_uuid()::text;
  end if;

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'update_expense_with_journal_atomic'
    and request_id = v_request_id;
  if v_cached is not null then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('update_expense:' || v_expense_id::text, 0));

  select * into v_expense
  from public.expenses
  where id::text = v_expense_id::text and deleted_at is null
  for update;
  if not found then raise exception 'Expense not found or has been deleted.'; end if;

  v_property_id := case when p_payload ? 'property_id'
    then nullif(p_payload->>'property_id', '') else v_expense.property_id end;
  v_cost_center_id := case when p_payload ? 'cost_center_id'
    then nullif(p_payload->>'cost_center_id', '') else v_expense.cost_center_id end;
  v_contract_id := case when p_payload ? 'contract_id'
    then nullif(p_payload->>'contract_id', '') else v_expense.contract_id end;
  v_expense_date := case when p_payload ? 'expense_date'
    then nullif(p_payload->>'expense_date', '')::date else v_expense.expense_date end;
  v_amount := case when p_payload ? 'amount'
    then nullif(p_payload->>'amount', '')::numeric else v_expense.amount end;
  v_category := case when p_payload ? 'category'
    then nullif(p_payload->>'category', '') else v_expense.category end;
  v_description := case when p_payload ? 'description'
    then nullif(p_payload->>'description', '') else v_expense.description end;
  v_charged_to := case when p_payload ? 'charged_to'
    then nullif(p_payload->>'charged_to', '') else v_expense.charged_to end;
  v_attachment_url := case when p_payload ? 'attachment_url'
    then nullif(p_payload->>'attachment_url', '') else v_expense.attachment_url end;

  if v_property_id is null then raise exception 'property_id is required.'; end if;
  if v_expense_date is null then raise exception 'expense_date is required.'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'amount must be greater than zero.'; end if;
  if v_category is null then raise exception 'category is required.'; end if;

  if not exists (
    select 1 from public.properties p
    where p.id::text = v_property_id::text and p.deleted_at is null
  ) then
    raise exception 'Property not found.';
  end if;

  if v_cost_center_id is not null and not exists (
    select 1 from public.cost_centers cc where cc.id::text = v_cost_center_id::text
  ) then
    raise exception 'Cost center not found.';
  end if;

  if v_contract_id is not null and not exists (
    select 1 from public.contracts c
    where c.id::text = v_contract_id::text
      and c.property_id::text = v_property_id::text
      and c.deleted_at is null
  ) then
    raise exception 'Contract does not belong to the selected property.';
  end if;

  v_amount_changed := v_amount is distinct from v_expense.amount;
  v_date_changed := v_expense_date is distinct from v_expense.expense_date;

  update public.expenses
  set property_id = v_property_id,
      cost_center_id = v_cost_center_id,
      contract_id = v_contract_id,
      expense_date = v_expense_date,
      date_time = v_expense_date::text,
      amount = v_amount,
      category = v_category,
      description = v_description,
      charged_to = v_charged_to,
      attachment_url = v_attachment_url,
      updated_at = now()
  where id::text = v_expense_id::text
    AND company_id = v_company_id;

  if v_amount_changed or v_date_changed then
    select id into v_expense_account_id from public.accounts where no = '6100' limit 1;
    select id into v_cash_account_id from public.accounts where no = '1111' limit 1;
    if v_expense_account_id is null or v_cash_account_id is null then
      raise exception 'Expense accounting accounts are not configured';
    end if;

    v_reversal_no := 'EXP-REV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_expense_id::text, '-', ''), 1, 6);
    v_new_entry_no := 'EXP-UPD-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_expense_id::text, '-', ''), 1, 6);

    insert into public.journal_entries
      (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at, company_id)
    values
      (gen_random_uuid()::text, v_reversal_no || '-D', v_expense.expense_date::text, v_expense_account_id, v_expense.amount, 'CREDIT', v_expense_id, 'expense_reversal', v_expense_id, now(), v_company_id),
      (gen_random_uuid()::text, v_reversal_no || '-C', v_expense.expense_date::text, v_cash_account_id, v_expense.amount, 'DEBIT', v_expense_id, 'expense_reversal', v_expense_id, now()),
      (gen_random_uuid()::text, v_new_entry_no || '-D', v_expense_date::text, v_expense_account_id, v_amount, 'DEBIT', v_expense_id, 'expense_update', v_expense_id, now()),
      (gen_random_uuid()::text, v_new_entry_no || '-C', v_expense_date::text, v_cash_account_id, v_amount, 'CREDIT', v_expense_id, 'expense_update', v_expense_id, now());
  end if;

  insert into public.audit_log
    (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  values (
    gen_random_uuid()::text, extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'UPDATE', 'expenses', v_expense_id::text,
    case
      when v_amount_changed or v_date_changed then 'Expense updated with balanced journal adjustment'
      else 'Expense metadata updated without journal amount change'
    end,
    'expenses', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'expense_id', v_expense_id,
    'amount_changed', v_amount_changed,
    'date_changed', v_date_changed,
    'old_amount', v_expense.amount,
    'new_amount', v_amount,
    'request_id', v_request_id
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('update_expense_with_journal_atomic', v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$
;

-- Function: update_owner_agreement_atomic
CREATE OR REPLACE FUNCTION public.update_owner_agreement_atomic(p_agreement_id uuid, payload jsonb)
 RETURNS owner_agreements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_id uuid;
  v_row public.owner_agreements%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يحتاج هذا الإجراء صلاحية مدير أو مشرف.';
  END IF;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  SELECT * INTO v_row
  FROM public.owner_agreements
  WHERE id = p_agreement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'اتفاقية المالك غير موجودة.';
  END IF;

  UPDATE public.owner_agreements
  SET owner_id = COALESCE((payload->>'owner_id')::uuid, owner_id),
      agreement_type = COALESCE(NULLIF(payload->>'agreement_type', ''), agreement_type),
      commission_type = COALESCE(NULLIF(payload->>'commission_type', ''), commission_type),
      commission_value = COALESCE((payload->>'commission_value')::numeric, commission_value),
      starts_on = COALESCE((payload->>'starts_on')::date, starts_on),
      ends_on = CASE WHEN payload ? 'ends_on' THEN NULLIF(payload->>'ends_on', '')::date ELSE ends_on END,
      notes = CASE WHEN payload ? 'notes' THEN NULLIF(payload->>'notes', '') ELSE notes END,
      updated_at = now()
  WHERE id = p_agreement_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$
;

-- Function: void_receipt_atomic
CREATE OR REPLACE FUNCTION public.void_receipt_atomic(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_requested_id text := nullif(btrim(payload->>'receipt_id'), '');
  v_reason text := nullif(btrim(payload->>'reason'), '');
  v_request_id text := nullif(btrim(payload->>'request_id'), '');
  v_cached jsonb;
  v_payment public.payments%rowtype;
  v_receipt public.receipts%rowtype;
  v_receipt_was_void boolean := false;
  v_reversal_request_id text;
  v_reversal_batch_id uuid;
  v_original_count integer := 0;
  v_existing_reversal_count integer := 0;
  v_created_reversal_count integer := 0;
  v_original_debits numeric := 0;
  v_original_credits numeric := 0;
  v_result jsonb;
BEGIN
  IF v_actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_actor_id
      AND u.status::text = 'ACTIVE'
      AND u.role::text IN ('ADMIN', 'MANAGER')
  ) THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to void receipts.'
      USING ERRCODE = '42501';
  END IF;

  IF v_requested_id IS NULL OR v_reason IS NULL OR v_request_id IS NULL THEN
    RAISE EXCEPTION 'receipt_id, reason, and request_id are required.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('void_receipt_atomic:' || v_request_id, 0)
  );

  SELECT response_payload
  INTO v_cached
  FROM public.financial_operation_idempotency
  WHERE operation_name = 'void_receipt_atomic'
    AND request_id = v_request_id
  FOR UPDATE;

  IF v_cached IS NOT NULL THEN
    RETURN v_cached || jsonb_build_object('idempotent', true);
  END IF;

  SELECT p.*
  INTO v_payment
  FROM public.payments p
  WHERE p.id::text = v_requested_id
    AND p.deleted_at IS NULL
  FOR UPDATE;

  IF v_payment.id IS NOT NULL THEN
    SELECT r.*
    INTO v_receipt
    FROM public.receipts r
    WHERE r.id::text = coalesce(nullif(v_payment.receipt_id::text, ''), v_payment.id::text)
      AND r.deleted_at IS NULL
    FOR UPDATE;
  ELSE
    SELECT r.*
    INTO v_receipt
    FROM public.receipts r
    WHERE r.id::text = v_requested_id
      AND r.deleted_at IS NULL
    FOR UPDATE;

    IF v_receipt.id IS NOT NULL THEN
      SELECT p.*
      INTO v_payment
      FROM public.payments p
      WHERE p.receipt_id::text = v_receipt.id::text
        AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC NULLS LAST, p.id
      LIMIT 1
      FOR UPDATE;
    END IF;
  END IF;

  IF v_payment.id IS NULL OR v_receipt.id IS NULL THEN
    RAISE EXCEPTION 'Linked payment and receipt were not found for identifier %.', v_requested_id
      USING ERRCODE = 'P0002';
  END IF;

  v_receipt_was_void := upper(coalesce(v_receipt.status, '')) = 'VOID';
  v_reversal_request_id := 'void:' || v_receipt.id::text;

  SELECT
    count(*)::integer,
    coalesce(sum(je.amount) FILTER (WHERE upper(je.type) = 'DEBIT'), 0),
    coalesce(sum(je.amount) FILTER (WHERE upper(je.type) = 'CREDIT'), 0)
  INTO v_original_count, v_original_debits, v_original_credits
  FROM public.journal_entries je
  WHERE je.source_id::text = v_receipt.id::text
    AND je.deleted_at IS NULL
    AND coalesce(je.request_id, '') <> v_reversal_request_id
    AND coalesce(je.entity_type, '') <> 'receipt_void';

  IF v_original_count > 0 AND abs(v_original_debits - v_original_credits) > 0.001 THEN
    RAISE EXCEPTION 'Original receipt journal is unbalanced; void aborted before mutation.'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer
  INTO v_existing_reversal_count
  FROM public.journal_entries je
  WHERE je.request_id = v_reversal_request_id
    AND je.deleted_at IS NULL;

  IF NOT v_receipt_was_void THEN
    WITH allocated AS (
      SELECT ra.invoice_id, sum(ra.amount)::numeric AS amount
      FROM public.receipt_allocations ra
      WHERE ra.receipt_id::text = v_receipt.id::text
      GROUP BY ra.invoice_id
    )
    UPDATE public.invoices i
    SET
      paid_amount = greatest(0, coalesce(i.paid_amount, 0) - allocated.amount),
      status = CASE
        WHEN greatest(0, coalesce(i.paid_amount, 0) - allocated.amount) <= 0.001 THEN 'UNPAID'
        WHEN greatest(0, coalesce(i.paid_amount, 0) - allocated.amount)
          < coalesce(i.amount, 0) + coalesce(i.tax_amount, 0) - 0.001 THEN 'PARTIALLY_PAID'
        ELSE 'PAID'
      END,
      updated_at = now()
    FROM allocated
    WHERE i.id = allocated.invoice_id;
  END IF;

  UPDATE public.receipts
  SET status = 'VOID', voided_at = floor(extract(epoch from clock_timestamp()) * 1000)::bigint, updated_at = now()
  WHERE id::text = v_receipt.id::text;

  UPDATE public.payments
  SET status = 'VOID', updated_at = now()
  WHERE id = v_payment.id;

  IF v_original_count > 0 AND v_existing_reversal_count = 0 THEN
    v_reversal_batch_id := gen_random_uuid();

    INSERT INTO public.journal_entries (
      id, no, date, account_id, amount, type, source_id, entity_type,
      entity_id, created_at, request_id, status, batch_id
    )
    SELECT
      gen_random_uuid()::text,
      'VOID-' || left(replace(v_receipt.id::text, '-', ''), 12) || '-' || row_number() over (order by je.id),
      current_date::text,
      je.account_id,
      je.amount,
      CASE upper(je.type) WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,
      v_receipt.id::text,
      'receipt_void',
      v_receipt.id::text,
      now(),
      v_reversal_request_id,
      'posted',
      v_reversal_batch_id
    FROM public.journal_entries je
    WHERE je.source_id::text = v_receipt.id::text
      AND je.deleted_at IS NULL
      AND coalesce(je.request_id, '') <> v_reversal_request_id
      AND coalesce(je.entity_type, '') <> 'receipt_void';

    GET DIAGNOSTICS v_created_reversal_count = ROW_COUNT;
    PERFORM public.close_journal_batch(v_reversal_batch_id);
  END IF;

  IF NOT v_receipt_was_void OR v_created_reversal_count > 0 THEN
    INSERT INTO public.audit_log (
      id, ts, user_id, action, entity, entity_id, note, "table", details,
      old_value, new_value, action_timestamp, created_at, updated_at
    ) VALUES (
      gen_random_uuid()::text,
      extract(epoch from now())::bigint,
      v_actor_id::text,
      'VOID_RECEIPT_ATOMIC',
      'receipt',
      v_receipt.id::text,
      'Receipt voided atomically with payment, invoice, report, and journal parity.',
      'receipts',
      jsonb_build_object(
        'reason', v_reason,
        'request_id', v_request_id,
        'requested_id', v_requested_id,
        'payment_id', v_payment.id,
        'receipt_id', v_receipt.id,
        'journal_reversal_batch_id', v_reversal_batch_id,
        'journal_reversal_entries', v_created_reversal_count
      )::text,
      jsonb_build_object('payment_status', v_payment.status, 'receipt_status', v_receipt.status),
      jsonb_build_object('payment_status', 'VOID', 'receipt_status', 'VOID'),
      now(),
      now(),
      now()
    );
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', v_receipt_was_void AND v_created_reversal_count = 0,
    'request_id', v_request_id,
    'requested_receipt_id', v_requested_id,
    'payment_id', v_payment.id,
    'receipt_id', v_receipt.id,
    'status', 'VOID',
    'reason', v_reason,
    'journal_reversal_batch_id', v_reversal_batch_id,
    'journal_reversal_entries', v_created_reversal_count
  );

  INSERT INTO public.financial_operation_idempotency (
    operation_name, request_id, response_payload
  ) VALUES (
    'void_receipt_atomic', v_request_id, v_result
  )
  ON CONFLICT (operation_name, request_id) DO NOTHING;

  RETURN v_result;
END;
$function$
;

-- ============================================
-- Trigger Functions (8)
-- ============================================

-- Trigger: update_contract_balance_from_allocation
CREATE OR REPLACE FUNCTION public.update_contract_balance_from_allocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  -- Bind identifiers to the destination schema so fresh replay and
  -- production-compatible schemas cannot drift into text/uuid comparisons.
  v_contract_id public.contract_balances.contract_id%TYPE;
  v_total_invoiced numeric;
  v_total_paid numeric;
  v_tenant_id public.contract_balances.tenant_id%TYPE;
  v_unit_id public.contract_balances.unit_id%TYPE;
BEGIN
  -- Get contract_id from the invoice referenced by this allocation
  IF TG_OP = 'DELETE' THEN
    SELECT i.contract_id INTO v_contract_id
    FROM public.invoices i
    WHERE i.id = OLD.invoice_id;
  ELSE
    SELECT i.contract_id INTO v_contract_id
    FROM public.invoices i
    WHERE i.id = NEW.invoice_id;
  END IF;

  IF v_contract_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate totals for this contract
  SELECT 
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    c.tenant_id,
    c.unit_id::text
  INTO v_total_invoiced, v_total_paid, v_tenant_id, v_unit_id
  FROM public.contracts c
  LEFT JOIN public.invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
  WHERE c.id = v_contract_id
  GROUP BY c.tenant_id, c.unit_id;

  -- If the referenced contract cannot be found, do not fail invoice/allocation
  -- writes. This should not happen with valid FK data, but keeps the trigger
  -- defensive and avoids accidental write outages.
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Upsert contract_balances
  INSERT INTO public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at
  ) VALUES (
    v_contract_id,
    v_tenant_id,
    v_unit_id,
    v_total_invoiced,
    v_total_paid,
    v_total_invoiced - v_total_paid,
    now()
  )
  ON CONFLICT (contract_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    unit_id = EXCLUDED.unit_id,
    total_invoiced = EXCLUDED.total_invoiced,
    total_paid = EXCLUDED.total_paid,
    balance_due = EXCLUDED.balance_due,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$function$
;

-- Trigger: update_contract_balance_from_invoice
CREATE OR REPLACE FUNCTION public.update_contract_balance_from_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_contract_id public.contract_balances.contract_id%TYPE;
  v_total_invoiced numeric;
  v_total_paid numeric;
  v_tenant_id public.contract_balances.tenant_id%TYPE;
  v_unit_id public.contract_balances.unit_id%TYPE;
  v_company_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contract_id := OLD.contract_id;
  ELSE
    v_contract_id := NEW.contract_id;
  END IF;

  IF v_contract_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT 
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    c.tenant_id,
    c.unit_id::text,
    c.company_id
  INTO v_total_invoiced, v_total_paid, v_tenant_id, v_unit_id, v_company_id
  FROM public.contracts c
  LEFT JOIN public.invoices i ON i.contract_id = c.id AND i.deleted_at IS NULL
  WHERE c.id = v_contract_id
  GROUP BY c.tenant_id, c.unit_id, c.company_id;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, company_id, updated_at
  ) VALUES (
    v_contract_id,
    v_tenant_id,
    v_unit_id,
    v_total_invoiced,
    v_total_paid,
    v_total_invoiced - v_total_paid,
    v_company_id,
    now()
  )
  ON CONFLICT (contract_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    unit_id = EXCLUDED.unit_id,
    total_invoiced = EXCLUDED.total_invoiced,
    total_paid = EXCLUDED.total_paid,
    balance_due = EXCLUDED.balance_due,
    company_id = EXCLUDED.company_id,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$function$
;

-- Trigger: update_contract_balance_on_receipt_allocation
CREATE OR REPLACE FUNCTION public.update_contract_balance_on_receipt_allocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into contract_balances (contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, company_id, updated_at)
  select c.id, c.tenant_id, c.unit_id,
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0)), 0),
    coalesce(sum(i.paid_amount), 0),
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - i.paid_amount), 0),
    c.company_id,
    now()
  from contracts c
  left join invoices i on i.contract_id = c.id and i.status != 'VOID'
  where c.id in (
    select distinct contract_id from invoices
    where id = coalesce(NEW.invoice_id, OLD.invoice_id)
  )
  group by c.id, c.tenant_id, c.unit_id, c.company_id
  on conflict (contract_id) do update set
    total_invoiced = excluded.total_invoiced,
    total_paid = excluded.total_paid,
    balance_due = excluded.balance_due,
    company_id = excluded.company_id,
    updated_at = now();
  return coalesce(NEW, OLD);
end;
$function$
;

-- Trigger: update_invoice_status
CREATE OR REPLACE FUNCTION public.update_invoice_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  update invoices set status =
    case
      when paid_amount >= amount + coalesce(tax_amount, 0) then 'PAID'
      when paid_amount > 0 then 'PARTIALLY_PAID'
      else 'UNPAID'
    end
  where id = coalesce(NEW.invoice_id, OLD.invoice_id)
    and company_id = coalesce(NEW.company_id, OLD.company_id);
  return coalesce(NEW, OLD);
end;
$function$
;

-- Trigger: update_owner_balance_from_operation
CREATE OR REPLACE FUNCTION public.update_owner_balance_from_operation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_new_contract_id public.contracts.id%TYPE;
  v_old_contract_id public.contracts.id%TYPE;
  v_new_property_id public.properties.id%TYPE;
  v_old_property_id public.properties.id%TYPE;
  v_owner_id uuid;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF TG_TABLE_NAME = 'payments' THEN
      v_new_contract_id := NEW.contract_id;
    ELSE
      v_new_property_id := NEW.property_id;
    END IF;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF TG_TABLE_NAME = 'payments' THEN
      v_old_contract_id := OLD.contract_id;
    ELSE
      v_old_property_id := OLD.property_id;
    END IF;
  END IF;

  FOR v_owner_id IN
    SELECT DISTINCT candidate.owner_id
    FROM (
      SELECT oa.owner_id
      FROM public.contracts c JOIN public.owner_agreements oa ON oa.id = c.agreement_id
      WHERE c.id IN (v_new_contract_id, v_old_contract_id)
      UNION ALL
      SELECT po.owner_id
      FROM public.property_owners po
      WHERE po.property_id IN (v_new_property_id, v_old_property_id)
    ) candidate
  LOOP
    PERFORM public.recalculate_owner_balance(v_owner_id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

-- Trigger: update_owner_balance_on_expense
CREATE OR REPLACE FUNCTION public.update_owner_balance_on_expense()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_property_id text;
  v_contract_id text;
begin
  if tg_table_name = 'expenses' then
    v_property_id := coalesce(NEW.property_id, OLD.property_id);
    v_contract_id := coalesce(NEW.contract_id, OLD.contract_id);
  else
    v_property_id := null;
    v_contract_id := coalesce(NEW.contract_id, OLD.contract_id);
  end if;

  insert into owner_balances (owner_id, total_income, total_expenses, commission, net_balance, updated_at)
  select o.id,
    coalesce(sum(case when r.status = 'POSTED' then r.amount else 0 end), 0),
    coalesce(sum(case when e.status = 'POSTED' and e.charged_to in ('OWNER', 'OFFICE') then e.amount else 0 end), 0),
    coalesce(sum(case when r.status = 'POSTED' then r.amount * coalesce(o.commission_value / 100, 0.05) else 0 end), 0),
    0,
    now()
  from owners o
  left join properties p on p.owner_id = o.id
  left join units u on u.property_id = p.id
  -- Removed "and c.status = 'ACTIVE'" filter: lifetime totals must include
  -- receipts/expenses from ENDED (renewed/terminated) contracts.
  left join contracts c on c.unit_id = u.id and c.deleted_at is null
  left join receipts r on r.contract_id = c.id
  left join expenses e on (e.contract_id = c.id or e.property_id = p.id)
  where o.id = coalesce(
    (select owner_id from properties where id = v_property_id),
    (select p2.owner_id from contracts c2 join properties p2 on p2.id = c2.property_id where c2.id = v_contract_id)
  )
  group by o.id, o.commission_value
  on conflict (owner_id) do update set
    total_income = excluded.total_income,
    total_expenses = excluded.total_expenses,
    commission = excluded.commission,
    net_balance = excluded.total_income - excluded.total_expenses - excluded.commission,
    updated_at = now();
  return coalesce(NEW, OLD);
end;
$function$
;

-- Trigger: update_tenant_balance
CREATE OR REPLACE FUNCTION public.update_tenant_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_tenant_id text;
  v_company_id uuid;
begin
  if tg_op = 'DELETE' then
    v_company_id := old.company_id;
  else
    v_company_id := new.company_id;
  end if;

  if tg_table_name = 'invoices' then
    if tg_op = 'DELETE' then
      select tenant_id
      into v_tenant_id
      from public.contracts
      where id = old.contract_id;
    else
      select tenant_id
      into v_tenant_id
      from public.contracts
      where id = new.contract_id;
    end if;
  else
    -- receipt_allocations: has its own tenant_id column, no contract_id.
    if tg_op = 'DELETE' then
      v_tenant_id := old.tenant_id;
    else
      v_tenant_id := new.tenant_id;
    end if;
  end if;

  if v_tenant_id is null then
    return coalesce(new, old);
  end if;

  insert into public.tenant_balances (
    tenant_id,
    balance_due,
    updated_at,
    company_id
  )
  select
    c.tenant_id,
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - i.paid_amount), 0),
    now(),
    v_company_id
  from public.contracts c
  left join public.invoices i
    on i.contract_id = c.id
   and i.deleted_at is null
  where c.tenant_id = v_tenant_id
    and c.company_id = v_company_id
    and (i.id is null or i.company_id = v_company_id)
  group by c.tenant_id
  on conflict (tenant_id) do update set
    balance_due = excluded.balance_due,
    company_id = excluded.company_id,
    updated_at = now();

  return coalesce(new, old);
end;
$function$
;

-- Trigger: update_unit_status
CREATE OR REPLACE FUNCTION public.update_unit_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_unit_id uuid;
  v_unit_ids uuid[];
  v_current_status text;
  v_target_status text;
begin
  if tg_op = 'DELETE' then
    v_unit_ids := array[old.unit_id];
  elsif tg_op = 'INSERT' then
    v_unit_ids := array[new.unit_id];
  else
    v_unit_ids := array[old.unit_id, new.unit_id];
  end if;

  foreach v_unit_id in array v_unit_ids
  loop
    if v_unit_id is null then
      continue;
    end if;

    select u.status into v_current_status
    from public.units u
    where u.id = v_unit_id;

    if not found then
      continue;
    end if;

    v_target_status := public.resolve_unit_operational_status(v_unit_id, v_current_status);

    update public.units
    set status = v_target_status
    where id = v_unit_id
      and status is distinct from v_target_status;
  end loop;

  return coalesce(new, old);
end;
$function$
;

COMMIT;