-- Governance V1 — canonical six-role capability matrix.
--
-- Aligns public.role_has_app_permission(role, permission) with the governed
-- matrix in scripts/guardian/governance-contract.json.
--
--   * ADMIN remains dynamic: every catalog permission.
--   * MANAGER loses sensitive finance/admin: payments.create, receipts.void,
--     bank_reconciliation.match, owner settlements approve/pay, accruals
--     execute/reverse, invoices.generate, permission_requests.review.
--     MANAGER keeps office operations including financial.reports.view/export.
--   * ACCOUNTANT gains financial.payments.create; keeps reconciliation,
--     accruals and invoice generation; no user/company admin.
--   * OPERATIONS is operational only (maintenance, service providers,
--     communication, operational documents) — no finance mutations and no
--     properties/contracts write.
--   * USER minimal; VIEWER read-only.
--
-- Also hardens current_user_has_effective_app_permission so role-bound
-- (owner-only / sensitive / review) permissions cannot be conferred through a
-- per-user grant, and points record_invoice_payment_atomic at the governed
-- financial.payments.create permission instead of the broad is_admin_or_manager.
--
-- One atomic transaction. Forward-only.

begin;

create or replace function public.role_has_app_permission(p_role text, p_permission text)
returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select case upper(coalesce(p_role, ''))
    when 'ADMIN' then
      exists(select 1 from public.app_permission_catalog c where c.permission = p_permission)
    when 'MANAGER' then
      p_permission = any(array[
        'app.dashboard.view','maintenance.view','service_providers.view','service_providers.write',
        'cost_centers.manage','documents.write','owners.hub.view','owners.detail.view',
        'lands.view','leads.view','commissions.view','communication.view','automation.view',
        'auth.password.change','properties.write','contracts.write','expenses.view','expenses.write',
        'arrears.view','financial.deposits.view','financial.invoices.export',
        'financial.reports.view','financial.reports.export',
        'financial.bank_reconciliation.view','financial.owner_settlements.view'
      ]::text[])
    when 'ACCOUNTANT' then
      p_permission = any(array[
        'app.dashboard.view','audit.view','expenses.view','arrears.view',
        'financial.deposits.view','financial.invoices.generate','financial.invoices.export',
        'financial.payments.create','financial.reports.view','financial.reports.export',
        'financial.bank_reconciliation.view','financial.bank_reconciliation.match',
        'financial.owner_settlements.view',
        'financial.fixed_monthly_accruals.view','financial.fixed_monthly_accruals.execute',
        'financial.fixed_monthly_accruals.reverse','auth.password.change'
      ]::text[])
    when 'OPERATIONS' then
      p_permission = any(array[
        'app.dashboard.view','maintenance.view','service_providers.view','service_providers.write',
        'documents.write','owners.hub.view','owners.detail.view','lands.view','leads.view',
        'communication.view','automation.view','expenses.view','arrears.view','auth.password.change'
      ]::text[])
    when 'USER' then
      p_permission = any(array['app.dashboard.view','auth.password.change']::text[])
    when 'VIEWER' then
      p_permission = any(array[
        'app.dashboard.view','maintenance.view','service_providers.view','owners.hub.view',
        'owners.detail.view','lands.view','leads.view','commissions.view','communication.view',
        'automation.view','expenses.view','arrears.view','financial.deposits.view',
        'financial.reports.view','financial.owner_settlements.view',
        'financial.bank_reconciliation.view','auth.password.change'
      ]::text[])
    else false
  end
$$;

alter function public.role_has_app_permission(text, text) owner to postgres;

comment on function public.role_has_app_permission(text, text) is
  'Governance V1 canonical six-role capability matrix. Source of truth: scripts/guardian/governance-contract.json. ADMIN is dynamic (all catalog); other roles use explicit governed whitelists.';

-- Role-bound permissions may never be conferred by a per-user grant. They are
-- role-inherent: only ADMIN (bypassed above) or the governed role may hold
-- them. This prevents a USER/VIEWER accumulating grants into ADMIN-level
-- authority and keeps sensitive finance/review on role fences.
create or replace function public.current_user_has_effective_app_permission(p_permission text)
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_company uuid := public.require_company_id();
  v_role text := public.current_app_role();
  v_role_bound boolean;
begin
  if public.is_admin() then
    return true;
  end if;

  if public.role_has_app_permission(v_role, p_permission) then
    return true;
  end if;

  -- Owner-only / sensitive / review permissions are role-bound and ignore
  -- per-user grants. Mirrors governance-contract.json roleBound[].
  v_role_bound := p_permission = any(array[
    'users.manage','company.settings.manage','system.view','audit.view','integrity.view',
    'settings.manage','permission_requests.review','support.operations.view',
    'support.requests.triage','support.user_lookup.view',
    'financial.payments.create','financial.receipts.void','financial.bank_reconciliation.match',
    'financial.owner_settlements.approve','financial.owner_settlements.pay',
    'financial.fixed_monthly_accruals.execute','financial.fixed_monthly_accruals.reverse',
    'financial.invoices.generate'
  ]::text[]);

  if v_role_bound then
    return false;
  end if;

  return exists (
    select 1 from public.user_permission_grants g
    where g.company_id = v_company and g.user_id = auth.uid()
      and g.permission = p_permission and g.revoked_at is null
  );
end;
$$;

alter function public.current_user_has_effective_app_permission(text) owner to postgres;

-- record_invoice_payment_atomic must authorize against the governed
-- financial.payments.create permission (ADMIN + ACCOUNTANT) rather than the
-- broad is_admin_or_manager helper, which would let MANAGER record payments.
create or replace function public.record_invoice_payment_atomic(payload jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_result jsonb;
  v_receipt_id uuid;
  v_payment_id uuid;
  v_reference text := nullif(btrim(coalesce(payload->>'reference', '')), '');
begin
  if v_actor is null then
    raise exception 'Authentication is required to record invoice payments'
      using errcode = '42501';
  end if;
  if not public.current_user_has_effective_app_permission('financial.payments.create') then
    raise exception 'financial.payments.create is required to record invoice payments'
      using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  v_result := public.record_invoice_payment_atomic_engine(payload);
  v_receipt_id := nullif(v_result->>'receipt_id', '')::uuid;

  if v_receipt_id is not null then
    if v_reference is not null then
      update public.payments
         set reference_number = coalesce(nullif(btrim(reference_number), ''), v_reference),
             reference_no = coalesce(nullif(btrim(reference_no), ''), v_reference),
             updated_at = now()
       where company_id = v_company_id
         and deleted_at is null
         and (receipt_id = v_receipt_id or id = v_receipt_id);
    end if;

    select p.id
      into v_payment_id
    from public.payments p
    where p.company_id = v_company_id
      and p.deleted_at is null
      and (p.receipt_id = v_receipt_id or p.id = v_receipt_id)
    order by p.created_at desc nulls last, p.id
    limit 1;
  end if;

  if v_payment_id is null then
    raise exception 'PAYMENT_ROW_MISSING_AFTER_RECEIPT: receipt_id=%', v_receipt_id
      using errcode = 'P0002';
  end if;

  return v_result || jsonb_build_object('payment_id', v_payment_id);
end;
$$;

alter function public.record_invoice_payment_atomic(jsonb) owner to postgres;

comment on function public.record_invoice_payment_atomic(jsonb) is
  'Public collect RPC. Authorizes against governed financial.payments.create (ADMIN, ACCOUNTANT); delegates accounting to record_invoice_payment_atomic_engine.';

-- Ensure the financial report view permission exists in the catalog. It is a
-- governed read capability referenced by the role matrix but was previously
-- absent, which made ADMIN dynamically unable to hold it.
insert into public.app_permission_catalog (permission, label_ar, admin_only, requestable)
values ('financial.reports.view','عرض التقارير المالية',false,true)
on conflict (permission) do update
  set label_ar = excluded.label_ar,
      admin_only = excluded.admin_only,
      requestable = excluded.requestable;

-- Catalog completeness for the governed matrix. These read/operational
-- permissions are referenced by role_has_app_permission but were absent from
-- the seed catalog, which would make ADMIN dynamically unable to hold them.
insert into public.app_permission_catalog (permission, label_ar, admin_only, requestable) values
  ('support.operations.view','عرض عمليات الدعم',true,true),
  ('support.requests.triage','فرز طلبات الدعم',true,true),
  ('support.user_lookup.view','بحث مقنّع عن المستخدمين',true,true),
  ('financial.fixed_monthly_accruals.view','عرض الاستحقاقات اليومية',false,true),
  ('financial.fixed_monthly_accruals.execute','تنفيذ الاستحقاقات اليومية',false,true),
  ('financial.fixed_monthly_accruals.reverse','عكس الاستحقاقات اليومية',false,true),
  ('financial.payments.create','تسجيل التحصيلات',false,true),
  ('financial.receipts.void','إلغاء الإيصالات',true,true),
  ('financial.bank_reconciliation.view','عرض المطابقة البنكية',false,true),
  ('financial.bank_reconciliation.match','تنفيذ المطابقة البنكية',false,true),
  ('financial.owner_settlements.approve','اعتماد تسويات الملاك',true,true),
  ('financial.owner_settlements.pay','صرف تسويات الملاك',true,true),
  ('financial.invoices.generate','إنشاء الفواتير',false,true),
  ('system.view','عرض إعدادات النظام والحوكمة',true,true),
  ('integrity.view','عرض سلامة البيانات',true,true),
  ('users.manage','إدارة المستخدمين والأدوار',true,true),
  ('company.settings.manage','إدارة إعدادات الشركة',true,true),
  ('permission_requests.review','مراجعة طلبات الصلاحية',false,false),
  ('app.dashboard.view','عرض لوحة التحكم',false,false),
  ('arrears.view','عرض المتأخرات',false,true),
  ('auth.password.change','تغيير كلمة المرور',false,false),
  ('automation.view','عرض الأتمتة',false,true),
  ('commissions.view','عرض العمولات',false,true),
  ('communication.view','عرض التواصل والمتابعات',false,true),
  ('contracts.write','إضافة وتعديل العقود',false,true),
  ('cost_centers.manage','إدارة مراكز التكلفة',false,true),
  ('documents.write','رفع واستبدال وأرشفة المستندات',false,true),
  ('expenses.view','عرض المصروفات',false,true),
  ('expenses.write','إضافة وتعديل المصروفات',false,true),
  ('financial.deposits.view','عرض التأمينات',false,true),
  ('financial.invoices.export','تصدير الفواتير',false,true),
  ('financial.owner_settlements.view','عرض تسويات الملاك',false,true),
  ('financial.reports.export','تصدير التقارير المالية',false,true),
  ('lands.view','عرض الأراضي',false,true),
  ('leads.view','عرض العملاء المحتملين',false,true),
  ('maintenance.view','عرض الصيانة',false,true),
  ('owners.detail.view','عرض ملف المالك',false,true),
  ('owners.hub.view','عرض سجل الملاك',false,true),
  ('properties.write','إضافة وتعديل العقارات',false,true),
  ('service_providers.view','عرض مزودي الخدمة',false,true),
  ('service_providers.write','إضافة وتعديل وأرشفة مزودي الخدمة',false,true),
  ('settings.manage','إدارة الإعدادات القديمة',true,true),
  ('audit.view','عرض سجل التدقيق',true,true)
on conflict (permission) do update
  set label_ar = excluded.label_ar,
      admin_only = excluded.admin_only,
      requestable = excluded.requestable;

-- ---------------------------------------------------------------------------
-- Governed authorization at the public RPC entry points.
--
-- Sensitive finance RPCs now authorize against the governed permission
-- (current_user_has_effective_app_permission) rather than the broad
-- is_admin_or_manager helper, so the canonical role matrix is enforced.
-- The large engine bodies are recreated with only the authorization check
-- changed; internal _base / _engine functions remain browser-inaccessible.
-- ---------------------------------------------------------------------------


-- =
-- Governed RPC bodies (recreated with permission-based authorization)
-- =

CREATE OR REPLACE FUNCTION "public"."approve_receipt_void_atomic"("payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.current_company_id();
  v_void_request_id uuid := nullif(btrim(payload->>'void_request_id'), '')::uuid;
  v_execution_request_id text := nullif(btrim(payload->>'request_id'), '');
  v_request public.receipt_void_requests%rowtype;
  v_result jsonb;
  v_is_sole_admin_exception boolean := false;
begin
  if v_actor is null then
    raise exception 'Authentication is required to approve receipt VOID' using errcode = '42501';
  end if;
  if not public.current_user_has_effective_app_permission('financial.receipts.void') then
    raise exception 'financial.receipts.void is required to approve receipt VOID' using errcode = '42501';
  end if;

  if v_company_id is null then
    raise exception 'Company context is required to approve receipt VOID.'
      using errcode = '42501';
  end if;

  if v_void_request_id is null or v_execution_request_id is null then
    raise exception 'void_request_id and request_id are required.'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('receipt_void_approval:' || v_company_id::text || ':' || v_void_request_id::text, 0)
  );

  select q.*
    into v_request
  from public.receipt_void_requests q
  where q.id = v_void_request_id
    and q.company_id = v_company_id
  for update;

  if v_request.id is null then
    raise exception 'Receipt VOID request was not found in the active company.'
      using errcode = 'P0002';
  end if;

  if v_request.status = 'EXECUTED' then
    if v_request.execution_request_id <> v_execution_request_id
       or v_request.result_payload is null then
      raise exception 'RECEIPT_VOID_REQUEST_ALREADY_EXECUTED'
        using errcode = '22023';
    end if;
    return v_request.result_payload || jsonb_build_object('idempotent', true);
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'Only PENDING receipt VOID requests can be approved.'
      using errcode = '22023';
  end if;

  v_is_sole_admin_exception := (v_request.requested_by = v_actor);

  if v_is_sole_admin_exception
     and not public.wp01_is_sole_admin_allowed(v_company_id) then
    raise exception 'MAKER_CHECKER_SELF_APPROVAL_DENIED: receipt VOID requester cannot approve the same request.'
      using errcode = '42501';
  end if;

  v_result := public.execute_receipt_void_internal(jsonb_build_object(
    'receipt_id', v_request.receipt_id,
    'reason', v_request.reason,
    'request_id', 'void-approved:' || v_execution_request_id
  ));

  v_result := v_result || jsonb_build_object(
    'void_request_id', v_request.id,
    'void_request_status', 'EXECUTED',
    'requested_by', v_request.requested_by,
    'approved_by', v_actor,
    'approval_request_id', v_execution_request_id,
    'is_sole_admin_exception', v_is_sole_admin_exception
  );

  update public.receipt_void_requests
     set status = 'EXECUTED',
         reviewed_by = v_actor,
         reviewed_at = now(),
         execution_request_id = v_execution_request_id,
         reversal_batch_id = nullif(v_result->>'journal_reversal_batch_id', '')::uuid,
         result_payload = v_result,
         is_sole_admin_exception = v_is_sole_admin_exception,
         updated_at = now()
   where id = v_request.id;

  -- Preserve the canonical audit action/entity contract used by release
  -- evidence and operational audit queries. The sole-admin flag is additive.
  insert into public.audit_log (
    id, ts, user_id, action, entity, entity_id, note, "table", details,
    old_value, new_value, action_timestamp, created_at, updated_at
  ) values (
    gen_random_uuid()::text,
    extract(epoch from now())::bigint,
    v_actor::text,
    'APPROVE_RECEIPT_VOID',
    'receipt_void_request',
    v_request.id::text,
    'Receipt VOID separately approved and executed through the canonical reversal engine.',
    'receipt_void_requests',
    jsonb_build_object(
      'company_id', v_company_id,
      'receipt_id', v_request.receipt_id,
      'reason', v_request.reason,
      'requested_by', v_request.requested_by,
      'approved_by', v_actor,
      'approval_request_id', v_execution_request_id,
      'journal_reversal_batch_id', v_result->>'journal_reversal_batch_id',
      'is_sole_admin_exception', v_is_sole_admin_exception
    )::text,
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object(
      'status', 'EXECUTED',
      'requested_by', v_request.requested_by,
      'approved_by', v_actor,
      'is_sole_admin_exception', v_is_sole_admin_exception
    ),
    now(), now(), now()
  );

  return v_result || jsonb_build_object('idempotent', false);
end;
$$;



alter function public.approve_receipt_void_atomic(jsonb) owner to postgres;

CREATE OR REPLACE FUNCTION "public"."process_bank_reconciliation_match_atomic"("payload" "jsonb") RETURNS "public"."bank_reconciliation_matches"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_company_id uuid;
  v_statement_line_id uuid := nullif(payload->>'statement_line_id', '')::uuid;
  v_matched_entity_type text := nullif(payload->>'matched_entity_type', '');
  v_matched_entity_id text := nullif(payload->>'matched_entity_id', '');
  v_matched_amount numeric := nullif(payload->>'matched_amount', '')::numeric;
  v_notes text := nullif(payload->>'notes', '');
  v_line public.bank_statement_lines%rowtype;
  v_match public.bank_reconciliation_matches%rowtype;
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;

  if not public.current_user_has_effective_app_permission('financial.bank_reconciliation.match') then
    raise exception 'financial.bank_reconciliation.match is required' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();

  if v_statement_line_id is null then
    raise exception 'statement_line_id is required.' using errcode = '22023';
  end if;
  if v_matched_entity_type not in ('payment', 'receipt', 'expense', 'manual_adjustment') then
    raise exception 'Invalid matched_entity_type.' using errcode = '22023';
  end if;
  if v_matched_entity_id is null then
    raise exception 'matched_entity_id is required.' using errcode = '22023';
  end if;
  if v_matched_amount is null or v_matched_amount = 0 then
    raise exception 'matched_amount must be non-zero.' using errcode = '22023';
  end if;

  select * into v_line
  from public.bank_statement_lines
  where id = v_statement_line_id
    and company_id = v_company_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Bank statement line was not found.' using errcode = 'P0002';
  end if;
  if lower(coalesce(v_line.status, '')) <> 'unmatched' then
    raise exception 'Bank statement line is already processed.' using errcode = '23514';
  end if;

  if v_matched_amount <> v_line.amount then
    raise exception 'matched_amount must equal the bank statement line amount.' using errcode = '23514';
  end if;

  if v_matched_entity_type = 'payment' then
    if not exists (
      select 1 from public.payments p
      where p.id::text = v_matched_entity_id
        and p.company_id = v_company_id
        and p.deleted_at is null
    ) then
      raise exception 'Matched payment was not found in the active company.' using errcode = 'P0002';
    end if;
  elsif v_matched_entity_type = 'receipt' then
    if not exists (
      select 1 from public.receipts r
      where r.id::text = v_matched_entity_id
        and r.company_id = v_company_id
        and r.deleted_at is null
    ) then
      raise exception 'Matched receipt was not found in the active company.' using errcode = 'P0002';
    end if;
  elsif v_matched_entity_type = 'expense' then
    if not exists (
      select 1 from public.expenses e
      where e.id::text = v_matched_entity_id
        and e.company_id = v_company_id
        and e.deleted_at is null
    ) then
      raise exception 'Matched expense was not found in the active company.' using errcode = 'P0002';
    end if;
  end if;

  insert into public.bank_reconciliation_matches (
    statement_line_id,
    matched_entity_type,
    matched_entity_id,
    matched_amount,
    notes,
    matched_by,
    company_id
  ) values (
    v_statement_line_id,
    v_matched_entity_type,
    v_matched_entity_id,
    v_matched_amount,
    v_notes,
    auth.uid(),
    v_company_id
  )
  returning * into v_match;

  update public.bank_statement_lines
  set status = 'matched', updated_at = now()
  where id = v_statement_line_id
    and company_id = v_company_id;

  insert into public.audit_log (
    id, user_id, action, entity, entity_id, note, "table",
    old_value, new_value, action_timestamp, created_at, updated_at,
    company_id
  ) values (
    gen_random_uuid()::text,
    auth.uid(),
    'PROCESS_BANK_RECONCILIATION_MATCH_ATOMIC',
    'bank_reconciliation_match',
    v_match.id::text,
    'Bank statement line matched atomically through RPC.',
    'bank_reconciliation_matches',
    to_jsonb(v_line),
    jsonb_build_object('match', to_jsonb(v_match), 'statement_line_status', 'matched'),
    now(), now(), now(),
    v_company_id
  );

  return v_match;
end;
$$;



alter function public.process_bank_reconciliation_match_atomic(jsonb) owner to postgres;

CREATE OR REPLACE FUNCTION "public"."execute_fixed_monthly_accruals_atomic"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id', '')), '');
  v_date_from date := nullif(p_payload->>'date_from', '')::date;
  v_date_to date := nullif(p_payload->>'date_to', '')::date;
  v_version_id uuid := nullif(p_payload->>'agreement_version_id', '')::uuid;
  v_company_today date;
  v_fingerprint text;
  v_cached jsonb;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if not public.current_user_has_effective_app_permission('financial.fixed_monthly_accruals.execute') then
    raise exception 'financial.fixed_monthly_accruals.execute is required' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if not public.is_company_member(v_company_id, v_actor) then
    raise exception 'FIXED_MONTHLY_ACTIVE_COMPANY_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;

  if p_payload ?| array['company_id','monthly_amount','commission_value','net_amount','tax_amount','tax_rate','gross_amount','lines'] then
    raise exception 'FIXED_MONTHLY_CLIENT_FINANCIAL_INPUT_FORBIDDEN' using errcode = '22023';
  end if;
  if v_request_id is null or length(v_request_id) > 200 then
    raise exception 'FIXED_MONTHLY_REQUEST_ID_REQUIRED' using errcode = '22023';
  end if;
  if v_date_from is null or v_date_to is null then
    raise exception 'FIXED_MONTHLY_RUN_RANGE_REQUIRED' using errcode = '22023';
  end if;

  select (now() at time zone c.timezone)::date into v_company_today
  from public.companies c
  where c.id = v_company_id and c.is_active;
  if v_company_today is null then
    raise exception 'FIXED_MONTHLY_COMPANY_NOT_FOUND_OR_INACTIVE' using errcode = '42501';
  end if;
  if v_date_to > v_company_today then
    raise exception 'FIXED_MONTHLY_FUTURE_ACCRUAL_FORBIDDEN' using errcode = '22023';
  end if;

  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'date_from', v_date_from,
    'date_to', v_date_to,
    'agreement_version_id', v_version_id
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'execute_fixed_monthly_accruals_atomic:' || v_company_id::text || ':' || v_request_id,
    0
  ));

  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = 'execute_fixed_monthly_accruals_atomic:' || v_company_id::text
    and request_id = v_request_id
  for update;

  if v_cached is not null then
    if v_cached->>'_request_fingerprint' is distinct from v_fingerprint
       or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode = '22023';
    end if;
    return v_cached->'response';
  end if;

  v_result := public.gl_run_fixed_monthly_accruals(
    v_company_id,
    v_date_from,
    v_date_to,
    v_version_id,
    v_actor
  );

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid()::text,
    extract(epoch from now())::bigint,
    v_actor,
    v_actor::text,
    'EXECUTE',
    'fixed_monthly_daily_accrual',
    v_request_id,
    'Bounded FIXED_MONTHLY daily accrual run.',
    'fixed_monthly_daily_accruals',
    jsonb_build_object(
      'company_id', v_company_id,
      'date_from', v_date_from,
      'date_to', v_date_to,
      'agreement_version_id', v_version_id,
      'result', v_result
    )::text,
    now()
  );

  insert into public.financial_operation_idempotency(operation_name, request_id, response_payload)
  values (
    'execute_fixed_monthly_accruals_atomic:' || v_company_id::text,
    v_request_id,
    jsonb_build_object('_request_fingerprint', v_fingerprint, 'response', v_result)
  );

  return v_result;
end;
$$;



alter function public.execute_fixed_monthly_accruals_atomic(jsonb) owner to postgres;


create or replace function public.approve_owner_settlement_atomic(p_payload jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_id text := nullif(p_payload->>'settlement_id', '');
  v_status text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if not public.current_user_has_effective_app_permission('financial.owner_settlements.approve') then
    raise exception 'financial.owner_settlements.approve is required to approve owner settlements' using errcode = '42501';
  end if;
  v_company_id := public.current_company_id();
  if v_id is not null and v_company_id is not null then
    select s.status into v_status from public.owner_settlements s
     where s.id::text = v_id and s.company_id = v_company_id;
    if v_status = 'DRAFT' then
      perform public.assert_owner_settlement_totals_fresh(v_id);
    end if;
  end if;
  v_result := public.approve_owner_settlement_atomic_s02_base(p_payload);
  if not coalesce((v_result->>'idempotent')::boolean, false) then
    perform public.assert_owner_settlement_totals_fresh(v_result->>'settlement_id');
  end if;
  return v_result;
end;
$$;
alter function public.approve_owner_settlement_atomic(jsonb) owner to postgres;

create or replace function public.pay_owner_settlement_atomic(p_payload jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_id text := nullif(p_payload->>'settlement_id', '');
  v_status text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if not public.current_user_has_effective_app_permission('financial.owner_settlements.pay') then
    raise exception 'financial.owner_settlements.pay is required to pay owner settlements' using errcode = '42501';
  end if;
  v_company_id := public.current_company_id();
  if v_id is not null and v_company_id is not null then
    select s.status into v_status from public.owner_settlements s
     where s.id::text = v_id and s.company_id = v_company_id;
    if v_status = 'APPROVED' then
      perform public.assert_owner_settlement_totals_fresh(v_id);
    end if;
  end if;
  v_result := public.pay_owner_settlement_atomic_s02_base(p_payload);
  if not coalesce((v_result->>'idempotent')::boolean, false) then
    perform public.assert_owner_settlement_totals_fresh(v_result->>'settlement_id');
  end if;
  return v_result;
end;
$$;
alter function public.pay_owner_settlement_atomic(jsonb) owner to postgres;


-- request_permission: notification recipients must match the governed reviewer
-- set (ADMIN only in Governance V1). Recreate the function with the recipient
-- role filter changed from ('ADMIN','MANAGER') to ('ADMIN').
create or replace function public.request_permission(
  p_permission text,
  p_resource_route text default null::text,
  p_reason text default ''::text
) returns public.permission_requests
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_company uuid := public.require_company_id();
  v_permission text := btrim(coalesce(p_permission, ''));
  v_route text := nullif(btrim(coalesce(p_resource_route, '')), '');
  v_role text := public.current_app_role();
  result public.permission_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists(select 1 from public.app_permission_catalog c where c.permission = v_permission) then
    raise exception 'Unknown permission' using errcode = '22023';
  end if;
  if public.role_has_app_permission(v_role, v_permission)
     or exists(select 1 from public.user_permission_grants g where g.company_id = v_company and g.user_id = auth.uid() and g.permission = v_permission and g.revoked_at is null) then
    raise exception 'Permission is already granted' using errcode = '23505';
  end if;
  if not exists(select 1 from public.app_permission_catalog c where c.permission = v_permission and c.requestable) then
    raise exception 'Permission is not requestable' using errcode = '22023';
  end if;

  select * into result from public.permission_requests pr
  where pr.company_id = v_company and pr.requester_user_id = auth.uid()
    and pr.permission = v_permission and coalesce(pr.resource_route, '') = coalesce(v_route, '')
    and pr.status = 'PENDING'
  order by pr.created_at desc limit 1;
  if result.id is not null then return result; end if;

  insert into public.permission_requests(company_id, requester_user_id, permission, resource_route, reason)
  values (v_company, auth.uid(), v_permission, v_route, btrim(coalesce(p_reason, '')))
  returning * into result;

  insert into public.app_notifications(
    id, company_id, recipient_user_id, created_at, is_read, role, type, title, message,
    link, source_type, source_id, notification_type
  )
  select result.id::text || ':' || u.id::text || ':permission', v_company, u.id, now(), false, u.role::text,
    'permission_request', 'طلب صلاحية جديد',
    coalesce(requester.full_name, requester.name, requester.email, 'مستخدم') || ' طلب ' || catalog.label_ar,
    '/settings?section=users-permissions&sub=permission-requests', 'permission_request', result.id, 'permission_request'
  from public.users u
  join public.company_members cm on cm.user_id = u.id and cm.company_id = v_company and cm.is_active
  cross join public.app_permission_catalog catalog
  left join public.users requester on requester.id = auth.uid()
  where u.deleted_at is null and u.is_active and u.status::text = 'ACTIVE'
    and u.role::text in ('ADMIN') and catalog.permission = v_permission
  on conflict (id) do nothing;

  insert into public.audit_log(id, ts, user_id, action, entity, entity_id, note, "table", details, created_at)
  select gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(), 'PERMISSION_REQUESTED',
    'permission_request', result.id::text, 'طلب صلاحية جديد', 'permission_requests',
    jsonb_build_object('company_id', result.company_id, 'permission', result.permission, 'resource_route', result.resource_route)::text, now()
  where not exists(select 1 from public.audit_log a where a.action = 'PERMISSION_REQUESTED' and a.entity_id = result.id::text);
  return result;
end;
$$;

alter function public.request_permission(text, text, text) owner to postgres;

-- Restore column-level UPDATE on app_notifications.is_read for authenticated.
-- The ACL-lock migration revoked all table-level writes; the baseline column
-- GRANT that lets users mark their own notifications read must be reinstated.
grant update(is_read) on table public.app_notifications to authenticated;

commit;
