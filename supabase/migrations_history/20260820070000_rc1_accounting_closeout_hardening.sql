-- ============================================================================
-- RC1 accounting closeout hardening
-- ============================================================================
-- Forward-only correction for independent review findings after 00600:
--   * 2100 reconciliation must include management-fee VAT and reversals;
--   * Owner Funds Payable (2000) must never be driven negative by fee events;
--   * owner-funds cutover approval must reject a stale opening baseline;
--   * fee-tax create/approve RPCs must be request/target-bound idempotent;
--   * NON_TAXABLE / VAT_ZERO treatments must carry an exact zero rate.
--
-- No posted journal, invoice, credit, owner balance, or historical tax snapshot
-- is updated or deleted by this migration.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Fee-tax semantic coherence.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'company_fee_tax_treatments_zero_code_rate_chk'
       and conrelid = 'public.company_fee_tax_treatments'::regclass
  ) then
    alter table public.company_fee_tax_treatments
      add constraint company_fee_tax_treatments_zero_code_rate_chk
      check (
        tax_code not in ('NON_TAXABLE','VAT_ZERO')
        or tax_rate = 0.000
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Request-bound, payload-bound fee-tax draft creation.
-- ---------------------------------------------------------------------------
create or replace function public.create_fee_tax_treatment_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.require_company_id();
  v_kind text := nullif(btrim(p_payload->>'fee_kind'),'');
  v_tax_code text := nullif(btrim(p_payload->>'tax_code'),'');
  v_tax_rate numeric := nullif(p_payload->>'tax_rate','')::numeric;
  v_from date := nullif(p_payload->>'effective_from','')::date;
  v_to date := nullif(p_payload->>'effective_to','')::date;
  v_request_id text := nullif(btrim(p_payload->>'request_id'),'');
  v_version integer;
  v_id uuid := gen_random_uuid();
  v_fp text;
  v_cached jsonb;
  v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'FEE_TAX_TREATMENT_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_payload ? 'company_id'
     or v_kind not in ('RATE_MANAGEMENT_FEE','FIXED_MONTHLY')
     or v_tax_code is null
     or v_tax_rate is null
     or v_tax_rate < 0
     or v_tax_rate > 100
     or v_from is null
     or v_request_id is null
     or (v_to is not null and v_to < v_from) then
    raise exception 'FEE_TAX_TREATMENT_INPUT_REQUIRED' using errcode='22023';
  end if;
  if v_tax_code in ('NON_TAXABLE','VAT_ZERO') and v_tax_rate <> 0 then
    raise exception 'FEE_TAX_TREATMENT_ZERO_CODE_RATE_INVALID: % must use 0.000.', v_tax_code
      using errcode='23514';
  end if;
  if not exists(
    select 1 from public.tax_code_catalog c
     where c.code = v_tax_code and c.is_active
  ) then
    raise exception 'FEE_TAX_TREATMENT_CODE_FORBIDDEN' using errcode='42501';
  end if;

  v_fp := encode(sha256(convert_to(jsonb_build_object(
    'fee_kind', v_kind,
    'tax_code', v_tax_code,
    'tax_rate', round(v_tax_rate, 3),
    'effective_from', v_from,
    'effective_to', v_to
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'create_fee_tax_treatment:' || v_company_id::text || ':' || v_request_id, 0
  ));

  select response_payload into v_cached
    from public.financial_operation_idempotency
   where operation_name = 'create_fee_tax_treatment:' || v_company_id::text
     and request_id = v_request_id
   for update;

  if v_cached is not null then
    if v_cached->>'_request_fingerprint' is distinct from v_fp
       or not (v_cached ? 'response') then
      raise exception 'FEE_TAX_TREATMENT_IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode='22023';
    end if;
    return v_cached->'response';
  end if;

  -- Serialize version allocation independently from request-id serialization.
  perform pg_advisory_xact_lock(hashtextextended(
    'fee_tax_treatment_version:' || v_company_id::text || ':' || v_kind, 0
  ));

  select coalesce(max(version_no),0)+1
    into v_version
    from public.company_fee_tax_treatments
   where company_id = v_company_id
     and fee_kind = v_kind;

  insert into public.company_fee_tax_treatments(
    id, company_id, fee_kind, version_no, tax_code, tax_rate,
    effective_from, effective_to, status, created_by
  ) values (
    v_id, v_company_id, v_kind, v_version, v_tax_code, round(v_tax_rate,3),
    v_from, v_to, 'DRAFT', v_actor
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'treatment_id', v_id,
    'version_no', v_version,
    'status', 'DRAFT',
    'request_id', v_request_id
  );

  insert into public.financial_operation_idempotency(operation_name, request_id, response_payload)
  values (
    'create_fee_tax_treatment:' || v_company_id::text,
    v_request_id,
    jsonb_build_object('_request_fingerprint', v_fp, 'response', v_result)
  );

  return v_result;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Target-bound fee-tax approval idempotency.
-- ---------------------------------------------------------------------------
create or replace function public.approve_fee_tax_treatment_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.require_company_id();
  v_id uuid := nullif(p_payload->>'treatment_id','')::uuid;
  v_request_id text := nullif(btrim(p_payload->>'request_id'),'');
  v_t public.company_fee_tax_treatments%rowtype;
  v_fp text;
  v_cached jsonb;
  v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'FEE_TAX_TREATMENT_APPROVER_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_payload ? 'company_id' or v_id is null or v_request_id is null then
    raise exception 'FEE_TAX_TREATMENT_APPROVAL_INPUT_REQUIRED' using errcode='22023';
  end if;

  v_fp := encode(sha256(convert_to(jsonb_build_object(
    'treatment_id', v_id::text
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'approve_fee_tax_treatment:' || v_company_id::text || ':' || v_request_id, 0
  ));

  select response_payload into v_cached
    from public.financial_operation_idempotency
   where operation_name = 'approve_fee_tax_treatment:' || v_company_id::text
     and request_id = v_request_id
   for update;

  if v_cached is not null then
    if v_cached->>'_request_fingerprint' is distinct from v_fp
       or v_cached->>'_target' is distinct from v_id::text
       or not (v_cached ? 'response') then
      raise exception 'FEE_TAX_TREATMENT_APPROVAL_IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST'
        using errcode='22023';
    end if;
    return v_cached->'response';
  end if;

  select * into v_t
    from public.company_fee_tax_treatments
   where id = v_id
     and company_id = v_company_id
   for update;
  if not found then
    raise exception 'FEE_TAX_TREATMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'fee_tax_treatment_approve:' || v_company_id::text || ':' || v_t.fee_kind, 0
  ));

  if v_t.tax_code in ('NON_TAXABLE','VAT_ZERO') and v_t.tax_rate <> 0 then
    raise exception 'FEE_TAX_TREATMENT_ZERO_CODE_RATE_INVALID: % must use 0.000.', v_t.tax_code
      using errcode='23514';
  end if;

  if v_t.status = 'ACTIVE' then
    v_result := jsonb_build_object(
      'success', true,
      'idempotent', true,
      'already_active', true,
      'treatment_id', v_id,
      'status', 'ACTIVE'
    );
  else
    if v_t.status <> 'DRAFT' or v_t.created_by = v_actor then
      raise exception 'FEE_TAX_TREATMENT_MAKER_CHECKER_REQUIRED' using errcode='42501';
    end if;

    update public.company_fee_tax_treatments
       set status = 'SUPERSEDED',
           updated_at = now(),
           effective_to = least(coalesce(effective_to, v_t.effective_from - 1), v_t.effective_from - 1)
     where company_id = v_company_id
       and fee_kind = v_t.fee_kind
       and status = 'ACTIVE'
       and effective_from < v_t.effective_from;

    update public.company_fee_tax_treatments
       set status = 'ACTIVE',
           approved_by = v_actor,
           approved_at = now(),
           updated_at = now()
     where id = v_id
       and company_id = v_company_id;

    v_result := jsonb_build_object(
      'success', true,
      'idempotent', false,
      'treatment_id', v_id,
      'status', 'ACTIVE'
    );
  end if;

  insert into public.financial_operation_idempotency(operation_name, request_id, response_payload)
  values (
    'approve_fee_tax_treatment:' || v_company_id::text,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_fp,
      '_target', v_id::text,
      'response', v_result
    )
  );

  return v_result;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Stale-safe owner-funds cutover approval.
--    Recompute the exact stored baseline immediately before approval. Posted
--    history is immutable, so balance + line-count fingerprint changes expose
--    any late/reversal posting that occurred after the DRAFT baseline.
-- ---------------------------------------------------------------------------
create or replace function public.approve_owner_funds_cutover_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.require_company_id();
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_cutover public.owner_funds_event_cutovers%rowtype;
  v_balance numeric;
  v_count bigint;
  v_fingerprint text;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'OWNER_FUNDS_CUTOVER_APPROVER_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_payload ? 'company_id' or v_request_id is null then
    raise exception 'OWNER_FUNDS_CUTOVER_APPROVAL_REQUEST_REQUIRED' using errcode='22023';
  end if;

  select * into v_cutover
    from public.owner_funds_event_cutovers
   where company_id = v_company_id
   for update;
  if not found then
    raise exception 'OWNER_FUNDS_CUTOVER_NOT_FOUND' using errcode='P0002';
  end if;

  if v_cutover.status = 'APPROVED' then
    if v_cutover.approval_request_id <> v_request_id then
      raise exception 'OWNER_FUNDS_CUTOVER_ALREADY_APPROVED' using errcode='22023';
    end if;
    return jsonb_build_object('success', true, 'idempotent', true, 'status', 'APPROVED');
  end if;

  if v_cutover.status <> 'DRAFT' or v_cutover.created_by = v_actor then
    raise exception 'OWNER_FUNDS_CUTOVER_MAKER_CHECKER_REQUIRED' using errcode='42501';
  end if;
  if not exists (
    select 1
      from public.s08_frozen_reviews r
     where r.id = v_cutover.s08_review_id
       and r.company_id = v_company_id
       and r.reviewer_decision = 'APPROVED'
  ) then
    raise exception 'OWNER_FUNDS_CUTOVER_S08_APPROVAL_REQUIRED' using errcode='42501';
  end if;

  select public.wp05_gl_balance(v_company_id, '2000', v_cutover.cutover_date),
         public.wp05_gl_line_count(v_company_id, '2000', v_cutover.cutover_date)
    into v_balance, v_count;

  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'company_id', v_company_id,
    'cutover_date', v_cutover.cutover_date,
    'opening_balance', public.wp05_round_omr(v_balance),
    'gl_line_count', v_count,
    's08_review_id', v_cutover.s08_review_id
  )::text, 'UTF8')), 'hex');

  if public.wp05_round_omr(v_balance) is distinct from v_cutover.opening_balance
     or v_count is distinct from v_cutover.gl_line_count
     or v_fingerprint is distinct from v_cutover.source_fingerprint then
    raise exception 'OWNER_FUNDS_CUTOVER_STALE_REVIEW_REQUIRED: 2000 changed after the draft baseline; create a fresh S08-backed cutover.'
      using errcode='23514';
  end if;

  update public.owner_funds_event_cutovers
     set status = 'APPROVED',
         approved_by = v_actor,
         approved_at = now(),
         approval_request_id = v_request_id
   where company_id = v_company_id;

  return jsonb_build_object('success', true, 'idempotent', false, 'status', 'APPROVED');
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Owner-funds solvency guard.
--    2000 is a payable, never the place to encode an owner receivable.
--    For management fees we additionally require that the invoice-specific
--    forward event position cannot go negative, preventing cross-owner subsidy.
-- ---------------------------------------------------------------------------
create or replace function public.assert_owner_funds_event_solvency(
  p_company_id uuid,
  p_invoice_id uuid,
  p_source_type text,
  p_amount_delta numeric,
  p_effective_date date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_gl_2000 numeric;
  v_invoice_position numeric;
begin
  if p_company_id is null or p_effective_date is null or p_amount_delta is null then
    raise exception 'OWNER_FUNDS_SOLVENCY_INPUT_REQUIRED' using errcode='22023';
  end if;

  -- The business RPC posts the canonical batch before appending the matching
  -- owner_funds_event in the same transaction. Therefore this read includes the
  -- proposed GL effect and the transaction aborts atomically if 2000 is debit.
  v_gl_2000 := public.wp05_gl_balance(p_company_id, '2000', p_effective_date);
  if v_gl_2000 < -0.001 then
    raise exception 'OWNER_FUNDS_CONTROL_NEGATIVE: account 2000 would become a debit balance %. Use 1300 for an approved owner receivable instead.', v_gl_2000
      using errcode='23514';
  end if;

  if p_source_type = 'MANAGEMENT_FEE'
     and p_invoice_id is not null
     and p_amount_delta < 0 then
    select public.wp05_round_omr(coalesce(sum(e.amount_delta),0) + p_amount_delta)
      into v_invoice_position
      from public.owner_funds_events e
     where e.company_id = p_company_id
       and e.invoice_id = p_invoice_id
       and e.effective_date <= p_effective_date;

    if coalesce(v_invoice_position,0) < -0.001 then
      raise exception 'OWNER_FUNDS_INVOICE_BALANCE_INSUFFICIENT_FOR_FEE: fee gross exceeds owner funds attributable to this invoice.'
        using errcode='23514';
    end if;
  end if;
end;
$function$;

create or replace function public.guard_owner_funds_event_cutover()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  perform public.assert_owner_funds_event_cutover(
    new.company_id,
    new.effective_date,
    new.journal_batch_id
  );
  perform public.assert_owner_funds_event_solvency(
    new.company_id,
    new.invoice_id,
    new.source_type,
    new.amount_delta,
    new.effective_date
  );
  return new;
end;
$function$;

-- Existing trg_owner_funds_event_cutover already calls this function; CREATE OR
-- REPLACE changes the trigger behavior without rewriting any existing event.

-- ---------------------------------------------------------------------------
-- 6. Complete RC1 2100 operational basis.
--    Rent VAT, RATE management-fee VAT and FIXED_MONTHLY fee VAT are distinct
--    source lineages. VOID/reversal records remove the economic effect without
--    mutating their immutable snapshots.
-- ---------------------------------------------------------------------------
create or replace function public.rc1_owner_agency_vat_payable_balance(
  p_company_id uuid,
  p_as_of date default current_date
)
returns table (balance numeric, cnt bigint)
language plpgsql
stable
set search_path = public, pg_temp
as $function$
declare
  v_office numeric := 0;
  v_owner numeric := 0;
  v_rate_fee numeric := 0;
  v_fixed_fee numeric := 0;
  v_office_count bigint := 0;
  v_owner_count bigint := 0;
  v_rate_fee_count bigint := 0;
  v_fixed_fee_count bigint := 0;
begin
  if p_company_id is null then
    raise exception 'RC1_VAT_SUBLEDGER_COMPANY_REQUIRED' using errcode='22023';
  end if;

  -- OFFICE_IS_CREDITOR rent VAT is recognized on invoice issue and reduced by
  -- active credits using the original immutable invoice tax lineage.
  select
    public.wp05_round_omr(coalesce(sum(i.tax_amount - coalesce(c.credit_tax, 0)), 0)),
    count(*) filter (where abs(i.tax_amount - coalesce(c.credit_tax, 0)) > 0.0005)::bigint
  into v_office, v_office_count
  from public.invoices i
  left join lateral (
    select coalesce(sum(ic.tax_amount), 0) as credit_tax
      from public.invoice_credits ic
     where ic.company_id = i.company_id
       and ic.invoice_id = i.id
       and ic.status = 'POSTED'
  ) c on true
  where i.company_id = p_company_id
    and i.invoice_accounting_classification = 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS'
    and i.document_status = 'POSTED'
    and i.issue_date <= p_as_of;

  -- OWNER_IS_CREDITOR rent VAT is recognized on an active collection only.
  select
    public.wp05_round_omr(coalesce(sum(pta.tax_amount), 0)),
    count(*) filter (where abs(pta.tax_amount) > 0.0005)::bigint
  into v_owner, v_owner_count
  from public.invoice_payment_tax_allocations pta
  join public.invoices i
    on i.id = pta.invoice_id
   and i.company_id = pta.company_id
  join public.receipts r
    on r.id = pta.receipt_id
   and r.company_id = pta.company_id
  where pta.company_id = p_company_id
    and i.invoice_accounting_classification = 'OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL'
    and upper(coalesce(r.status, '')) = 'POSTED'
    and r.deleted_at is null
    and r.date_time::date <= p_as_of;

  -- RATE management-fee VAT follows its immutable fee snapshot. A governed
  -- receipt VOID excludes the snapshot economically while preserving history.
  select
    public.wp05_round_omr(coalesce(sum(s.tax_amount),0)),
    count(*) filter (where abs(s.tax_amount) > 0.0005)::bigint
  into v_rate_fee, v_rate_fee_count
  from public.management_fee_tax_snapshots s
  join public.receipts r
    on r.id = s.receipt_id
   and r.company_id = s.company_id
  where s.company_id = p_company_id
    and s.effective_date <= p_as_of
    and upper(coalesce(r.status,'')) = 'POSTED'
    and r.deleted_at is null;

  -- FIXED_MONTHLY VAT is recognized on its economic day. Its append-only
  -- reversal relation removes the original economic effect from the basis.
  select
    public.wp05_round_omr(coalesce(sum(a.tax_amount),0)),
    count(*) filter (where abs(a.tax_amount) > 0.0005)::bigint
  into v_fixed_fee, v_fixed_fee_count
  from public.fixed_monthly_daily_accruals a
  left join public.fixed_monthly_daily_accrual_reversals rev
    on rev.accrual_id = a.id
   and rev.company_id = a.company_id
  where a.company_id = p_company_id
    and a.accrual_date <= p_as_of
    and a.journal_batch_id is not null
    and rev.id is null;

  return query
  select
    public.wp05_round_omr(v_office + v_owner + v_rate_fee + v_fixed_fee),
    coalesce(v_office_count,0)
      + coalesce(v_owner_count,0)
      + coalesce(v_rate_fee_count,0)
      + coalesce(v_fixed_fee_count,0);
end;
$function$;

comment on function public.rc1_owner_agency_vat_payable_balance(uuid,date) is
  'RC1 2100 operational basis: owner-agency rent VAT + active RATE fee VAT + unreversed FIXED_MONTHLY fee VAT, all from immutable source lineage.';

-- ---------------------------------------------------------------------------
-- 7. Include 2100 in the authoritative WP-05 reconciliation gate.
-- ---------------------------------------------------------------------------
create or replace function public.wp05_reconcile_all(
  p_company_id uuid default public.current_company_id(),
  p_as_of date default current_date
)
returns table (
  reconciliation_class text,
  account_no text,
  account_name text,
  subledger_balance numeric,
  gl_balance numeric,
  variance numeric,
  abs_variance numeric,
  currency text,
  reconciliation_status text,
  subledger_count bigint,
  gl_count bigint
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_tenant_bal numeric; v_tenant_cnt bigint; v_tenant_gl numeric; v_tenant_gl_cnt bigint;
  v_owner_bal numeric; v_owner_cnt bigint; v_owner_gl numeric; v_owner_gl_cnt bigint;
  v_dep_bal numeric; v_dep_cnt bigint; v_dep_gl numeric; v_dep_gl_cnt bigint;
  v_due_bal numeric; v_due_cnt bigint; v_due_gl numeric; v_due_gl_cnt bigint;
  v_comm_bal numeric; v_comm_cnt bigint; v_comm_gl numeric; v_comm_gl_cnt bigint;
  v_vat_bal numeric; v_vat_cnt bigint; v_vat_gl numeric; v_vat_gl_cnt bigint;
begin
  if p_company_id is null then
    raise exception 'WP05_RECONCILE_COMPANY_REQUIRED: company_id required' using errcode='22023';
  end if;

  if public.current_company_id() is not null and public.current_company_id() <> p_company_id then
    if current_user not in ('service_role','postgres','supabase_admin') then
      raise exception 'WP05_COMPANY_ISOLATION_VIOLATION: caller company does not match requested company' using errcode='42501';
    end if;
  end if;

  select balance, cnt into v_tenant_bal, v_tenant_cnt
    from public.wp05_subledger_tenant_receivables(p_company_id, p_as_of);
  v_tenant_gl := public.wp05_gl_balance(p_company_id, '1201', p_as_of);
  v_tenant_gl_cnt := public.wp05_gl_line_count(p_company_id, '1201', p_as_of);

  select balance, cnt into v_owner_bal, v_owner_cnt
    from public.wp05_subledger_owner_payables(p_company_id, p_as_of);
  v_owner_gl := public.wp05_gl_balance(p_company_id, '2000', p_as_of);
  v_owner_gl_cnt := public.wp05_gl_line_count(p_company_id, '2000', p_as_of);

  select balance, cnt into v_dep_bal, v_dep_cnt
    from public.wp05_subledger_security_deposits(p_company_id, p_as_of);
  v_dep_gl := public.wp05_gl_balance(p_company_id, '2200', p_as_of);
  v_dep_gl_cnt := public.wp05_gl_line_count(p_company_id, '2200', p_as_of);

  select balance, cnt into v_due_bal, v_due_cnt
    from public.wp05_subledger_due_from_owner(p_company_id, p_as_of);
  v_due_gl := public.wp05_gl_balance(p_company_id, '1300', p_as_of);
  v_due_gl_cnt := public.wp05_gl_line_count(p_company_id, '1300', p_as_of);

  select balance, cnt into v_comm_bal, v_comm_cnt
    from public.wp05_subledger_commission(p_company_id, p_as_of);
  v_comm_gl := public.wp05_gl_balance(p_company_id, '2300', p_as_of);
  v_comm_gl_cnt := public.wp05_gl_line_count(p_company_id, '2300', p_as_of);

  select balance, cnt into v_vat_bal, v_vat_cnt
    from public.rc1_owner_agency_vat_payable_balance(p_company_id, p_as_of);
  v_vat_gl := public.wp05_gl_balance(p_company_id, '2100', p_as_of);
  v_vat_gl_cnt := public.wp05_gl_line_count(p_company_id, '2100', p_as_of);

  return query
  select 'TENANT_RECEIVABLES'::text, '1201'::text, 'Tenant Receivable'::text,
         public.wp05_round_omr(v_tenant_bal), public.wp05_round_omr(v_tenant_gl),
         public.wp05_round_omr(v_tenant_bal - v_tenant_gl),
         public.wp05_round_omr(abs(v_tenant_bal - v_tenant_gl)),
         'OMR'::text,
         case when abs(v_tenant_bal - v_tenant_gl) <= 0.001 then 'PASS' else 'FAIL' end::text,
         v_tenant_cnt, v_tenant_gl_cnt
  union all
  select 'OWNER_PAYABLES'::text, '2000'::text, 'Owner Funds Payable'::text,
         public.wp05_round_omr(v_owner_bal), public.wp05_round_omr(v_owner_gl),
         public.wp05_round_omr(v_owner_bal - v_owner_gl),
         public.wp05_round_omr(abs(v_owner_bal - v_owner_gl)),
         'OMR'::text,
         case when abs(v_owner_bal - v_owner_gl) <= 0.001 then 'PASS' else 'FAIL' end::text,
         v_owner_cnt, v_owner_gl_cnt
  union all
  select 'SECURITY_DEPOSITS'::text, '2200'::text, 'Tenant Deposits Payable'::text,
         public.wp05_round_omr(v_dep_bal), public.wp05_round_omr(v_dep_gl),
         public.wp05_round_omr(v_dep_bal - v_dep_gl),
         public.wp05_round_omr(abs(v_dep_bal - v_dep_gl)),
         'OMR'::text,
         case when abs(v_dep_bal - v_dep_gl) <= 0.001 then 'PASS' else 'FAIL' end::text,
         v_dep_cnt, v_dep_gl_cnt
  union all
  select 'DUE_FROM_OWNER'::text, '1300'::text, 'Due from Owners'::text,
         public.wp05_round_omr(v_due_bal), public.wp05_round_omr(v_due_gl),
         public.wp05_round_omr(v_due_bal - v_due_gl),
         public.wp05_round_omr(abs(v_due_bal - v_due_gl)),
         'OMR'::text,
         case when abs(v_due_bal - v_due_gl) <= 0.001 then 'PASS' else 'FAIL' end::text,
         v_due_cnt, v_due_gl_cnt
  union all
  select 'COMMISSION'::text, '2300'::text, 'Broker Commissions Payable'::text,
         public.wp05_round_omr(v_comm_bal), public.wp05_round_omr(v_comm_gl),
         public.wp05_round_omr(v_comm_bal - v_comm_gl),
         public.wp05_round_omr(abs(v_comm_bal - v_comm_gl)),
         'OMR'::text,
         case when abs(v_comm_bal - v_comm_gl) <= 0.001 then 'PASS' else 'FAIL' end::text,
         v_comm_cnt, v_comm_gl_cnt
  union all
  select 'VAT_PAYABLE'::text, '2100'::text, 'VAT Payable'::text,
         public.wp05_round_omr(v_vat_bal), public.wp05_round_omr(v_vat_gl),
         public.wp05_round_omr(v_vat_bal - v_vat_gl),
         public.wp05_round_omr(abs(v_vat_bal - v_vat_gl)),
         'OMR'::text,
         case when abs(v_vat_bal - v_vat_gl) <= 0.001 then 'PASS' else 'FAIL' end::text,
         v_vat_cnt, v_vat_gl_cnt;
end;
$function$;

comment on function public.wp05_reconcile_all(uuid,date) is
  'GAP-013 deterministic OMR 3dp reconciliation including 1201/1300/2000/2100/2200/2300 with 0.001 tolerance.';

-- ---------------------------------------------------------------------------
-- 8. Preserve ownership and narrow execute grants.
-- ---------------------------------------------------------------------------
alter function public.create_fee_tax_treatment_atomic(jsonb) owner to postgres;
revoke all on function public.create_fee_tax_treatment_atomic(jsonb) from public, anon;
grant execute on function public.create_fee_tax_treatment_atomic(jsonb) to authenticated, service_role;

alter function public.approve_fee_tax_treatment_atomic(jsonb) owner to postgres;
revoke all on function public.approve_fee_tax_treatment_atomic(jsonb) from public, anon;
grant execute on function public.approve_fee_tax_treatment_atomic(jsonb) to authenticated, service_role;

alter function public.approve_owner_funds_cutover_atomic(jsonb) owner to postgres;
revoke all on function public.approve_owner_funds_cutover_atomic(jsonb) from public, anon;
grant execute on function public.approve_owner_funds_cutover_atomic(jsonb) to authenticated, service_role;

alter function public.assert_owner_funds_event_solvency(uuid,uuid,text,numeric,date) owner to postgres;
revoke all on function public.assert_owner_funds_event_solvency(uuid,uuid,text,numeric,date) from public, anon, authenticated;
grant execute on function public.assert_owner_funds_event_solvency(uuid,uuid,text,numeric,date) to service_role;

alter function public.guard_owner_funds_event_cutover() owner to postgres;
revoke all on function public.guard_owner_funds_event_cutover() from public, anon, authenticated;

revoke all on function public.rc1_owner_agency_vat_payable_balance(uuid,date) from public, anon;
grant execute on function public.rc1_owner_agency_vat_payable_balance(uuid,date) to authenticated, service_role;

revoke all on function public.wp05_reconcile_all(uuid,date) from public, anon;
grant execute on function public.wp05_reconcile_all(uuid,date) to authenticated, service_role;

commit;
