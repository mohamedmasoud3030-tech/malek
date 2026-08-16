-- ============================================================================
-- RC1 — Controlled collections, payment tax lineage and receipt write boundary
-- ============================================================================
--
-- Completes the owner-agency invoice lifecycle after the RC1 invoice/credit
-- mappings:
--   * payment methods map server-side only to 1111 Cash or 1120 Bank;
--   * OWNER_IS_CREDITOR collection is Dr cash/bank / Cr 2000 net / Cr 2100 tax;
--   * OFFICE_IS_CREDITOR collection clears the already-posted 1201 balance;
--   * RATE management fees use the collected rent net of original rent tax;
--   * payment tax allocations retain the original invoice snapshot basis;
--   * post_receipt_atomic is an internal/service boundary, not a browser journal
--     authoring API; the app continues to use record_invoice_payment_atomic.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Immutable tax component for each controlled receipt/invoice allocation.
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_payment_tax_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  receipt_id uuid not null references public.receipts(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  tax_snapshot_id uuid not null references public.taxable_line_tax_snapshots(id) on delete restrict,
  net_amount numeric(18,3) not null check (net_amount >= 0 and net_amount = round(net_amount, 3)),
  tax_amount numeric(18,3) not null check (tax_amount >= 0 and tax_amount = round(tax_amount, 3)),
  created_at timestamptz not null default now(),
  constraint invoice_payment_tax_allocations_receipt_invoice_uq unique (receipt_id, invoice_id)
);

create index if not exists invoice_payment_tax_allocations_invoice_idx
  on public.invoice_payment_tax_allocations (company_id, invoice_id, receipt_id);

alter table public.invoice_payment_tax_allocations enable row level security;
drop policy if exists invoice_payment_tax_allocations_company_read on public.invoice_payment_tax_allocations;
create policy invoice_payment_tax_allocations_company_read
  on public.invoice_payment_tax_allocations
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_admin_or_manager() or public.is_accountant())
  );
revoke all on table public.invoice_payment_tax_allocations from public, anon, authenticated;
grant select on table public.invoice_payment_tax_allocations to authenticated;

create or replace function public.guard_invoice_payment_tax_allocation_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'INVOICE_PAYMENT_TAX_ALLOCATION_IMMUTABLE: receipt tax allocation history is append-only.'
      using errcode='42501';
  end if;
  return new;
end;
$function$;

alter function public.guard_invoice_payment_tax_allocation_immutable() owner to postgres;
revoke all on function public.guard_invoice_payment_tax_allocation_immutable() from public, anon, authenticated;
drop trigger if exists trg_invoice_payment_tax_allocation_immutable on public.invoice_payment_tax_allocations;
create trigger trg_invoice_payment_tax_allocation_immutable
before update or delete on public.invoice_payment_tax_allocations
for each row execute function public.guard_invoice_payment_tax_allocation_immutable();

create or replace function public.guard_invoice_payment_tax_allocation_lineage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_allocated numeric;
begin
  if not exists (
    select 1 from public.receipts r where r.id = new.receipt_id and r.company_id = new.company_id
  ) or not exists (
    select 1 from public.invoices i where i.id = new.invoice_id and i.company_id = new.company_id
  ) then
    raise exception 'INVOICE_PAYMENT_TAX_ALLOCATION_COMPANY_MISMATCH' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.taxable_line_tax_snapshots s
     where s.id = new.tax_snapshot_id
       and s.company_id = new.company_id
       and s.source_type = 'invoice'
       and s.source_id = new.invoice_id::text
  ) then
    raise exception 'INVOICE_PAYMENT_TAX_ALLOCATION_SNAPSHOT_MISMATCH' using errcode='23514';
  end if;
  select coalesce(sum(ra.amount), 0) into v_allocated
    from public.receipt_allocations ra
   where ra.receipt_id = new.receipt_id
     and ra.invoice_id = new.invoice_id
     and ra.company_id = new.company_id
     and ra.deleted_at is null;
  if public.gl_pm_round_omr(new.net_amount + new.tax_amount) <> public.gl_pm_round_omr(v_allocated) then
    raise exception 'INVOICE_PAYMENT_TAX_ALLOCATION_AMOUNT_MISMATCH' using errcode='23514';
  end if;
  return new;
end;
$function$;

alter function public.guard_invoice_payment_tax_allocation_lineage() owner to postgres;
revoke all on function public.guard_invoice_payment_tax_allocation_lineage() from public, anon, authenticated;
drop trigger if exists trg_invoice_payment_tax_allocation_lineage on public.invoice_payment_tax_allocations;
create trigger trg_invoice_payment_tax_allocation_lineage
before insert on public.invoice_payment_tax_allocations
for each row execute function public.guard_invoice_payment_tax_allocation_lineage();

-- ---------------------------------------------------------------------------
-- 2. Financial ceiling/status guards shared by record_invoice_payment_atomic,
--    the internal multi-allocation engine and the governed receipt VOID path.
-- ---------------------------------------------------------------------------
create or replace function public.guard_receipt_allocation_invoice_credit_ceiling()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_invoice public.invoices%rowtype;
  v_receipt_total numeric;
begin
  if new.invoice_id is null or new.receipt_id is null or new.company_id is null then
    raise exception 'RECEIPT_ALLOCATION_LINEAGE_REQUIRED' using errcode='23514';
  end if;

  select * into v_invoice
    from public.invoices
   where id = new.invoice_id
     and company_id = new.company_id
     and deleted_at is null
   for update;
  if not found then
    raise exception 'RECEIPT_ALLOCATION_INVOICE_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;

  select coalesce(sum(ra.amount), 0)
    into v_receipt_total
    from public.receipt_allocations ra
   where ra.receipt_id = new.receipt_id
     and ra.invoice_id = new.invoice_id
     and ra.company_id = new.company_id
     and coalesce(ra.deleted_at, null) is null;

  if public.gl_pm_round_omr(coalesce(v_invoice.paid_amount, 0)
       + coalesce(v_invoice.credited_amount, 0)
       + coalesce(v_receipt_total, 0)
       + coalesce(new.amount, 0))
     > public.gl_pm_round_omr(v_invoice.amount + coalesce(v_invoice.tax_amount, 0) + 0.001) then
    raise exception 'RECEIPT_ALLOCATION_EXCEEDS_INVOICE_OUTSTANDING: payment allocation exceeds posted invoice less credits.'
      using errcode='22023';
  end if;

  return new;
end;
$function$;

alter function public.guard_receipt_allocation_invoice_credit_ceiling() owner to postgres;
revoke all on function public.guard_receipt_allocation_invoice_credit_ceiling() from public, anon, authenticated;
drop trigger if exists trg_receipt_allocation_invoice_credit_ceiling on public.receipt_allocations;
create trigger trg_receipt_allocation_invoice_credit_ceiling
before insert on public.receipt_allocations
for each row execute function public.guard_receipt_allocation_invoice_credit_ceiling();

create or replace function public.project_invoice_payment_status_with_credits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_satisfied numeric;
  v_total numeric;
begin
  -- Do not put paid_amount/credited_amount in the trigger UPDATE OF list:
  -- Phase-1's widening migration must remain replay-idempotent even after this
  -- later projection guard exists. Return unchanged rows immediately.
  if new.paid_amount is not distinct from old.paid_amount
     and new.credited_amount is not distinct from old.credited_amount then
    return new;
  end if;

  if coalesce(old.document_status, '') in ('VOIDED', 'REVERSED')
     or upper(coalesce(old.status, '')) = 'VOID' then
    return new;
  end if;

  v_satisfied := public.gl_pm_round_omr(coalesce(new.paid_amount, 0) + coalesce(new.credited_amount, 0));
  v_total := public.gl_pm_round_omr(new.amount + coalesce(new.tax_amount, 0));
  new.status := case
    when v_satisfied <= 0 and new.due_date < current_date then 'OVERDUE'
    when v_satisfied <= 0 then 'UNPAID'
    when v_satisfied < v_total - 0.001 then 'PARTIALLY_PAID'
    else 'PAID'
  end;
  return new;
end;
$function$;

alter function public.project_invoice_payment_status_with_credits() owner to postgres;
revoke all on function public.project_invoice_payment_status_with_credits() from public, anon, authenticated;
drop trigger if exists trg_invoice_payment_status_with_credits on public.invoices;
create trigger trg_invoice_payment_status_with_credits
before update on public.invoices
for each row execute function public.project_invoice_payment_status_with_credits();

-- ---------------------------------------------------------------------------
-- 3. Application-facing controlled collection RPC.
-- ---------------------------------------------------------------------------
create or replace function public.record_invoice_payment_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_invoice_id uuid;
  v_amount numeric;
  v_method text;
  v_date date;
  v_reference text;
  v_request_id text;
  v_invoice public.invoices%rowtype;
  v_contract public.contracts%rowtype;
  v_agreement_version public.owner_agreement_versions%rowtype;
  v_total_due numeric;
  v_paid_amount numeric;
  v_credited_amount numeric;
  v_outstanding numeric;
  v_receipt_id uuid := gen_random_uuid();
  v_allocation_id uuid := gen_random_uuid();
  v_cash_account_no text;
  v_cash_account_id text;
  v_receivable_account_id text;
  v_owner_payable_account_id text;
  v_fee_revenue_account_id text;
  v_vat_account_id text;
  v_internal_payload jsonb;
  v_internal_result jsonb;
  v_existing_result jsonb;
  v_result jsonb;
  v_company_id uuid;
  v_request_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target_id text;
  v_operating_model text;
  v_collection_role text;
  v_commission_type text;
  v_commission_value numeric;
  v_commission_net numeric := 0;
  v_journal_entries jsonb;
  v_is_owner_creditor boolean := false;
  v_taxable boolean := false;
  v_prior_receipt_tax numeric := 0;
  v_prior_credit_tax numeric := 0;
  v_prior_credit_unclassified integer := 0;
  v_remaining_tax numeric := 0;
  v_collection_tax numeric := 0;
  v_collection_net numeric;
  v_tax_snapshot public.taxable_line_tax_snapshots%rowtype;
  v_tax_allocation_receipt_id uuid;
  v_actual_receipt_id uuid;
  v_owner_funds_batch_id uuid;
  v_owner_id uuid;
  v_historical_4000 boolean := false;
begin
  if v_actor is null then
    raise exception 'Authentication is required to record invoice payments' using errcode='42501';
  end if;
  if not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'ADMIN or MANAGER role is required to record invoice payments' using errcode='42501';
  end if;

  v_company_id := public.require_company_id();
  if payload ?| array['company_id','account_id','cash_account_id','journal_entries','tax_rate','tax_code','tax_amount'] then
    raise exception 'PAYMENT_SERVER_OWNED_ACCOUNTING_FIELDS_FORBIDDEN' using errcode='22023';
  end if;

  v_request_id := nullif(btrim(coalesce(payload->>'request_id', '')), '');
  v_invoice_id := nullif(payload->>'invoice_id', '')::uuid;
  v_amount := public.gl_pm_round_omr(coalesce((payload->>'amount')::numeric, 0));
  v_method := lower(coalesce(nullif(payload->>'method', ''), nullif(payload->>'channel', ''), nullif(payload->>'payment_method', ''), 'cash'));
  v_date := coalesce(nullif(payload->>'date', '')::date, current_date);
  v_reference := nullif(payload->>'reference', '');

  if v_request_id is null or v_invoice_id is null then
    raise exception 'PAYMENT_REQUEST_AND_INVOICE_REQUIRED' using errcode='22023';
  end if;
  if v_amount <= 0 then
    raise exception 'PAYMENT_AMOUNT_MUST_BE_POSITIVE' using errcode='22023';
  end if;

  case v_method
    when 'cash' then v_cash_account_no := '1111';
    when 'bank_transfer', 'bank' then v_cash_account_no := '1120';
    else
      raise exception 'PAYMENT_METHOD_ACCOUNTING_UNAVAILABLE: RC1 supports only cash or bank_transfer until a controlled clearing-account policy is approved.'
        using errcode='22023';
  end case;

  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'invoice_id', v_invoice_id::text,
    'amount', trim_scale(v_amount),
    'method', v_method,
    'date', nullif(payload->>'date', '')::date,
    'reference', v_reference
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(
    hashtextextended('record_invoice_payment_atomic:' || v_company_id::text || ':' || v_request_id, 0)
  );

  select response_payload into v_existing_result
    from public.financial_operation_idempotency
   where operation_name = 'record_invoice_payment_atomic:' || v_company_id::text
     and request_id = v_request_id
   for update;
  if v_existing_result is not null then
    v_cached_fingerprint := v_existing_result->>'_request_fingerprint';
    v_cached_target_id := v_existing_result->>'_target_id';
    if v_cached_fingerprint is null
       or v_cached_target_id is null
       or not (v_existing_result ? 'response') then
      raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED' using errcode='22023';
    end if;
    if v_cached_fingerprint <> v_request_fingerprint
       or v_cached_target_id <> v_invoice_id::text then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode='22023';
    end if;
    return v_existing_result->'response';
  end if;

  select * into v_invoice
    from public.invoices
   where id = v_invoice_id
     and company_id = v_company_id
     and deleted_at is null
   for update;
  if not found then
    raise exception 'PAYMENT_INVOICE_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  if v_invoice.document_status <> 'POSTED' then
    raise exception 'PAYMENT_INVOICE_NOT_POSTED' using errcode='22023';
  end if;

  select * into v_contract
    from public.contracts
   where id = v_invoice.contract_id
     and company_id = v_company_id
     and deleted_at is null
   for update;
  if not found then
    raise exception 'PAYMENT_CONTRACT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;

  -- New invoices use their own immutable lineage. Legacy invoices are allowed
  -- only where their old source does not evidence the known 4000 defect.
  if v_invoice.invoice_accounting_classification is null then
    select exists (
      select 1
        from public.journal_batches b
        join public.journal_lines jl on jl.batch_id = b.id and jl.company_id = v_company_id
        join public.accounts a on a.id = jl.account_id and a.company_id = v_company_id
       where b.company_id = v_company_id
         and b.source_type = 'invoice'
         and b.source_id = v_invoice.id::text
         and a.no = '4000'
    ) into v_historical_4000;
    if v_historical_4000 then
      raise exception 'HISTORICAL_INVOICE_ACCOUNTING_REVIEW_REQUIRED: owner-agency invoice source credited 4000. Do not continue the lifecycle without governed S08 review.'
        using errcode='23514';
    end if;
  end if;

  select * into v_agreement_version
    from public.owner_agreement_versions av
   where av.id = coalesce(v_invoice.invoice_agreement_version_id, v_contract.agreement_version_id)
     and av.company_id = v_company_id;

  select oa.owner_id into v_owner_id
    from public.owner_agreements oa
   where oa.id = v_agreement_version.owner_agreement_id
     and oa.company_id = v_company_id;

  v_operating_model := coalesce(v_invoice.invoice_operating_model, v_contract.operating_model_snapshot, v_agreement_version.operating_model);
  v_collection_role := coalesce(v_invoice.invoice_collection_role, v_contract.collection_role_snapshot, v_agreement_version.collection_role);
  v_commission_type := v_agreement_version.commission_type;
  v_commission_value := v_agreement_version.commission_value;

  if v_operating_model = 'OWNER_AGENCY' then
    if v_agreement_version.id is null
       or v_owner_id is null
       or v_collection_role not in ('OWNER_IS_CREDITOR','OFFICE_IS_CREDITOR') then
      raise exception 'OWNER_AGENCY_COLLECTION_TERMS_MISSING' using errcode='23514';
    end if;
    if v_invoice.invoice_accounting_classification is not null
       and (v_invoice.invoice_operating_model is distinct from v_contract.operating_model_snapshot
         or v_invoice.invoice_collection_role is distinct from v_contract.collection_role_snapshot) then
      raise exception 'PAYMENT_INVOICE_CONTRACT_LINEAGE_MISMATCH' using errcode='23514';
    end if;
  end if;

  v_total_due := public.gl_pm_round_omr(v_invoice.amount + coalesce(v_invoice.tax_amount, 0));
  v_paid_amount := coalesce(v_invoice.paid_amount, 0);
  v_credited_amount := coalesce(v_invoice.credited_amount, 0);
  v_outstanding := public.gl_pm_round_omr(v_total_due - v_paid_amount - v_credited_amount);
  if v_amount > v_outstanding + 0.001 then
    raise exception 'PAYMENT_EXCEEDS_OUTSTANDING: payment % exceeds invoice outstanding % after credits.', v_amount, v_outstanding
      using errcode='22023';
  end if;

  -- Tax allocation is based on the invoice's immutable snapshot and active
  -- prior credit/payment components; no current profile is consulted here.
  if v_invoice.tax_treatment = 'TAXABLE' then
    select * into v_tax_snapshot
      from public.taxable_line_tax_snapshots s
     where s.id = v_invoice.tax_snapshot_id
       and s.company_id = v_company_id
       and s.source_type = 'invoice'
       and s.source_id = v_invoice.id::text;
    if not found
       or v_invoice.tax_profile_id is null
       or v_tax_snapshot.tax_code is distinct from v_invoice.tax_code
       or v_tax_snapshot.tax_rate is distinct from v_invoice.tax_rate
       or v_tax_snapshot.tax_amount is distinct from v_invoice.tax_amount then
      raise exception 'PAYMENT_TAX_LINEAGE_MISSING' using errcode='23514';
    end if;
    v_taxable := true;

    select coalesce(sum(pta.tax_amount), 0)
      into v_prior_receipt_tax
      from public.invoice_payment_tax_allocations pta
      join public.receipts r on r.id = pta.receipt_id and r.company_id = v_company_id
     where pta.company_id = v_company_id
       and pta.invoice_id = v_invoice.id
       and upper(coalesce(r.status,'')) <> 'VOID'
       and r.deleted_at is null;

    select
      coalesce(sum(ic.tax_amount) filter (where ic.status = 'POSTED'), 0),
      count(*) filter (where ic.status = 'POSTED' and ic.tax_amount is null)
    into v_prior_credit_tax, v_prior_credit_unclassified
    from public.invoice_credits ic
    where ic.company_id = v_company_id
      and ic.invoice_id = v_invoice.id;

    if v_prior_credit_unclassified > 0 then
      raise exception 'PAYMENT_EXISTING_CREDIT_TAX_LINEAGE_REVIEW_REQUIRED' using errcode='23514';
    end if;
    if v_paid_amount > 0 and v_prior_receipt_tax = 0 and v_invoice.tax_amount > 0 then
      raise exception 'PAYMENT_HISTORICAL_TAX_ALLOCATION_REVIEW_REQUIRED: prior taxable collections have no immutable component lineage.'
        using errcode='23514';
    end if;

    v_remaining_tax := public.gl_pm_round_omr(v_invoice.tax_amount - v_prior_credit_tax - v_prior_receipt_tax);
    if v_remaining_tax < -0.001 then
      raise exception 'PAYMENT_TAX_LINEAGE_BALANCE_INVALID' using errcode='23514';
    end if;
    if v_amount >= v_outstanding - 0.001 then
      v_collection_tax := greatest(v_remaining_tax, 0);
    elsif v_outstanding > 0 then
      v_collection_tax := public.gl_pm_round_omr(v_amount * greatest(v_remaining_tax, 0) / v_outstanding);
    end if;
  elsif v_invoice.tax_treatment = 'NON_TAXABLE' then
    if coalesce(v_invoice.tax_amount, 0) <> 0 then
      raise exception 'PAYMENT_NON_TAXABLE_INVOICE_TAX_INVALID' using errcode='23514';
    end if;
  elsif coalesce(v_invoice.tax_amount, 0) > 0 then
    raise exception 'PAYMENT_LEGACY_TAX_LINEAGE_REVIEW_REQUIRED' using errcode='23514';
  end if;

  v_collection_net := public.gl_pm_round_omr(v_amount - v_collection_tax);
  v_is_owner_creditor := v_operating_model = 'OWNER_AGENCY' and v_collection_role = 'OWNER_IS_CREDITOR';

  if v_operating_model = 'OWNER_AGENCY' and v_commission_type = 'RATE' then
    if v_commission_value is null or v_commission_value < 0 or v_commission_value > 100 then
      raise exception 'OWNER_AGENCY_RATE_TERMS_INVALID' using errcode='23514';
    end if;
    v_commission_net := public.gl_pm_round_omr(v_collection_net * v_commission_value / 100);
  end if;

  v_cash_account_id := public.require_company_account_id(v_company_id, v_cash_account_no);
  v_receivable_account_id := public.require_company_account_id(v_company_id, '1201');
  v_owner_payable_account_id := public.require_company_account_id(v_company_id, '2000');
  if v_collection_tax > 0 then
    v_vat_account_id := public.require_company_account_id(v_company_id, '2100');
  end if;
  if v_commission_net > 0 then
    v_fee_revenue_account_id := public.require_company_account_id(v_company_id, '4100');
  end if;

  v_journal_entries := jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-D',
      'date', v_date::text,
      'account_id', v_cash_account_id,
      'amount', v_amount,
      'type', 'DEBIT',
      'source_id', v_receipt_id,
      'entity_type', 'contract',
      'entity_id', v_invoice.contract_id,
      'created_at', timezone('utc', now())
    )
  );

  if v_is_owner_creditor then
    v_journal_entries := v_journal_entries || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-C-OFP',
        'date', v_date::text,
        'account_id', v_owner_payable_account_id,
        'amount', v_collection_net,
        'type', 'CREDIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice.contract_id,
        'created_at', timezone('utc', now())
      )
    );
    if v_collection_tax > 0 then
      v_journal_entries := v_journal_entries || jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid(),
          'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-C-VAT',
          'date', v_date::text,
          'account_id', v_vat_account_id,
          'amount', v_collection_tax,
          'type', 'CREDIT',
          'source_id', v_receipt_id,
          'entity_type', 'contract',
          'entity_id', v_invoice.contract_id,
          'created_at', timezone('utc', now())
        )
      );
    end if;
  else
    v_journal_entries := v_journal_entries || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'PAY-' || left(replace(v_request_id, '-', ''), 12) || '-C-AR',
        'date', v_date::text,
        'account_id', v_receivable_account_id,
        'amount', v_amount,
        'type', 'CREDIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice.contract_id,
        'created_at', timezone('utc', now())
      )
    );
  end if;

  if v_commission_net > 0 then
    v_journal_entries := v_journal_entries || jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'FEE-' || left(replace(v_request_id, '-', ''), 12) || '-D',
        'date', v_date::text,
        'account_id', v_owner_payable_account_id,
        'amount', v_commission_net,
        'type', 'DEBIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice.contract_id,
        'created_at', timezone('utc', now())
      ),
      jsonb_build_object(
        'id', gen_random_uuid(),
        'no', 'FEE-' || left(replace(v_request_id, '-', ''), 12) || '-C',
        'date', v_date::text,
        'account_id', v_fee_revenue_account_id,
        'amount', v_commission_net,
        'type', 'CREDIT',
        'source_id', v_receipt_id,
        'entity_type', 'contract',
        'entity_id', v_invoice.contract_id,
        'created_at', timezone('utc', now())
      )
    );
  end if;

  v_internal_payload := jsonb_build_object(
    'request_id', v_request_id,
    'receipt', jsonb_build_object(
      'id', v_receipt_id,
      'contract_id', v_invoice.contract_id,
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
    'journal_entries', v_journal_entries
  );

  v_internal_result := public.post_receipt_atomic(v_internal_payload);
  v_actual_receipt_id := coalesce(nullif(v_internal_result->>'receipt_id','')::uuid, v_receipt_id);

  if v_taxable then
    v_tax_allocation_receipt_id := v_actual_receipt_id;
    insert into public.invoice_payment_tax_allocations (
      company_id, receipt_id, invoice_id, tax_snapshot_id, net_amount, tax_amount
    ) values (
      v_company_id, v_tax_allocation_receipt_id, v_invoice_id,
      v_invoice.tax_snapshot_id, v_collection_net, v_collection_tax
    );
  end if;

  if v_operating_model = 'OWNER_AGENCY' then
    select jb.id into v_owner_funds_batch_id
      from public.journal_batches jb
     where jb.company_id = v_company_id
       and jb.source_type = 'receipt'
       and jb.source_id = v_actual_receipt_id::text
     order by jb.created_at, jb.id
     limit 1;

    if v_is_owner_creditor then
      insert into public.owner_funds_events (
        company_id, owner_id, contract_id, invoice_id, source_type, source_id,
        event_id, amount_delta, effective_date, journal_batch_id
      ) values (
        v_company_id, v_owner_id, v_invoice.contract_id, v_invoice_id,
        'OWNER_COLLECTION', v_actual_receipt_id::text, 'collection',
        v_collection_net, v_date, v_owner_funds_batch_id
      );
    end if;

    if v_commission_net > 0 then
      insert into public.owner_funds_events (
        company_id, owner_id, contract_id, invoice_id, source_type, source_id,
        event_id, amount_delta, effective_date, journal_batch_id
      ) values (
        v_company_id, v_owner_id, v_invoice.contract_id, v_invoice_id,
        'MANAGEMENT_FEE', v_actual_receipt_id::text, 'fee',
        -v_commission_net, v_date, v_owner_funds_batch_id
      );
    end if;
  end if;

  v_result := v_internal_result || jsonb_build_object(
    'status', 'recorded',
    'request_id', v_request_id,
    'invoice_id', v_invoice_id,
    'receipt_id', coalesce(nullif(v_internal_result->>'receipt_id', '')::uuid, v_receipt_id),
    'accounting_model', coalesce(v_operating_model, 'STANDARD'),
    'collection_role', v_collection_role,
    'cash_account_no', v_cash_account_no,
    'collection_net', v_collection_net,
    'collection_tax', v_collection_tax,
    'management_fee_net', v_commission_net
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values (
    'record_invoice_payment_atomic:' || v_company_id::text,
    v_request_id,
    jsonb_build_object(
      '_request_fingerprint', v_request_fingerprint,
      '_target_id', v_invoice_id::text,
      'response', v_result
    )
  ) on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$function$;

alter function public.record_invoice_payment_atomic(jsonb) owner to postgres;
revoke all on function public.record_invoice_payment_atomic(jsonb) from public, anon;
grant execute on function public.record_invoice_payment_atomic(jsonb) to authenticated, service_role;
comment on function public.record_invoice_payment_atomic(jsonb) is
  'RC1 controlled single-invoice collection. Server derives cash/bank, collection role, owner funds, original tax allocation and management fee; browser supplies no accounts or tax.';

-- post_receipt_atomic remains the retained engine-level multi-allocation
-- primitive, but its payload contains journal lines and cannot be browser
-- executable. record_invoice_payment_atomic calls it under SECURITY DEFINER.
alter function public.post_receipt_atomic(jsonb) owner to postgres;
revoke all on function public.post_receipt_atomic(jsonb) from public, anon, authenticated;
grant execute on function public.post_receipt_atomic(jsonb) to service_role;
comment on function public.post_receipt_atomic(jsonb) is
  'Internal/service receipt-allocation engine. Not browser-executable because its journal payload is server-owned; RC1 UI uses record_invoice_payment_atomic.';

-- A governed receipt VOID is a compensating event. Mirror each owner-funds
-- event that originated from the voided receipt rather than editing it.
create or replace function public.capture_owner_funds_receipt_void_reversal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_event public.owner_funds_events%rowtype;
begin
  if new.status = 'EXECUTED' and old.status is distinct from 'EXECUTED' then
    for v_event in
      select *
        from public.owner_funds_events e
       where e.company_id = new.company_id
         and e.source_id = new.receipt_id::text
         and e.source_type in ('OWNER_COLLECTION', 'MANAGEMENT_FEE')
    loop
      insert into public.owner_funds_events (
        company_id, owner_id, contract_id, invoice_id, source_type, source_id,
        event_id, amount_delta, effective_date, journal_batch_id
      ) values (
        new.company_id, v_event.owner_id, v_event.contract_id, v_event.invoice_id,
        'RECEIPT_VOID_REVERSAL', new.id::text, v_event.id::text,
        -v_event.amount_delta, current_date, new.reversal_batch_id
      ) on conflict (company_id, source_type, source_id, event_id) do nothing;
    end loop;
  end if;
  return new;
end;
$function$;

alter function public.capture_owner_funds_receipt_void_reversal() owner to postgres;
revoke all on function public.capture_owner_funds_receipt_void_reversal() from public, anon, authenticated;
drop trigger if exists trg_owner_funds_receipt_void_reversal on public.receipt_void_requests;
create trigger trg_owner_funds_receipt_void_reversal
after update of status on public.receipt_void_requests
for each row execute function public.capture_owner_funds_receipt_void_reversal();

-- Owner payout is a distinct operational source, not a negative rewrite of a
-- prior collection. Record it append-only when the governed settlement becomes
-- PAID; a paid settlement never re-enters the payable control twice.
create or replace function public.capture_owner_funds_settlement_payout()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_batch_id uuid;
begin
  if new.status = 'PAID' and coalesce(old.status, '') <> 'PAID'
     and new.owner_id is not null and coalesce(new.net_payable, 0) > 0 then
    select jb.id into v_batch_id
      from public.journal_batches jb
     where jb.company_id = new.company_id
       and jb.source_type = 'owner_settlement_payment'
       and jb.source_id = new.id::text
     order by jb.created_at, jb.id
     limit 1;

    insert into public.owner_funds_events (
      company_id, owner_id, source_type, source_id, event_id, amount_delta,
      effective_date, journal_batch_id
    ) values (
      new.company_id, new.owner_id::uuid, 'OWNER_SETTLEMENT_PAYOUT', new.id::text,
      'payout', -public.gl_pm_round_omr(new.net_payable),
      coalesce(new.paid_at::date, nullif(new.date::text, '')::date, current_date), v_batch_id
    ) on conflict (company_id, source_type, source_id, event_id) do nothing;
  end if;
  return new;
end;
$function$;

alter function public.capture_owner_funds_settlement_payout() owner to postgres;
revoke all on function public.capture_owner_funds_settlement_payout() from public, anon, authenticated;
drop trigger if exists trg_owner_funds_settlement_payout on public.owner_settlements;
create trigger trg_owner_funds_settlement_payout
after update of status on public.owner_settlements
for each row execute function public.capture_owner_funds_settlement_payout();

commit;
