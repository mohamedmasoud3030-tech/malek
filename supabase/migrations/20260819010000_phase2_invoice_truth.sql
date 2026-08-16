-- ============================================================================
-- PHASE 2 — Invoice Truth & Billing Integrity
-- ============================================================================
-- Mission: Malik Financial Hardening, Phase 2.
-- Audit: docs/audits/FINANCIAL_HARDENING_AUDIT_20260815.md (F01, F02, F03, F04,
-- F06, F09, F14).
--
-- Goals:
--   1. Billing obligation identity: a recurring contractual rent obligation is
--      uniquely identified by (company, contract, charge_type, billing_period)
--      and can never be generated twice.
--   2. Recurring generation is deterministic and idempotent under retries, on
--      different calendar days, and under concurrent execution.
--   3. Deterministic billing/due dates derived from contract policy
--      (billing_day + grace_days) instead of current_date.
--   4. Invoice document lifecycle (DRAFT/POSTED/VOIDED/REVERSED) separated from
--      the derived payment status (status = UNPAID/PARTIALLY_PAID/PAID).
--   5. Posted invoice immutability at the DB layer: financially meaningful
--      fields cannot be silently edited; no hard delete of posted invoices.
--   6. Invoice lineage / company coherence enforced server-side.
-- ----------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. Contracts: deterministic billing policy fields
-- ---------------------------------------------------------------------------
alter table public.contracts
  add column if not exists billing_day integer not null default 1
    check (billing_day between 1 and 28);
alter table public.contracts
  add column if not exists grace_days integer not null default 0
    check (grace_days >= 0);

-- ---------------------------------------------------------------------------
-- 2. Invoices: document lifecycle + billing obligation identity + periods
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists document_status text not null default 'DRAFT'
    check (document_status in ('DRAFT','POSTED','VOIDED','REVERSED'));
alter table public.invoices
  add column if not exists charge_type text not null default 'RENT';
alter table public.invoices
  add column if not exists billing_period_start date;
alter table public.invoices
  add column if not exists billing_period_end date;

-- 2a. Backfill existing invoices: they are posted financial documents; derive the
--     billing period deterministically from issue_date.
update public.invoices
   set document_status = 'POSTED'
 where document_status = 'DRAFT';

update public.invoices
   set billing_period_start = date_trunc('month', issue_date)::date,
       billing_period_end = (date_trunc('month', issue_date)
                             + interval '1 month' - interval '1 day')::date
 where billing_period_start is null;

-- ---------------------------------------------------------------------------
-- 3. Billing obligation uniqueness (final DB protection against duplicate
--    recurring charges). Allows distinct charge types in the same period and
--    allows a new obligation once the prior one is soft-deleted or reversed.
--    The legacy (contract_id, issue_date) partial unique index is dropped:
--    with deterministic billing (issue_date derives from billing_day) the
--    billing-period identity below is the authoritative duplicate guard and
--    also permits multiple distinct charge types within one period.
-- ---------------------------------------------------------------------------
drop index if exists public.invoices_contract_issue_date_unique;
create unique index if not exists ux_invoices_billing_obligation
  on public.invoices (company_id, contract_id, charge_type, billing_period_start)
  where deleted_at is null
    and billing_period_start is not null
    and document_status not in ('VOIDED','REVERSED');

-- ---------------------------------------------------------------------------
-- 4. Invoice lineage guard: invoice.company_id must equal contract.company_id
--    (prevents cross-company invoice injection structurally).
-- ---------------------------------------------------------------------------
create or replace function public.invoice_lineage_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_contract_company uuid;
begin
  select c.company_id into v_contract_company
    from public.contracts c
   where c.id = new.contract_id;
  if v_contract_company is null then
    raise exception 'INVOICE_CONTRACT_NOT_FOUND: contract % does not exist.', new.contract_id
      using errcode = '23503';
  end if;
  if v_contract_company is distinct from new.company_id then
    raise exception 'INVOICE_COMPANY_MISMATCH: invoice company % does not match contract company % (cross-company injection rejected).', new.company_id, v_contract_company
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_invoice_lineage_guard on public.invoices;
create trigger trg_invoice_lineage_guard
  before insert or update of contract_id, company_id on public.invoices
  for each row execute function public.invoice_lineage_guard();

-- ---------------------------------------------------------------------------
-- 5. Posted invoice immutability + no hard delete (document lifecycle).
--    Settlement fields (paid_amount, status) may be updated by the posting
--    engine; financially meaningful document fields are immutable once POSTED.
-- ---------------------------------------------------------------------------
create or replace function public.invoice_document_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'DELETE' then
    if old.document_status = 'POSTED' then
      raise exception 'POSTED_INVOICE_HARD_DELETE_BLOCKED: posted invoices cannot be hard-deleted; use VOID/CANCEL/REVERSAL/credit.'
        using errcode = '42501';
    end if;
    return old;
  end if;

  -- POSTED invoices are immutable for financially meaningful document fields.
  if tg_op = 'UPDATE' and old.document_status = 'POSTED' then
    if new.amount            is distinct from old.amount
       or new.tax_amount     is distinct from old.tax_amount
       or new.tax_rate       is distinct from old.tax_rate
       or new.contract_id    is distinct from old.contract_id
       or new.issue_date     is distinct from old.issue_date
       or new.due_date       is distinct from old.due_date
       or new.billing_period_start is distinct from old.billing_period_start
       or new.billing_period_end   is distinct from old.billing_period_end
       or new.charge_type    is distinct from old.charge_type
       or new.document_status is distinct from old.document_status
    then
      raise exception 'POSTED_INVOICE_IMMUTABLE: financially meaningful invoice fields are immutable after POSTING; post a credit/reversal instead.'
        using errcode = '42501';
    end if;
    -- Reference is assigned once and never changes.
    if old.reference is not null and new.reference is distinct from old.reference then
      raise exception 'POSTED_INVOICE_REFERENCE_IMMUTABLE: invoice reference cannot change after assignment.'
        using errcode = '42501';
    end if;
  end if;

  -- DRAFT -> POSTED requires the financial fields to be present.
  if tg_op = 'UPDATE' and old.document_status = 'DRAFT' and new.document_status = 'POSTED' then
    if new.amount is null or new.issue_date is null or new.due_date is null
       or new.billing_period_start is null or new.billing_period_end is null then
      raise exception 'INVOICE_POST_REQUIRES_FINANCIAL_FIELDS: amount, dates and billing period are required to POST an invoice.'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_invoice_document_integrity on public.invoices;
create trigger trg_invoice_document_integrity
  before update or delete on public.invoices
  for each row execute function public.invoice_document_integrity();

-- ---------------------------------------------------------------------------
-- 6. Revoke browser-direct invoice writes. Financial invoice mutation must flow
--    through server-side SECURITY DEFINER RPCs (payment posting, credit/reversal).
--    Select remains available. The posting engine runs as the function owner and
--    is unaffected by these grants.
-- ---------------------------------------------------------------------------
drop policy if exists manager_write_invoices on public.invoices;
revoke insert, update, delete on table public.invoices from authenticated;

-- ---------------------------------------------------------------------------
-- 7. Deterministic, idempotent, concurrent-safe recurring invoice generation.
--    issue_date anchors to the contract billing_day in the current period; due
--    date = billing_period_end + grace_days. A per-contract advisory lock
--    serializes generation; the unique billing obligation index is the final
--    protection against duplicate recurring charges.
-- ---------------------------------------------------------------------------
create or replace function public.generate_invoices_from_active_contracts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
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
  v_issue_date date;
  v_due_date date;
  v_billing_day integer;
  v_grace_days integer;
  v_lines jsonb;
  v_invoice_exists boolean;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to generate invoices' using errcode = '42501';
  end if;
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_company_id is null then
    raise exception 'Company context is required (no company_id claim in JWT).' using errcode = '42501';
  end if;
  v_ar_account_id := public.require_company_account_id(v_company_id, '1201');
  v_revenue_account_id := public.require_company_account_id(v_company_id, '4000');
  select case when vat_enabled then coalesce(vat_rate, 0) else 0 end
    into v_tax_rate
    from public.company_settings
    where company_id = v_company_id
    limit 1;
  if v_tax_rate is null then
    v_tax_rate := 0;
  end if;
  if v_tax_rate > 0 then
    v_vat_account_id := public.require_company_account_id(v_company_id, '2100');
  end if;
  for v_contract in
    select c.id, c.rent_amount, c.payment_cycle, c.billing_day, c.grace_days
    from public.contracts c
    where c.deleted_at is null
      and lower(c.status) = 'active'
      and c.company_id = v_company_id
    order by c.id
  loop
    -- Serialize generation per contract so concurrent attempts cannot both pass
    -- the existence check.
    perform pg_advisory_xact_lock(hashtext('invoice_generation:' || v_contract.id::text));
    case v_contract.payment_cycle
      when 'monthly' then
        v_period_start := date_trunc('month', current_date)::date;
        v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
      when 'quarterly' then
        v_period_start := date_trunc('quarter', current_date)::date;
        v_period_end := (date_trunc('quarter', current_date) + interval '3 months' - interval '1 day')::date;
      when 'semi_annual' then
        if extract(month from current_date) <= 6 then
          v_period_start := make_date(extract(year from current_date)::int, 1, 1);
          v_period_end := make_date(extract(year from current_date)::int, 6, 30);
        else
          v_period_start := make_date(extract(year from current_date)::int, 7, 1);
          v_period_end := make_date(extract(year from current_date)::int, 12, 31);
        end if;
      when 'annual' then
        v_period_start := date_trunc('year', current_date)::date;
        v_period_end := (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date;
      else
        v_period_start := date_trunc('month', current_date)::date;
        v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
    end case;

    -- Deterministic billing & due dates from contract policy (billing_day 1..28,
    -- which is always valid in every month; clamp to period end for short cycles).
    v_billing_day := coalesce(v_contract.billing_day, 1);
    v_grace_days := coalesce(v_contract.grace_days, 0);
    v_issue_date := least(
      make_date(extract(year from v_period_start)::int, extract(month from v_period_start)::int, v_billing_day),
      v_period_end
    );
    v_due_date := v_period_end + v_grace_days;

    -- Existence check (authoritative under the per-contract advisory lock);
    -- the ux_invoices_billing_obligation index is the final DB protection.
    select exists(
      select 1 from public.invoices i
      where i.contract_id = v_contract.id
        and i.charge_type = 'RENT'
        and i.billing_period_start = v_period_start
        and i.deleted_at is null
        and i.document_status not in ('VOIDED','REVERSED')
    ) into v_invoice_exists;
    if v_invoice_exists then
      continue;
    end if;

    -- Authoritative OMR 3dp tax.
    v_tax_amount := round(v_contract.rent_amount * v_tax_rate / 100, 3);
    v_total_amount := v_contract.rent_amount + v_tax_amount;
    insert into public.invoices (
      contract_id, issue_date, due_date, amount, tax_amount, tax_rate, status
    , company_id, document_status, charge_type, billing_period_start, billing_period_end
    ) values (
      v_contract.id,
      v_issue_date,
      v_due_date,
      v_contract.rent_amount,
      v_tax_amount,
      v_tax_rate,
      'UNPAID'
    , v_company_id, 'POSTED', 'RENT', v_period_start, v_period_end)
    returning id into v_invoice_id;

    -- Post the invoice journal through the canonical posting engine.
    v_lines := jsonb_build_array(
      jsonb_build_object(
        'account_id', v_ar_account_id,
        'debit', v_total_amount,
        'credit', 0,
        'line_description', 'INV-' || v_invoice_id::text || '-DR',
        'ref_source_id', v_invoice_id::text,
        'ref_entity_type', 'invoice',
        'ref_entity_id', v_invoice_id::text
      ),
      jsonb_build_object(
        'account_id', v_revenue_account_id,
        'debit', 0,
        'credit', v_contract.rent_amount,
        'line_description', 'INV-' || v_invoice_id::text || '-CR-REV',
        'ref_source_id', v_invoice_id::text,
        'ref_entity_type', 'invoice',
        'ref_entity_id', v_invoice_id::text
      )
    );
    if v_tax_amount > 0 and v_vat_account_id is not null then
      v_lines := v_lines || jsonb_build_object(
        'account_id', v_vat_account_id,
        'debit', 0,
        'credit', v_tax_amount,
        'line_description', 'INV-' || v_invoice_id::text || '-CR-VAT',
        'ref_source_id', v_invoice_id::text,
        'ref_entity_type', 'invoice',
        'ref_entity_id', v_invoice_id::text
      );
    end if;
    -- Ensure an open accounting period exists for the invoice effective date
    -- (bootstraps the first period only when the company has none).
    perform public.gl_ensure_initial_open_period(v_company_id, v_issue_date);
    perform public.post_journal_event(jsonb_build_object(
      'company_id', v_company_id,
      'source_type', 'invoice',
      'source_id', v_invoice_id::text,
      'event_id', v_invoice_id::text,
      'effective_date', v_issue_date,
      'description', 'Rent invoice ' || v_invoice_id::text,
      'lines', v_lines
    ));
    v_count := v_count + 1;
  end loop;
  if v_count > 0 then
    insert into public.audit_log (
      id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
    ) values (
      gen_random_uuid()::text,
      extract(epoch from now())::bigint,
      auth.uid(),
      (select email from auth.users where id = auth.uid()),
      'GENERATE',
      'invoices',
      'batch',
      format('Generated %s invoices from active contracts', v_count),
      'invoices',
      jsonb_build_object('count', v_count, 'tax_rate', v_tax_rate)::text,
      now()
    );
  end if;
  return v_count;
end;
$function$;

alter function public.generate_invoices_from_active_contracts() owner to postgres;

-- ---------------------------------------------------------------------------
-- 8. SECURITY DEFINER trigger helpers are internal only; revoke execution from
--    client roles so they are never callable by anon/public/authenticated.
-- ---------------------------------------------------------------------------
revoke all on function public.invoice_lineage_guard() from public, anon, authenticated;
revoke all on function public.invoice_document_integrity() from public, anon, authenticated;
revoke all on function public.generate_invoices_from_active_contracts() from public, anon;

commit;
