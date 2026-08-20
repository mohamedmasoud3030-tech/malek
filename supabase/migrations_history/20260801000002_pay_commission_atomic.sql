-- ============================================================================
-- 20260801000002_pay_commission_atomic.sql
-- Purpose: Make commissions financially complete by providing server-side
-- atomic operations (pay_commission_atomic & reverse_commission_atomic) that
-- create/reverse POSTED expenses and balanced journal entries when paying a
-- commission, with company-scope isolation and duplicate payment protection.
--
-- Accounting Invariants:
-- - Paying a commission posts an operating expense (account 6100) and credits
--   a verified company cash/bank account.
-- - Reversing a commission creates a balanced accounting reversal (CREDIT expense,
--   DEBIT cash) with entity_type = 'commission_reversal' and marks the expense VOID.
-- - Direct client/browser updates setting status = 'paid', paid_at, or expense_id
--   are rejected by database trigger trg_guard_commission_financial_fields.
-- - Concurrency safety via pg_advisory_xact_lock on commission_id per company.
--
-- Security:
-- - SECURITY DEFINER with pinned search_path.
-- - Authorizes authenticated ADMIN / MANAGER roles in current company context.
--
-- Rollback: supabase/rollback/20260801_rollback_pay_commission_atomic.sql
-- ============================================================================

begin;

-- ── 1. Database-side protection against direct non-financial paid updates ────
create or replace function public.guard_commission_financial_fields()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if (
    lower(coalesce(new.status, '')) = 'paid'
    or new.paid_at is not null
    or new.expense_id is not null
  ) and coalesce(current_setting('malik.financial_commission_authorized', true), '') is distinct from 'true' then
    raise exception 'غير مصرح: لا يمكن تعيين حالة الدفع أو تاريخ الصرف أو رابط المصروف مباشرة دون استخدام أمر الصرف المالي المعتمد'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_guard_commission_financial_fields on public.commissions;
create trigger trg_guard_commission_financial_fields
  before insert or update of status, paid_at, expense_id on public.commissions
  for each row execute function public.guard_commission_financial_fields();

revoke all on function public.guard_commission_financial_fields() from public, anon, authenticated;

-- ── 2. pay_commission_atomic(p_payload jsonb) ──────────────────────────────
create or replace function public.pay_commission_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
  v_commission_id text := nullif(trim(p_payload->>'commission_id'), '');
  v_request_id text := nullif(trim(p_payload->>'request_id'), '');
  v_payment_date date := coalesce(nullif(trim(p_payload->>'payment_date'), '')::date, current_date);
  v_account_id text := nullif(trim(p_payload->>'account_id'), '');
  v_property_id uuid := nullif(trim(p_payload->>'property_id'), '')::uuid;
  v_comm public.commissions%rowtype;
  v_expense_id uuid;
  v_expense_no text;
  v_expense_account_id text;
  v_cash_account_id text;
  v_cached jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لصرف العمولة' using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'سياق الشركة مطلوب لصرف العمولة' using errcode = '42501';
  end if;

  if v_commission_id is null then
    raise exception 'معرّف العمولة مطلوب' using errcode = '23514';
  end if;

  if v_request_id is null or v_request_id = '' then
    v_request_id := gen_random_uuid()::text;
  end if;

  -- Advisory lock per company + commission_id to prevent concurrent duplicate payment
  perform pg_advisory_xact_lock(
    hashtextextended('pay_commission_atomic:' || v_company_id::text || ':' || v_commission_id, 0)
  );

  -- Idempotency check scoped by company
  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'pay_commission_atomic:' || v_company_id::text
    and request_id = v_request_id;
  if v_cached is not null then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  -- Select commission with company isolation
  select * into v_comm
  from public.commissions
  where id = v_commission_id
    and company_id = v_company_id;

  if not found then
    raise exception 'العمولة غير موجودة أو لا تنتمي لشركتك' using errcode = '23514';
  end if;

  if lower(coalesce(v_comm.status, '')) = 'paid' or v_comm.expense_id is not null then
    raise exception 'العمولة مدفوعة بالفعل ولا يمكن تكرار صرفها' using errcode = '23514';
  end if;

  if lower(coalesce(v_comm.status, '')) = 'cancelled' then
    raise exception 'لا يمكن صرف عمولة ملغاة' using errcode = '23514';
  end if;

  if coalesce(v_comm.amount, 0) <= 0 then
    raise exception 'قيمة العمولة غير صحيحة أو تساوي صفراً' using errcode = '23514';
  end if;

  -- Resolve payment account: verify it belongs to current company and is an eligible account
  if v_account_id is not null then
    select id into v_cash_account_id
    from public.accounts
    where (id = v_account_id or no = v_account_id)
      and company_id = v_company_id
    limit 1;
    if v_cash_account_id is null then
      raise exception 'الحساب المحاسبي المحدد للدفع غير موجود في شركتك' using errcode = '23514';
    end if;
  else
    v_cash_account_id := public.require_company_account_id(v_company_id, '1111');
  end if;

  -- Resolve expense account via canonical company-scoped resolver
  v_expense_account_id := public.require_company_account_id(v_company_id, '6100');

  -- Resolve property_id if not explicitly provided and commission is contract-related
  if v_property_id is null and lower(coalesce(v_comm.type, '')) = 'contract' and v_comm.source_id is not null then
    select c.property_id into v_property_id
    from public.contracts c
    where c.id::text = v_comm.source_id
      and c.company_id = v_company_id
    limit 1;
  end if;

  if v_property_id is null then
    select id into v_property_id
    from public.properties
    where company_id = v_company_id
      and deleted_at is null
    order by id
    limit 1;
  end if;

  if v_property_id is null then
    raise exception 'يجب وجود عقار مسجل في الشركة لربط مصروف العمولة به' using errcode = '23514';
  end if;

  v_expense_id := gen_random_uuid();
  v_expense_no := 'CEXP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(v_request_id, '-', ''), 1, 6);

  -- Create POSTED expense record representing commission payout
  insert into public.expenses (
    id, property_id, category, amount, expense_date, description,
    status, date_time, no, company_id
  ) values (
    v_expense_id, v_property_id, 'Commission', v_comm.amount, v_payment_date,
    'صرف عمولة الوسيط/الموظف: ' || coalesce(v_comm.staff_name, 'غير محدد'),
    'POSTED', now(), v_expense_no, v_company_id
  );

  -- Insert balanced journal entries (DEBIT expense, CREDIT cash)
  insert into public.journal_entries (
    id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at, company_id
  ) values
    (gen_random_uuid()::text, v_expense_no || '-D', v_payment_date::text, v_expense_account_id, v_comm.amount, 'DEBIT', v_expense_id::text, 'expense', v_expense_id::text, now(), v_company_id),
    (gen_random_uuid()::text, v_expense_no || '-C', v_payment_date::text, v_cash_account_id, v_comm.amount, 'CREDIT', v_expense_id::text, 'expense', v_expense_id::text, now(), v_company_id);

  -- Authorize financial trigger and update commission status
  perform set_config('malik.financial_commission_authorized', 'true', true);

  update public.commissions
  set status = 'paid',
      expense_id = v_expense_id,
      paid_at = floor(extract(epoch from now()) * 1000)::bigint,
      updated_at = now()
  where id = v_commission_id
    and company_id = v_company_id;

  -- Audit log entry
  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid()::text,
    extract(epoch from now())::bigint,
    auth.uid()::text,
    (select email from auth.users where id = auth.uid()),
    'CREATE', 'commissions', v_commission_id,
    'Commission financially paid with POSTED expense and balanced journal entry',
    'commissions', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'commission_id', v_commission_id,
    'expense_id', v_expense_id,
    'expense_no', v_expense_no,
    'amount', v_comm.amount
  );

  insert into public.financial_operation_idempotency (
    operation_name, request_id, response_payload, created_at
  ) values (
    'pay_commission_atomic:' || v_company_id::text,
    v_request_id,
    v_result,
    now()
  );

  return v_result;
end;
$function$;

-- ── 3. reverse_commission_atomic(p_payload jsonb) ──────────────────────────
create or replace function public.reverse_commission_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
  v_commission_id text := nullif(trim(p_payload->>'commission_id'), '');
  v_reason text := nullif(trim(p_payload->>'reason'), '');
  v_request_id text := nullif(trim(p_payload->>'request_id'), '');
  v_comm public.commissions%rowtype;
  v_expense public.expenses%rowtype;
  v_reversal_no text;
  v_cached jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لعكس العمولة' using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'سياق الشركة مطلوب لعكس العمولة' using errcode = '42501';
  end if;

  if v_commission_id is null then
    raise exception 'معرّف العمولة مطلوب' using errcode = '23514';
  end if;

  if v_reason is null then
    raise exception 'سبب العكس مطلوب' using errcode = '23514';
  end if;

  if v_request_id is null or v_request_id = '' then
    v_request_id := gen_random_uuid()::text;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('reverse_commission_atomic:' || v_company_id::text || ':' || v_commission_id, 0)
  );

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'reverse_commission_atomic:' || v_company_id::text
    and request_id = v_request_id;
  if v_cached is not null then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  select * into v_comm
  from public.commissions
  where id = v_commission_id
    and company_id = v_company_id;

  if not found then
    raise exception 'العمولة غير موجودة أو لا تنتمي لشركتك' using errcode = '23514';
  end if;

  if lower(coalesce(v_comm.status, '')) <> 'paid' or v_comm.expense_id is null then
    raise exception 'العمولة غير مدفوعة مالياً ولا يمكن عكسها' using errcode = '23514';
  end if;

  select * into v_expense
  from public.expenses
  where id = v_comm.expense_id
    and company_id = v_company_id;

  if not found then
    raise exception 'المصروف المالي المرتبط بالعمولة غير موجود' using errcode = '23514';
  end if;

  if upper(coalesce(v_expense.status, '')) = 'VOID' then
    raise exception 'المصروف المالي معكوس بالفعل ولا يمكن تكرار العكس' using errcode = '23514';
  end if;

  v_reversal_no := 'REV-' || v_expense.no;

  -- Create balanced accounting reversal entries (CREDIT expense, DEBIT cash)
  insert into public.journal_entries (
    id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at, company_id
  )
  select
    gen_random_uuid()::text,
    v_reversal_no || '-' || (case when je.type = 'DEBIT' then 'C' else 'D' end),
    current_date::text,
    je.account_id,
    je.amount,
    case when je.type = 'DEBIT' then 'CREDIT' else 'DEBIT' end,
    v_comm.id,
    'commission_reversal',
    v_comm.id,
    now(),
    v_company_id
  from public.journal_entries je
  where je.source_id::text = v_comm.expense_id::text
    and je.company_id = v_company_id;

  -- Mark original expense VOID (preserving record)
  update public.expenses
  set status = 'VOID',
      description = coalesce(description, '') || ' [تم العكس: ' || v_reason || ']'
  where id = v_comm.expense_id
    and company_id = v_company_id;

  -- Authorize financial trigger and revert commission status to cancelled
  perform set_config('malik.financial_commission_authorized', 'true', true);

  update public.commissions
  set status = 'cancelled',
      paid_at = null,
      updated_at = now()
  where id = v_commission_id
    and company_id = v_company_id;

  -- Audit log entry
  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid()::text,
    extract(epoch from now())::bigint,
    auth.uid()::text,
    (select email from auth.users where id = auth.uid()),
    'UPDATE', 'commissions', v_commission_id,
    'Commission payment reversed with balanced journal entries: ' || v_reason,
    'commissions', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'commission_id', v_commission_id,
    'reversed', true
  );

  insert into public.financial_operation_idempotency (
    operation_name, request_id, response_payload, created_at
  ) values (
    'reverse_commission_atomic:' || v_company_id::text,
    v_request_id,
    v_result,
    now()
  );

  return v_result;
end;
$function$;

revoke all on function public.pay_commission_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.reverse_commission_atomic(jsonb) from public, anon, authenticated;
grant execute on function public.pay_commission_atomic(jsonb) to authenticated, service_role;
grant execute on function public.reverse_commission_atomic(jsonb) to authenticated, service_role;

commit;
