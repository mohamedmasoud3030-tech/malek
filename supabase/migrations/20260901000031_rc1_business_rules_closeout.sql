-- RC1 business rules closeout — defensive database enforcement of confirmed
-- locked rules (RC1 closeout audit, Rules 1/4/5).
--
-- Rule 1 (FIN-001, GAP-006): owner-agency rent must never credit office
--   revenue 4000. 4000 (Sublease Rental Revenue) is reserved for MASTER_LEASE
--   principal accounting; owner-agency management fee revenue uses 4100.
--   A defensive journal-line guard now rejects ANY journal line crediting 4000
--   unless the owning batch is a legitimate master-lease posting
--   (source_type master_lease_*), while master-lease credits keep working.
-- Rule 2 (owner_agreement_versions): RATE vs FIXED_MONTHLY enforcement is
--   already correct (owner_agreement_versions_commission_type_check +
--   owner_agreement_versions_recognition_matches_commission). No change.
-- Rule 3 (fixed monthly rent): full-period posting without daily proration is
--   already correct in generate_invoices_from_active_contracts. No change;
--   regression coverage is added in the PGlite closeout proof.
-- Rule 4 (OPS-010, GAP-011): 'payment' is not a commission source type. It was
--   accepted by the client validator, create_commission_atomic and
--   update_commission_atomic, and the table had no CHECK. The RPCs now reject
--   it explicitly and a DB CHECK constrains commissions.type to the canonical
--   source domain. Commission approval, financial payment and reversal are
--   preserved (pay_commission_atomic / reverse_commission_atomic unchanged).
-- Rule 5 (D09, DP-4, ADR-0017 Decision C): LATE_FEE exists in the automation
--   job contract and as an invoice charge type, but late-fee revenue has no
--   approved canonical mapping in RC1 and must be fail-closed. DB-level
--   rejection is added for LATE_FEE invoice charge types and LATE_FEE
--   automation jobs. Bank reconciliation matching of posted
--   manual_adjustment journals is untouched: this migration does not modify
--   bank_reconciliation_matches, its CHECK, or the matching RPC.
--
-- Forward-only. No rollback file (repository convention).
-- Evidence: rentrix-app/src/features/financials/rc1-business-rules-closeout.test.ts

begin;

-- ============================================================
-- Rule 1 — 4000 is master-lease revenue only
-- ============================================================

create or replace function public.guard_journal_line_rc1_revenue_scope()
returns trigger
language plpgsql
set search_path to public, pg_temp
as $$
declare
  v_account_no text;
  v_source_type text;
begin
  -- Only the credit side manufactures revenue; debits to 4000 (for example a
  -- master-lease reversal line) are never revenue recognition and stay allowed.
  if coalesce(new.credit, 0) <= 0 then
    return new;
  end if;

  select a.no, b.source_type
    into v_account_no, v_source_type
    from public.journal_batches b
    join public.accounts a
      on a.id = new.account_id
     and a.company_id = b.company_id
   where b.id = new.batch_id;

  -- Unknown/out-of-company account scope is rejected elsewhere (GL kernel and
  -- the journal line immutability guard); do not mask that failure here.
  if v_account_no is null then
    return new;
  end if;

  if v_account_no = '4000'
     and coalesce(btrim(v_source_type), '') !~ '^master_lease' then
    raise exception 'RC1_4000_NON_MASTER_LEASE_CREDIT_BLOCKED: account 4000 (Sublease Rental Revenue) may only be credited by master-lease postings (source_type master_lease_*); batch source_type % must use the locked owner-agency chart (2000 owner funds / 4100 management fee).', v_source_type
      using errcode = '23514';
  end if;

  return new;
end;
$$;

alter function public.guard_journal_line_rc1_revenue_scope() owner to postgres;
grant execute on function public.guard_journal_line_rc1_revenue_scope() to service_role;
revoke all on function public.guard_journal_line_rc1_revenue_scope() from public, anon, authenticated;

comment on function public.guard_journal_line_rc1_revenue_scope() is
  'RC1 defensive guard (FIN-001/GAP-006): rejects journal lines crediting 4000 unless the batch is a master-lease posting. Owner-agency rent is agent-net; 4000 is master-lease sublease revenue only.';

create trigger trg_guard_journal_line_rc1_revenue_scope
before insert or update on public.journal_lines
for each row
execute function public.guard_journal_line_rc1_revenue_scope();

-- ============================================================
-- Rule 4 — commissions.type canonical source domain (no 'payment')
-- ============================================================

-- Fail closed if any historical commission already uses the removed 'payment'
-- source type. Posted history must not be mutated by this migration; the
-- operator must review such rows through the governed correction path (S08)
-- before the constraint can be installed.
do $commissions_preflight$
declare
  v_violations integer;
begin
  select count(*) into v_violations
    from public.commissions
   where lower(coalesce(btrim(type), '')) = 'payment';

  if v_violations > 0 then
    raise exception 'RC1_COMMISSION_PAYMENT_ROWS_PRESENT: % commission row(s) use the removed payment source type; review through the governed correction path before installing the canonical type domain.', v_violations
      using errcode = '23514';
  end if;
end
$commissions_preflight$;

alter table public.commissions
  drop constraint if exists commissions_type_check;

alter table public.commissions
  add constraint commissions_type_check
  check (type is null or type = any (array['contract'::text, 'owner'::text, 'lead'::text, 'land'::text]));

comment on constraint commissions_type_check on public.commissions is
  'RC1 closeout (Rule 4): commission source domain is contract/owner/lead/land. payment is not a commission source type; approval/payment/reversal of valid commissions are unaffected.';

-- The RPCs keep their exact behavior, idempotency and authorization; only the
-- source-type validation changes to reject 'payment' explicitly with a stable
-- machine-readable code instead of the generic invalid-type error.

create or replace function public.create_commission_atomic("p_payload" "jsonb") returns "jsonb"
    language "plpgsql" security definer
    set "search_path" to 'public', 'pg_temp'
    as $$
declare
  v_company_id uuid;
  v_request_id text := nullif(btrim(p_payload->>'request_id'), '');
  v_staff_name text := nullif(btrim(p_payload->>'staff_name'), '');
  v_type text := lower(nullif(btrim(p_payload->>'type'), ''));
  v_source_id text := nullif(btrim(p_payload->>'source_id'), '');
  v_deal_value numeric := nullif(btrim(p_payload->>'deal_value'), '')::numeric;
  v_percentage numeric := nullif(btrim(p_payload->>'percentage'), '')::numeric;
  v_amount numeric := nullif(btrim(p_payload->>'amount'), '')::numeric;
  v_comm public.commissions%rowtype;
  v_cached jsonb;
  v_result jsonb;
  v_operation_name text;
  v_request_fingerprint text;
  v_cached_fingerprint text;
begin
  if auth.uid() is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لإنشاء عمولة'
      using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if v_staff_name is null then
    raise exception 'اسم الموظف أو الوسيط مطلوب.' using errcode = '22023';
  end if;
  if v_type = 'payment' then
    raise exception 'COMMISSION_TYPE_PAYMENT_REMOVED: payment is not a commission source type in RC1; commissions attach to a contract, owner, lead or land source.'
      using errcode = '23514';
  end if;
  if v_type is null or v_type not in ('contract', 'owner', 'lead', 'land') then
    raise exception 'نوع مصدر العمولة غير صحيح.' using errcode = '22023';
  end if;
  if v_deal_value is not null and v_deal_value < 0 then
    raise exception 'قيمة الصفقة يجب أن تكون صفراً أو أكبر.' using errcode = '22023';
  end if;
  if v_percentage is not null and (v_percentage < 0 or v_percentage > 100) then
    raise exception 'نسبة العمولة يجب أن تكون بين صفر و100.' using errcode = '22023';
  end if;

  -- Preserve the existing application behavior exactly: an explicit amount
  -- wins; otherwise derive deal_value * percentage / 100 rounded to 2 decimals.
  if v_amount is null and v_deal_value is not null and v_percentage is not null then
    v_amount := round(v_deal_value * (v_percentage / 100.0), 2);
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'أدخل قيمة عمولة أكبر من صفر أو قيمة الصفقة والنسبة.'
      using errcode = '22023';
  end if;

  if v_request_id is null then
    v_request_id := gen_random_uuid()::text;
  end if;

  v_operation_name := 'create_commission_atomic:' || v_company_id::text;
  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'staff_name', v_staff_name,
    'type', v_type,
    'source_id', v_source_id,
    'deal_value', v_deal_value,
    'percentage', v_percentage,
    'amount', v_amount
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(
    hashtextextended(v_operation_name || ':' || v_request_id, 0)
  );

  select response_payload
    into v_cached
  from public.financial_operation_idempotency
  where operation_name = v_operation_name
    and request_id = v_request_id
  for update;

  if v_cached is not null then
    v_cached_fingerprint := v_cached->>'_request_fingerprint';
    if v_cached_fingerprint is null or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED'
        using errcode = '22023';
    end if;
    if v_cached_fingerprint <> v_request_fingerprint then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode = '22023';
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  insert into public.commissions (
    id, staff_name, type, status, source_id, deal_value, percentage, amount,
    paid_at, expense_id, company_id, created_at, updated_at
  ) values (
    gen_random_uuid()::text, v_staff_name, v_type, 'pending', v_source_id,
    v_deal_value, v_percentage, v_amount,
    null, null, v_company_id, now(), now()
  )
  returning * into v_comm;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'CREATE', 'commissions', v_comm.id,
    'Commission created through trusted RPC with server-derived company and pending status',
    'commissions',
    left(jsonb_build_object(
      'request_id', v_request_id,
      'staff_name', v_staff_name,
      'type', v_type,
      'source_id', v_source_id,
      'deal_value', v_deal_value,
      'percentage', v_percentage,
      'amount', v_amount
    )::text, 4000),
    now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'commission_id', v_comm.id,
    'status', v_comm.status,
    'request_id', v_request_id,
    'commission', to_jsonb(v_comm)
  );

  insert into public.financial_operation_idempotency (
    operation_name, request_id, response_payload
  ) values (
    v_operation_name,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      'response', v_result
    )
  );

  return v_result;
end;
$$;

alter function public.create_commission_atomic("p_payload" "jsonb") owner to postgres;

comment on function public.create_commission_atomic("p_payload" "jsonb") is
  'PR-C + RC1 closeout (Rule 4): creates a pending operational commission with server-derived company_id; rejects the removed payment source type; does not post a journal entry.';

create or replace function public.update_commission_atomic("p_payload" "jsonb") returns "jsonb"
    language "plpgsql" security definer
    set "search_path" to 'public', 'pg_temp'
    as $$
declare
  v_company_id uuid;
  v_id text := nullif(btrim(p_payload->>'commission_id'), '');
  v_request_id text := nullif(btrim(p_payload->>'request_id'), '');
  v_staff_name text := nullif(btrim(p_payload->>'staff_name'), '');
  v_type text := lower(nullif(btrim(p_payload->>'type'), ''));
  v_requested_status text := lower(nullif(btrim(p_payload->>'requested_status'), ''));
  v_source_id text := nullif(btrim(p_payload->>'source_id'), '');
  v_deal_value numeric := nullif(btrim(p_payload->>'deal_value'), '')::numeric;
  v_percentage numeric := nullif(btrim(p_payload->>'percentage'), '')::numeric;
  v_amount numeric := nullif(btrim(p_payload->>'amount'), '')::numeric;
  v_comm public.commissions%rowtype;
  v_cached jsonb;
  v_result jsonb;
  v_operation_name text;
  v_request_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target_id text;
  v_old_status text;
  v_updated_count integer;
begin
  if auth.uid() is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لتعديل عمولة'
      using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if v_id is null then
    raise exception 'معرّف العمولة مطلوب' using errcode = '22023';
  end if;
  if v_staff_name is null then
    raise exception 'اسم الموظف أو الوسيط مطلوب.' using errcode = '22023';
  end if;
  if v_type = 'payment' then
    raise exception 'COMMISSION_TYPE_PAYMENT_REMOVED: payment is not a commission source type in RC1; commissions attach to a contract, owner, lead or land source.'
      using errcode = '23514';
  end if;
  if v_type is null or v_type not in ('contract', 'owner', 'lead', 'land') then
    raise exception 'نوع مصدر العمولة غير صحيح.' using errcode = '22023';
  end if;
  if v_requested_status is null or v_requested_status not in ('pending', 'approved') then
    raise exception 'تعديل العمولة يسمح فقط بحالة pending أو approved؛ استخدم أمر الإلغاء أو الصرف للحالات النهائية.'
      using errcode = '22023';
  end if;
  if v_deal_value is not null and v_deal_value < 0 then
    raise exception 'قيمة الصفقة يجب أن تكون صفراً أو أكبر.' using errcode = '22023';
  end if;
  if v_percentage is not null and (v_percentage < 0 or v_percentage > 100) then
    raise exception 'نسبة العمولة يجب أن تكون بين صفر و100.' using errcode = '22023';
  end if;

  if v_amount is null and v_deal_value is not null and v_percentage is not null then
    v_amount := round(v_deal_value * (v_percentage / 100.0), 2);
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'أدخل قيمة عمولة أكبر من صفر أو قيمة الصفقة والنسبة.'
      using errcode = '22023';
  end if;

  if v_request_id is null then
    v_request_id := gen_random_uuid()::text;
  end if;

  v_operation_name := 'update_commission_atomic:' || v_company_id::text;
  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'commission_id', v_id,
    'staff_name', v_staff_name,
    'type', v_type,
    'requested_status', v_requested_status,
    'source_id', v_source_id,
    'deal_value', v_deal_value,
    'percentage', v_percentage,
    'amount', v_amount
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(
    hashtextextended(v_operation_name || ':' || v_request_id, 0)
  );

  select *
    into v_comm
  from public.commissions
  where id = v_id
    and company_id = v_company_id
  for update;

  if not found then
    raise exception 'COMMISSION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  select response_payload
    into v_cached
  from public.financial_operation_idempotency
  where operation_name = v_operation_name
    and request_id = v_request_id
  for update;

  if v_cached is not null then
    v_cached_fingerprint := v_cached->>'_request_fingerprint';
    v_cached_target_id := v_cached->>'_target_id';
    if v_cached_fingerprint is null
       or v_cached_target_id is null
       or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED'
        using errcode = '22023';
    end if;
    if v_cached_fingerprint <> v_request_fingerprint or v_cached_target_id <> v_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode = '22023';
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  v_old_status := lower(coalesce(v_comm.status, ''));
  if v_old_status = 'paid' then
    raise exception 'COMMISSION_PAID_IMMUTABLE' using errcode = '22023';
  end if;
  if v_old_status = 'cancelled' then
    raise exception 'COMMISSION_CANCELLED_IMMUTABLE' using errcode = '22023';
  end if;

  update public.commissions
     set staff_name = v_staff_name,
         type = v_type,
         status = v_requested_status,
         source_id = v_source_id,
         deal_value = v_deal_value,
         percentage = v_percentage,
         amount = v_amount,
         updated_at = now()
   where id = v_id
     and company_id = v_company_id
  returning * into v_comm;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'COMMISSION_UPDATE_COUNT_MISMATCH' using errcode = 'P0001';
  end if;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
    (select email from auth.users where id = auth.uid()),
    'UPDATE', 'commissions', v_id,
    'Commission updated through trusted RPC',
    'commissions',
    left(jsonb_build_object(
      'request_id', v_request_id,
      'old_status', v_old_status,
      'new_status', v_requested_status,
      'staff_name', v_staff_name,
      'type', v_type,
      'source_id', v_source_id,
      'deal_value', v_deal_value,
      'percentage', v_percentage,
      'amount', v_amount
    )::text, 4000),
    now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'commission_id', v_comm.id,
    'status', v_comm.status,
    'request_id', v_request_id,
    'commission', to_jsonb(v_comm)
  );

  insert into public.financial_operation_idempotency (
    operation_name, request_id, response_payload
  ) values (
    v_operation_name,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      '_target_id', v_id,
      'response', v_result
    )
  );

  return v_result;
end;
$$;

alter function public.update_commission_atomic("p_payload" "jsonb") owner to postgres;

comment on function public.update_commission_atomic("p_payload" "jsonb") is
  'PR-C + RC1 closeout (Rule 4): updates operational commission fields and only pending/approved status; rejects the removed payment source type; paid/cancelled rows are immutable.';

-- ============================================================
-- Rule 5 — LATE_FEE is fail-closed in RC1
-- ============================================================
-- ADR-0017 Decision C / DP-4: late fees and other charges have no approved
-- canonical mapping in RC1 and must remain fail-closed; D09 keeps late fees
-- disabled by default until the governed accounting decision lands. Both
-- writable entry points for a LATE_FEE record are rejected at the database
-- level. No bank reconciliation object is modified, so matching of posted
-- manual_adjustment journals is unaffected.

create or replace function public.guard_invoice_charge_type_rc1_scope()
returns trigger
language plpgsql
set search_path to public, pg_temp
as $$
begin
  if upper(coalesce(btrim(new.charge_type), '')) = 'LATE_FEE' then
    raise exception 'RC1_LATE_FEE_FAIL_CLOSED: LATE_FEE charges have no approved canonical mapping in RC1 (ADR-0017 Decision C / DP-4, decision D09) and are rejected at the database level.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

alter function public.guard_invoice_charge_type_rc1_scope() owner to postgres;
grant execute on function public.guard_invoice_charge_type_rc1_scope() to service_role;
revoke all on function public.guard_invoice_charge_type_rc1_scope() from public, anon, authenticated;

comment on function public.guard_invoice_charge_type_rc1_scope() is
  'RC1 fail-closed guard (D09/DP-4/ADR-0017 C): rejects invoice charge_type LATE_FEE on insert and update until the governed accounting mapping is approved.';

create trigger trg_guard_invoice_charge_type_rc1_scope
before insert or update on public.invoices
for each row
execute function public.guard_invoice_charge_type_rc1_scope();

create or replace function public.guard_automation_job_rc1_scope()
returns trigger
language plpgsql
set search_path to public, pg_temp
as $$
begin
  if upper(coalesce(btrim(new.job_type), '')) = 'LATE_FEE' then
    raise exception 'RC1_LATE_FEE_JOB_FAIL_CLOSED: LATE_FEE automation jobs are disabled by default (decision D09) and rejected at the database level until the governed late-fee accounting mapping is approved.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

alter function public.guard_automation_job_rc1_scope() owner to postgres;
grant execute on function public.guard_automation_job_rc1_scope() to service_role;
revoke all on function public.guard_automation_job_rc1_scope() from public, anon, authenticated;

comment on function public.guard_automation_job_rc1_scope() is
  'RC1 fail-closed guard (D09): rejects automation job_type LATE_FEE on insert and update until the governed late-fee feature is approved and implemented.';

create trigger trg_guard_automation_job_rc1_scope
before insert or update on public.automation_jobs
for each row
execute function public.guard_automation_job_rc1_scope();

commit;
