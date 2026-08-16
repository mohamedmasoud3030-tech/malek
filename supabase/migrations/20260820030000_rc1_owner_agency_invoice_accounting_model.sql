-- ============================================================================
-- RC1 — Owner-agency invoice accounting model, immutable lineage and tax binding
-- ============================================================================
--
-- Forward correction for the RC1 recurring-invoice path.
--
-- The preceding Phase 1/2 generator posted every active contract as:
--   Dr 1201 Tenant Receivable / Cr 4000 Sublease Rental Revenue
-- irrespective of the frozen owner-agency collection role. That conflicts with
-- FIN-001, FIN-003 and FIN-004: RC1 owner-agency is an agent-net model, and
-- 4000 is reserved for a separately implemented principal/sublease event.
--
-- This migration intentionally does not rewrite any existing invoice or journal
-- history. New recurring invoices are classified server-side from the immutable
-- contract snapshot; historical detection is provided by the read-only report
-- at the end of this migration.
--
-- Tax authority is resolved exclusively through effective-dated
-- company_tax_profiles. A profile is required for every recurring invoice:
-- VAT/VAT_ZERO represents a taxable configuration, while the explicit
-- NON_TAXABLE catalogue code represents a configured non-taxable treatment.
-- No company_settings VAT rate or boolean participates in posting.
-- ============================================================================

begin;

-- An explicit configuration option, not a statutory assumption. Companies must
-- still create and approve an effective profile before it can be used.
insert into public.tax_code_catalog (code, name_ar, name_en, description)
values ('NON_TAXABLE', 'غير خاضع للضريبة', 'Non-taxable', 'Explicit non-taxable treatment; rate remains configuration-owned at 0.000.')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 1. Immutable, typed invoice accounting/tax lineage and owner-funds events.
--    The event subledger is the forward-looking operational control for 2000;
--    it never rewrites the legacy owner_balances cache.
-- ---------------------------------------------------------------------------
create table if not exists public.owner_funds_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  owner_id uuid not null references public.owners(id) on delete restrict,
  contract_id uuid references public.contracts(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete restrict,
  source_type text not null check (source_type in (
    'OFFICE_INVOICE',
    'OWNER_COLLECTION',
    'MANAGEMENT_FEE',
    'INVOICE_CREDIT',
    'INVOICE_CREDIT_REVERSAL',
    'RECEIPT_VOID_REVERSAL',
    'OWNER_SETTLEMENT_PAYOUT'
  )),
  source_id text not null,
  event_id text not null,
  amount_delta numeric(18,3) not null check (
    amount_delta <> 0 and amount_delta = round(amount_delta, 3)
  ),
  effective_date date not null,
  journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint owner_funds_events_source_uq unique (company_id, source_type, source_id, event_id)
);

create index if not exists owner_funds_events_company_date_idx
  on public.owner_funds_events (company_id, effective_date, owner_id);

alter table public.owner_funds_events enable row level security;
drop policy if exists owner_funds_events_company_read on public.owner_funds_events;
create policy owner_funds_events_company_read on public.owner_funds_events
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_admin_or_manager() or public.is_accountant())
  );
revoke all on table public.owner_funds_events from public, anon, authenticated;
grant select on table public.owner_funds_events to authenticated;

create or replace function public.guard_owner_funds_event_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'OWNER_FUNDS_EVENT_IMMUTABLE: owner-funds control events are append-only; use a compensating event.'
      using errcode='42501';
  end if;
  return new;
end;
$function$;

alter function public.guard_owner_funds_event_immutable() owner to postgres;
revoke all on function public.guard_owner_funds_event_immutable() from public, anon, authenticated;
drop trigger if exists trg_owner_funds_event_immutable on public.owner_funds_events;
create trigger trg_owner_funds_event_immutable
before update or delete on public.owner_funds_events
for each row execute function public.guard_owner_funds_event_immutable();

create or replace function public.guard_owner_funds_event_lineage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not exists (
    select 1 from public.owners o where o.id = new.owner_id and o.company_id = new.company_id
  ) then
    raise exception 'OWNER_FUNDS_EVENT_OWNER_COMPANY_MISMATCH' using errcode='42501';
  end if;
  if new.contract_id is not null and not exists (
    select 1 from public.contracts c where c.id = new.contract_id and c.company_id = new.company_id
  ) then
    raise exception 'OWNER_FUNDS_EVENT_CONTRACT_COMPANY_MISMATCH' using errcode='42501';
  end if;
  if new.invoice_id is not null and not exists (
    select 1 from public.invoices i where i.id = new.invoice_id and i.company_id = new.company_id
  ) then
    raise exception 'OWNER_FUNDS_EVENT_INVOICE_COMPANY_MISMATCH' using errcode='42501';
  end if;
  if new.journal_batch_id is not null and not exists (
    select 1 from public.journal_batches b where b.id = new.journal_batch_id and b.company_id = new.company_id
  ) then
    raise exception 'OWNER_FUNDS_EVENT_BATCH_COMPANY_MISMATCH' using errcode='42501';
  end if;
  return new;
end;
$function$;

alter function public.guard_owner_funds_event_lineage() owner to postgres;
revoke all on function public.guard_owner_funds_event_lineage() from public, anon, authenticated;
drop trigger if exists trg_owner_funds_event_lineage on public.owner_funds_events;
create trigger trg_owner_funds_event_lineage
before insert on public.owner_funds_events
for each row execute function public.guard_owner_funds_event_lineage();

alter table public.invoices
  add column if not exists invoice_agreement_version_id uuid
    references public.owner_agreement_versions(id) on delete restrict,
  add column if not exists invoice_operating_model text,
  add column if not exists invoice_collection_role text,
  add column if not exists invoice_accounting_classification text,
  add column if not exists invoice_posting_batch_id uuid
    references public.journal_batches(id) on delete restrict,
  add column if not exists tax_treatment text,
  add column if not exists tax_profile_id uuid
    references public.company_tax_profiles(id) on delete restrict,
  add column if not exists tax_snapshot_id uuid
    references public.taxable_line_tax_snapshots(id) on delete restrict,
  add column if not exists tax_code text,
  add column if not exists tax_basis text;

alter table public.invoices
  drop constraint if exists invoices_invoice_operating_model_check;
alter table public.invoices
  add constraint invoices_invoice_operating_model_check check (
    invoice_operating_model is null
    or invoice_operating_model in ('OWNER_AGENCY')
  );

alter table public.invoices
  drop constraint if exists invoices_invoice_collection_role_check;
alter table public.invoices
  add constraint invoices_invoice_collection_role_check check (
    invoice_collection_role is null
    or invoice_collection_role in ('OWNER_IS_CREDITOR', 'OFFICE_IS_CREDITOR')
  );

alter table public.invoices
  drop constraint if exists invoices_invoice_accounting_classification_check;
alter table public.invoices
  add constraint invoices_invoice_accounting_classification_check check (
    invoice_accounting_classification is null
    or invoice_accounting_classification in (
      'OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL',
      'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS'
    )
  );

alter table public.invoices
  drop constraint if exists invoices_tax_treatment_check;
alter table public.invoices
  add constraint invoices_tax_treatment_check check (
    tax_treatment is null or tax_treatment in ('TAXABLE', 'NON_TAXABLE')
  );

alter table public.invoices
  drop constraint if exists invoices_tax_basis_check;
alter table public.invoices
  add constraint invoices_tax_basis_check check (
    tax_basis is null or tax_basis in ('NET_PLUS_TAX', 'NON_TAXABLE')
  );

create index if not exists invoices_rc1_accounting_classification_idx
  on public.invoices (company_id, invoice_accounting_classification, issue_date)
  where deleted_at is null;
create index if not exists invoices_rc1_posting_batch_idx
  on public.invoices (invoice_posting_batch_id)
  where invoice_posting_batch_id is not null;

-- Existing rows predate the authoritative invoice snapshots. They are left
-- null, immutable and visible to the diagnostic report rather than backfilled
-- from mutable/current agreement data.
comment on column public.invoices.invoice_accounting_classification is
  'RC1 immutable server-derived invoice accounting model. Null denotes pre-RC1 historical lineage requiring evidence-based review.';
comment on column public.invoices.invoice_posting_batch_id is
  'Canonical journal batch created by this invoice posting. Null is authoritative only for OWNER_IS_CREDITOR operational invoices.';
comment on column public.invoices.tax_snapshot_id is
  'Immutable taxable_line_tax_snapshots row for a TAXABLE RC1 invoice; credits reverse this original lineage rather than current tax configuration.';

-- ---------------------------------------------------------------------------
-- 2. Invoice/tax snapshot append-only and company-coherence guards.
-- ---------------------------------------------------------------------------
create or replace function public.guard_taxable_line_tax_snapshot_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'TAX_SNAPSHOT_IMMUTABLE: taxable tax snapshots are append-only; post a controlled compensating event instead.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

alter function public.guard_taxable_line_tax_snapshot_immutable() owner to postgres;
revoke all on function public.guard_taxable_line_tax_snapshot_immutable() from public, anon, authenticated;
drop trigger if exists trg_taxable_line_tax_snapshot_immutable on public.taxable_line_tax_snapshots;
create trigger trg_taxable_line_tax_snapshot_immutable
before update or delete on public.taxable_line_tax_snapshots
for each row execute function public.guard_taxable_line_tax_snapshot_immutable();

create or replace function public.guard_invoice_rc1_accounting_lineage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_contract public.contracts%rowtype;
  v_profile public.company_tax_profiles%rowtype;
  v_snapshot public.taxable_line_tax_snapshots%rowtype;
  v_batch public.journal_batches%rowtype;
  v_ar numeric := 0;
  v_ofp numeric := 0;
  v_vat numeric := 0;
  v_sublease numeric := 0;
begin
  -- Historical invoices have no RC1 classification and are intentionally not
  -- inferred/backfilled. This trigger protects only the new authoritative path.
  if new.invoice_accounting_classification is null then
    return new;
  end if;

  select * into v_contract
    from public.contracts
   where id = new.contract_id
     and company_id = new.company_id
     and deleted_at is null;
  if not found then
    raise exception 'INVOICE_RC1_CONTRACT_COMPANY_MISMATCH' using errcode = '42501';
  end if;

  if new.invoice_agreement_version_id is null
     or new.invoice_agreement_version_id is distinct from v_contract.agreement_version_id
     or new.invoice_operating_model is distinct from v_contract.operating_model_snapshot
     or new.invoice_collection_role is distinct from v_contract.collection_role_snapshot then
    raise exception 'INVOICE_RC1_CONTRACT_SNAPSHOT_MISMATCH: invoice accounting lineage must equal the immutable contract snapshot.'
      using errcode = '23514';
  end if;

  if new.invoice_operating_model <> 'OWNER_AGENCY' then
    raise exception 'RC1_OPERATING_MODEL_EXCLUDED: only OWNER_AGENCY recurring invoices are in the RC1 posting scope.'
      using errcode = '23514';
  end if;

  if (new.invoice_collection_role = 'OWNER_IS_CREDITOR'
        and new.invoice_accounting_classification <> 'OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL')
     or (new.invoice_collection_role = 'OFFICE_IS_CREDITOR'
        and new.invoice_accounting_classification <> 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS') then
    raise exception 'INVOICE_RC1_ACCOUNTING_CLASSIFICATION_MISMATCH' using errcode = '23514';
  end if;

  if new.document_status <> 'POSTED' then
    return new;
  end if;

  if new.tax_treatment is null or new.tax_basis is null then
    raise exception 'INVOICE_RC1_TAX_LINEAGE_REQUIRED: posted RC1 invoices require an explicit tax treatment and basis.'
      using errcode = '23514';
  end if;

  if new.tax_profile_id is null
     or new.tax_snapshot_id is null
     or new.tax_code is null then
    raise exception 'INVOICE_RC1_TAX_PROFILE_AND_SNAPSHOT_REQUIRED: every RC1 invoice needs an effective configured tax treatment.'
      using errcode = '23514';
  end if;

  select * into v_profile
    from public.company_tax_profiles
   where id = new.tax_profile_id
     and company_id = new.company_id;
  if not found
     or v_profile.tax_code is distinct from new.tax_code
     or v_profile.tax_rate is distinct from new.tax_rate then
    raise exception 'INVOICE_RC1_TAX_PROFILE_COHERENCE_INVALID' using errcode = '23514';
  end if;

  select * into v_snapshot
    from public.taxable_line_tax_snapshots
   where id = new.tax_snapshot_id
     and company_id = new.company_id
     and source_type = 'invoice'
     and source_id = new.id::text;
  if not found
     or v_snapshot.tax_code is distinct from new.tax_code
     or v_snapshot.tax_rate is distinct from new.tax_rate
     or v_snapshot.net_amount is distinct from new.amount
     or v_snapshot.tax_amount is distinct from new.tax_amount
     or v_snapshot.effective_date is distinct from new.issue_date then
    raise exception 'INVOICE_RC1_TAX_SNAPSHOT_COHERENCE_INVALID' using errcode = '23514';
  end if;

  if new.tax_treatment = 'NON_TAXABLE' then
    if coalesce(new.tax_amount, 0) <> 0
       or coalesce(new.tax_rate, 0) <> 0
       or new.tax_code <> 'NON_TAXABLE'
       or new.tax_basis <> 'NON_TAXABLE' then
      raise exception 'INVOICE_RC1_NON_TAXABLE_LINEAGE_INVALID' using errcode = '23514';
    end if;
  elsif new.tax_treatment = 'TAXABLE' then
    if new.tax_code = 'NON_TAXABLE' or new.tax_basis <> 'NET_PLUS_TAX' then
      raise exception 'INVOICE_RC1_TAXABLE_LINEAGE_INCOMPLETE' using errcode = '23514';
    end if;
  else
    raise exception 'INVOICE_RC1_TAX_TREATMENT_INVALID' using errcode = '23514';
  end if;

  if new.invoice_accounting_classification = 'OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL' then
    if new.invoice_posting_batch_id is not null then
      raise exception 'INVOICE_RC1_OWNER_CREDITOR_NO_INVOICE_GL: OWNER_IS_CREDITOR rent remains an operational tenant obligation until collection.'
        using errcode = '23514';
    end if;
    if exists (
      select 1
        from public.journal_batches b
       where b.company_id = new.company_id
         and b.source_type = 'invoice'
         and b.source_id = new.id::text
    ) then
      raise exception 'INVOICE_RC1_OWNER_CREDITOR_UNEXPECTED_INVOICE_GL' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.invoice_posting_batch_id is null then
    raise exception 'INVOICE_RC1_OFFICE_CREDITOR_BATCH_REQUIRED' using errcode = '23514';
  end if;

  select * into v_batch
    from public.journal_batches
   where id = new.invoice_posting_batch_id
     and company_id = new.company_id
     and source_type = 'invoice'
     and source_id = new.id::text
     and status = 'POSTED';
  if not found then
    raise exception 'INVOICE_RC1_POSTING_BATCH_LINEAGE_INVALID' using errcode = '23514';
  end if;

  select
    coalesce(sum(jl.debit) filter (where a.no = '1201'), 0),
    coalesce(sum(jl.credit) filter (where a.no = '2000'), 0),
    coalesce(sum(jl.credit) filter (where a.no = '2100'), 0),
    coalesce(sum(jl.credit) filter (where a.no = '4000'), 0)
  into v_ar, v_ofp, v_vat, v_sublease
  from public.journal_lines jl
  join public.accounts a on a.id = jl.account_id and a.company_id = new.company_id
  where jl.batch_id = new.invoice_posting_batch_id
    and jl.company_id = new.company_id;

  if round(v_ar, 3) <> round(new.amount + coalesce(new.tax_amount, 0), 3)
     or round(v_ofp, 3) <> round(new.amount, 3)
     or round(v_vat, 3) <> round(coalesce(new.tax_amount, 0), 3)
     or round(v_sublease, 3) <> 0 then
    raise exception 'INVOICE_RC1_OFFICE_CREDITOR_POSTING_SHAPE_INVALID: expected Dr 1201 / Cr 2000 (+ Cr 2100), never 4000.'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

alter function public.guard_invoice_rc1_accounting_lineage() owner to postgres;
revoke all on function public.guard_invoice_rc1_accounting_lineage() from public, anon, authenticated;
drop trigger if exists trg_invoice_rc1_accounting_lineage on public.invoices;
create trigger trg_invoice_rc1_accounting_lineage
before insert or update of
  document_status,
  invoice_agreement_version_id,
  invoice_operating_model,
  invoice_collection_role,
  invoice_accounting_classification,
  invoice_posting_batch_id,
  tax_treatment,
  tax_profile_id,
  tax_snapshot_id,
  tax_code,
  tax_basis
on public.invoices
for each row execute function public.guard_invoice_rc1_accounting_lineage();

-- Extend the existing posted-document guard so a new invoice cannot have its
-- authoritative accounting/tax identity silently rewritten after posting.
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

  if tg_op = 'UPDATE' and old.document_status = 'POSTED' then
    if new.amount is distinct from old.amount
       or new.tax_amount is distinct from old.tax_amount
       or new.tax_rate is distinct from old.tax_rate
       or new.contract_id is distinct from old.contract_id
       or new.issue_date is distinct from old.issue_date
       or new.due_date is distinct from old.due_date
       or new.billing_period_start is distinct from old.billing_period_start
       or new.billing_period_end is distinct from old.billing_period_end
       or new.charge_type is distinct from old.charge_type
       or new.document_status is distinct from old.document_status
       or new.invoice_agreement_version_id is distinct from old.invoice_agreement_version_id
       or new.invoice_operating_model is distinct from old.invoice_operating_model
       or new.invoice_collection_role is distinct from old.invoice_collection_role
       or new.invoice_accounting_classification is distinct from old.invoice_accounting_classification
       or new.invoice_posting_batch_id is distinct from old.invoice_posting_batch_id
       or new.tax_treatment is distinct from old.tax_treatment
       or new.tax_profile_id is distinct from old.tax_profile_id
       or new.tax_snapshot_id is distinct from old.tax_snapshot_id
       or new.tax_code is distinct from old.tax_code
       or new.tax_basis is distinct from old.tax_basis
    then
      raise exception 'POSTED_INVOICE_IMMUTABLE: financially meaningful invoice fields are immutable after POSTING; post a credit/reversal instead.'
        using errcode = '42501';
    end if;
    if old.reference is not null and new.reference is distinct from old.reference then
      raise exception 'POSTED_INVOICE_REFERENCE_IMMUTABLE: invoice reference cannot change after assignment.'
        using errcode = '42501';
    end if;
  end if;

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

alter function public.invoice_document_integrity() owner to postgres;
revoke all on function public.invoice_document_integrity() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Recurring invoice generation: model-specific posting, versioned tax.
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
  v_tax_snapshot_id uuid;
  v_owner_id uuid;
  v_taxable boolean;
  v_tax_profile_id uuid;
  v_tax_code text;
  v_tax_rate numeric := 0;
  v_tax_amount numeric := 0;
  v_total_amount numeric;
  v_ar_account_id text;
  v_owner_funds_account_id text;
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
  v_classification text;
  v_post_result jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to generate invoices' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  for v_contract in
    select c.id,
           c.rent_amount,
           c.payment_cycle,
           c.billing_day,
           c.grace_days,
           c.agreement_version_id,
           c.operating_model_snapshot,
           c.collection_role_snapshot,
           oa.owner_id
      from public.contracts c
      join public.owner_agreements oa
        on oa.id = c.agreement_id
       and oa.company_id = c.company_id
     where c.deleted_at is null
       and lower(c.status) = 'active'
       and c.company_id = v_company_id
     order by c.id
  loop
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

    v_billing_day := coalesce(v_contract.billing_day, 1);
    v_grace_days := coalesce(v_contract.grace_days, 0);
    v_issue_date := least(
      make_date(extract(year from v_period_start)::int, extract(month from v_period_start)::int, v_billing_day),
      v_period_end
    );
    v_due_date := v_period_end + v_grace_days;

    select exists(
      select 1
        from public.invoices i
       where i.contract_id = v_contract.id
         and i.charge_type = 'RENT'
         and i.billing_period_start = v_period_start
         and i.deleted_at is null
         and i.document_status not in ('VOIDED','REVERSED')
    ) into v_invoice_exists;
    if v_invoice_exists then
      continue;
    end if;

    if v_contract.operating_model_snapshot is distinct from 'OWNER_AGENCY'
       or v_contract.agreement_version_id is null
       or v_contract.collection_role_snapshot not in ('OWNER_IS_CREDITOR', 'OFFICE_IS_CREDITOR') then
      raise exception 'RC1_INVOICE_GENERATION_MODEL_UNAVAILABLE: active contract % is not a fully snapshotted OWNER_AGENCY contract in the RC1 scope.', v_contract.id
        using errcode = '23514';
    end if;

    v_owner_id := v_contract.owner_id;
    if v_owner_id is null then
      raise exception 'RC1_OWNER_FUNDS_OWNER_REQUIRED: owner-agency invoice requires an owner-scoped agreement.'
        using errcode = '23514';
    end if;

    v_classification := case v_contract.collection_role_snapshot
      when 'OWNER_IS_CREDITOR' then 'OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL'
      when 'OFFICE_IS_CREDITOR' then 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS'
      else null
    end;

    -- Every recurring invoice resolves an effective profile. This is the sole
    -- rate/code authority: no company_settings fallback exists.
    select profile_id, tax_code, tax_rate
      into v_tax_profile_id, v_tax_code, v_tax_rate
      from public.resolve_active_tax_profile(v_company_id, v_issue_date);
    v_taxable := v_tax_code <> 'NON_TAXABLE';
    v_tax_amount := public.compute_tax_amount(v_contract.rent_amount, v_tax_rate);
    if not v_taxable and (v_tax_rate <> 0 or v_tax_amount <> 0) then
      raise exception 'INVOICE_NON_TAXABLE_PROFILE_RATE_INVALID: NON_TAXABLE profiles must be configured at 0.000.'
        using errcode = '23514';
    end if;
    v_total_amount := public.gl_pm_round_omr(v_contract.rent_amount + v_tax_amount);

    -- Insert DRAFT first so the invoice id is available to the canonical batch
    -- and tax snapshot. It becomes POSTED only after every immutable lineage
    -- link is written in this same transaction.
    insert into public.invoices (
      contract_id,
      issue_date,
      due_date,
      amount,
      tax_amount,
      tax_rate,
      status,
      company_id,
      document_status,
      charge_type,
      billing_period_start,
      billing_period_end,
      invoice_agreement_version_id,
      invoice_operating_model,
      invoice_collection_role,
      invoice_accounting_classification,
      tax_treatment,
      tax_profile_id,
      tax_code,
      tax_basis
    ) values (
      v_contract.id,
      v_issue_date,
      v_due_date,
      v_contract.rent_amount,
      v_tax_amount,
      v_tax_rate,
      'UNPAID',
      v_company_id,
      'DRAFT',
      'RENT',
      v_period_start,
      v_period_end,
      v_contract.agreement_version_id,
      v_contract.operating_model_snapshot,
      v_contract.collection_role_snapshot,
      v_classification,
      case when v_taxable then 'TAXABLE' else 'NON_TAXABLE' end,
      v_tax_profile_id,
      v_tax_code,
      case when v_taxable then 'NET_PLUS_TAX' else 'NON_TAXABLE' end
    )
    returning id into v_invoice_id;

    -- Invoice issuance is a controlled financial obligation even when the
    -- OWNER_IS_CREDITOR document is operational-only. Resolve the period here
    -- so OPEN/SOFT_CLOSED/HARD_CLOSED and late-posting rules apply uniformly.
    perform public.gl_ensure_initial_open_period(v_company_id, v_issue_date);
    perform 1 from public.gl_resolve_accounting_period(v_company_id, v_issue_date);

    v_batch_id := null;
    if v_classification = 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS' then
      v_ar_account_id := public.require_company_account_id(v_company_id, '1201');
      v_owner_funds_account_id := public.require_company_account_id(v_company_id, '2000');
      v_lines := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_ar_account_id,
          'debit', v_total_amount,
          'credit', 0,
          'line_description', 'INV-' || v_invoice_id::text || '-DR-AR',
          'ref_source_id', v_invoice_id::text,
          'ref_entity_type', 'invoice',
          'ref_entity_id', v_invoice_id::text
        ),
        jsonb_build_object(
          'account_id', v_owner_funds_account_id,
          'debit', 0,
          'credit', v_contract.rent_amount,
          'line_description', 'INV-' || v_invoice_id::text || '-CR-OWNER-FUNDS',
          'ref_source_id', v_invoice_id::text,
          'ref_entity_type', 'invoice',
          'ref_entity_id', v_invoice_id::text
        )
      );
      if v_tax_amount > 0 then
        v_vat_account_id := public.require_company_account_id(v_company_id, '2100');
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object(
            'account_id', v_vat_account_id,
            'debit', 0,
            'credit', v_tax_amount,
            'line_description', 'INV-' || v_invoice_id::text || '-CR-VAT',
            'ref_source_id', v_invoice_id::text,
            'ref_entity_type', 'invoice',
            'ref_entity_id', v_invoice_id::text
          )
        );
      end if;

      perform public.gl_ensure_initial_open_period(v_company_id, v_issue_date);
      v_post_result := public.post_journal_event(jsonb_build_object(
        'company_id', v_company_id,
        'source_type', 'invoice',
        'source_id', v_invoice_id::text,
        'event_id', v_invoice_id::text,
        'effective_date', v_issue_date,
        'description', 'OWNER_AGENCY OFFICE_IS_CREDITOR rent invoice ' || v_invoice_id::text,
        'lines', v_lines
      ));
      v_batch_id := nullif(v_post_result->>'batch_id', '')::uuid;
      if v_batch_id is null then
        raise exception 'INVOICE_RC1_POSTING_BATCH_MISSING' using errcode = 'P0001';
      end if;
    end if;

    v_tax_snapshot_id := null;
    -- Store the resolved profile even for an explicit NON_TAXABLE invoice so
    -- future credits never infer a treatment from changed company settings.
    insert into public.taxable_line_tax_snapshots (
        company_id,
        source_type,
        source_id,
        journal_batch_id,
        account_no,
        tax_code,
        tax_rate,
        net_amount,
        tax_amount,
        effective_date
      ) values (
        v_company_id,
        'invoice',
        v_invoice_id::text,
        v_batch_id,
        '2100',
        v_tax_code,
        v_tax_rate,
        v_contract.rent_amount,
        v_tax_amount,
        v_issue_date
      )
      returning id into v_tax_snapshot_id;

    update public.invoices
       set invoice_posting_batch_id = v_batch_id,
           tax_snapshot_id = v_tax_snapshot_id,
           document_status = 'POSTED',
           updated_at = now()
     where id = v_invoice_id
       and company_id = v_company_id;

    if v_classification = 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS' then
      insert into public.owner_funds_events (
        company_id, owner_id, contract_id, invoice_id, source_type, source_id,
        event_id, amount_delta, effective_date, journal_batch_id
      ) values (
        v_company_id, v_owner_id, v_contract.id, v_invoice_id, 'OFFICE_INVOICE',
        v_invoice_id::text, 'issue', v_contract.rent_amount, v_issue_date, v_batch_id
      );
    end if;

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
      format('Generated %s RC1 owner-agency invoices from active contracts', v_count),
      'invoices',
      jsonb_build_object('count', v_count, 'taxability', case when v_taxable then 'TAXABLE' else 'NON_TAXABLE' end)::text,
      now()
    );
  end if;

  return v_count;
end;
$function$;

alter function public.generate_invoices_from_active_contracts() owner to postgres;
revoke all on function public.generate_invoices_from_active_contracts() from public, anon;
grant execute on function public.generate_invoices_from_active_contracts() to authenticated, service_role;
comment on function public.generate_invoices_from_active_contracts() is
  'RC1 server-owned recurring OWNER_AGENCY invoice generation. OWNER_IS_CREDITOR remains operational at invoice issuance; OFFICE_IS_CREDITOR posts Dr 1201 / Cr 2000 (+2100). 4000 is never selected.';

-- ---------------------------------------------------------------------------
-- 4. 1201 subledger scope: only invoices that actually create Tenant AR in GL
--    reconcile to the 1201 control. Legacy null-classification rows remain
--    included only when their historical source batch contains 1201, keeping
--    existing history visible rather than silently removing a variance.
-- ---------------------------------------------------------------------------
create or replace function public.wp05_subledger_tenant_receivables(
  p_company_id uuid,
  p_as_of date default current_date
)
returns table (balance numeric, cnt bigint)
language plpgsql
stable
set search_path = public, pg_temp
as $function$
declare
  v_bal numeric;
  v_cnt bigint;
begin
  if p_company_id is null then
    raise exception 'WP05_SUBLEDGER_TENANT_REQUIRED: company_id required' using errcode='22023';
  end if;

  select
    public.wp05_round_omr(coalesce(sum(
      greatest((i.amount + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0) - coalesce(i.credited_amount,0)), 0)
    ),0)),
    count(*) filter (where greatest((i.amount + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0) - coalesce(i.credited_amount,0)),0) > 0.0005)::bigint
  into v_bal, v_cnt
  from public.invoices i
  where i.company_id = p_company_id
    and i.deleted_at is null
    and coalesce(upper(i.status::text),'') not in ('VOID','VOIDED','CANCELLED')
    and i.issue_date <= p_as_of
    and (i.amount + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0) - coalesce(i.credited_amount,0)) > 0.0005
    and (
      i.invoice_accounting_classification = 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS'
      or (
        i.invoice_accounting_classification is null
        and exists (
          select 1
            from public.journal_batches b
            join public.journal_lines jl on jl.batch_id = b.id and jl.company_id = i.company_id
            join public.accounts a on a.id = jl.account_id and a.company_id = i.company_id
           where b.company_id = i.company_id
             and b.source_type = 'invoice'
             and b.source_id = i.id::text
             and a.no = '1201'
        )
      )
    );

  return query select coalesce(v_bal,0)::numeric, coalesce(v_cnt,0)::bigint;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. 2000 owner-funds control subledger. Once a company has RC1 owner-funds
--    events, they are the only authoritative forward operational basis. A
--    company with no such events retains the historical owner_balances fallback
--    so pre-RC1 variances stay visible for S08 rather than being hidden.
-- ---------------------------------------------------------------------------
create or replace function public.wp05_subledger_owner_payables(
  p_company_id uuid,
  p_as_of date default current_date
)
returns table (balance numeric, cnt bigint)
language plpgsql
stable
set search_path = public, pg_temp
as $function$
declare
  v_bal numeric;
  v_cnt bigint;
begin
  if p_company_id is null then
    raise exception 'WP05_SUBLEDGER_OWNER_REQUIRED: company_id required' using errcode='22023';
  end if;

  if exists (select 1 from public.owner_funds_events e where e.company_id = p_company_id) then
    select
      public.wp05_round_omr(coalesce(sum(e.amount_delta), 0)),
      count(*) filter (where abs(e.amount_delta) > 0.0005)::bigint
    into v_bal, v_cnt
    from public.owner_funds_events e
    where e.company_id = p_company_id
      and e.effective_date <= p_as_of;
  elsif to_regclass('public.owner_balances') is not null then
    select
      public.wp05_round_omr(coalesce(sum(case when ob.net_balance > 0 then ob.net_balance else 0 end),0)),
      count(*) filter (where ob.net_balance > 0.0005)::bigint
    into v_bal, v_cnt
    from public.owner_balances ob
    where ob.company_id = p_company_id;
  else
    v_bal := 0;
    v_cnt := 0;
  end if;

  return query select coalesce(v_bal,0)::numeric, coalesce(v_cnt,0)::bigint;
end;
$function$;

comment on function public.wp05_subledger_owner_payables(uuid,date) is
  'RC1 owner-funds payable operational subledger. Uses immutable owner_funds_events when present; legacy owner_balances remains a visible fallback only before RC1 event cutover.';

-- VAT payable operational basis for RC1 owner-agency only. OFFICE creditor VAT
-- arises at invoice issuance and is reduced by active credit tax components;
-- OWNER creditor VAT arises only as a posted collection tax allocation.
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
  v_office_count bigint := 0;
  v_owner_count bigint := 0;
begin
  if p_company_id is null then
    raise exception 'RC1_VAT_SUBLEDGER_COMPANY_REQUIRED' using errcode='22023';
  end if;

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

  select
    public.wp05_round_omr(coalesce(sum(pta.tax_amount), 0)),
    count(*) filter (where abs(pta.tax_amount) > 0.0005)::bigint
  into v_owner, v_owner_count
  from public.invoice_payment_tax_allocations pta
  join public.invoices i on i.id = pta.invoice_id and i.company_id = pta.company_id
  join public.receipts r on r.id = pta.receipt_id and r.company_id = pta.company_id
  where pta.company_id = p_company_id
    and i.invoice_accounting_classification = 'OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL'
    and upper(coalesce(r.status, '')) = 'POSTED'
    and r.deleted_at is null
    and r.date_time::date <= p_as_of;

  return query select public.wp05_round_omr(v_office + v_owner), coalesce(v_office_count, 0) + coalesce(v_owner_count, 0);
end;
$function$;

comment on function public.rc1_owner_agency_vat_payable_balance(uuid,date) is
  'RC1 operational VAT control basis for owner-agency, reconcilable to 2100 without recalculating historical profile rates.';

-- ---------------------------------------------------------------------------
-- 6. Read-only historical diagnostic. It identifies owner-agency invoices
--    whose source batch credited 4000 (or whose pre-RC1 lineage is otherwise
--    absent) without mutating a journal, invoice or subledger row. Any actual
--    correction remains governed by S08 review and approved S09 correction.
-- ---------------------------------------------------------------------------
create or replace function public.rpt_rc1_owner_agency_invoice_mapping_diagnostics(
  p_from date default null,
  p_to date default null
)
returns table (
  company_id uuid,
  invoice_id uuid,
  contract_id text,
  issue_date date,
  collection_role text,
  invoice_accounting_classification text,
  source_batch_id uuid,
  source_type text,
  source_account_numbers text[],
  affected_reason text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid := public.require_company_id();
begin
  if auth.uid() is null
     or not (coalesce(public.is_admin_or_manager(), false) or coalesce(public.is_accountant(), false)) then
    raise exception 'RC1_INVOICE_DIAGNOSTIC_ROLE_REQUIRED' using errcode = '42501';
  end if;

  return query
  select
    i.company_id,
    i.id,
    i.contract_id::text,
    i.issue_date,
    c.collection_role_snapshot,
    i.invoice_accounting_classification,
    b.id,
    b.source_type,
    coalesce(array_agg(distinct a.no order by a.no) filter (where a.no is not null), '{}'::text[]),
    case
      when bool_or(a.no = '4000') then 'OWNER_AGENCY_RENT_CREDITED_TO_4000_REVIEW_REQUIRED'
      when i.invoice_accounting_classification is null then 'PRE_RC1_INVOICE_LINEAGE_UNCLASSIFIED_REVIEW_REQUIRED'
      else 'NO_RC1_MAPPING_ANOMALY'
    end
  from public.invoices i
  join public.contracts c
    on c.id = i.contract_id
   and c.company_id = i.company_id
  left join lateral (
    select jb.*
      from public.journal_batches jb
     where jb.company_id = i.company_id
       and jb.source_type = 'invoice'
       and jb.source_id = i.id::text
     order by jb.created_at asc, jb.id
     limit 1
  ) b on true
  left join public.journal_lines jl
    on jl.batch_id = b.id
   and jl.company_id = i.company_id
  left join public.accounts a
    on a.id = jl.account_id
   and a.company_id = i.company_id
  where i.company_id = v_company_id
    and c.operating_model_snapshot = 'OWNER_AGENCY'
    and (p_from is null or i.issue_date >= p_from)
    and (p_to is null or i.issue_date <= p_to)
    and (
      i.invoice_accounting_classification is null
      or exists (
        select 1
          from public.journal_lines xjl
          join public.accounts xa on xa.id = xjl.account_id and xa.company_id = i.company_id
         where xjl.batch_id = b.id
           and xjl.company_id = i.company_id
           and xa.no = '4000'
      )
    )
  group by i.company_id, i.id, i.contract_id, i.issue_date,
           c.collection_role_snapshot, i.invoice_accounting_classification,
           b.id, b.source_type
  order by i.issue_date, i.id;
end;
$function$;

alter function public.rpt_rc1_owner_agency_invoice_mapping_diagnostics(date,date) owner to postgres;
revoke all on function public.rpt_rc1_owner_agency_invoice_mapping_diagnostics(date,date) from public, anon;
grant execute on function public.rpt_rc1_owner_agency_invoice_mapping_diagnostics(date,date) to authenticated, service_role;
comment on function public.rpt_rc1_owner_agency_invoice_mapping_diagnostics(date,date) is
  'Read-only RC1 historical diagnostic for owner-agency invoice source batches that used 4000 or lack immutable RC1 classification. Review via S08; no automatic correction.';

commit;
