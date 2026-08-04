-- ============================================================================
-- Business document references (UI/UX remediation — Stage 3)
--
-- Replaces raw UUIDs as business-facing identifiers with company-scoped,
-- server-generated, concurrency-safe, idempotent references for the audited
-- document classes. Existing internal UUID primary keys are unchanged.
--
-- Reference format: <PREFIX>-<YEAR>-<6-digit sequence>, e.g. INV-2026-000001.
-- The sequence is scoped per (company_id, doc_type, year) so numbering is
-- unique within a company and cannot race (a single atomic upsert owns the
-- per-key row lock). References are assigned by a BEFORE INSERT trigger only
-- when NEW.reference is NULL, so explicit values and retries stay idempotent.
--
-- Historical rows are backfilled deterministically in created_at order.
-- ============================================================================

begin;

-- 1. Company-scoped, per-year sequence table --------------------------------
create table if not exists public.document_reference_sequences (
  company_id uuid not null,
  doc_type   text not null,
  prefix     text not null,
  year       integer not null,
  last_value bigint not null default 0,
  primary key (company_id, doc_type, year)
);

-- 2. Atomic next-reference function -----------------------------------------
-- Concurrency-safe: the INSERT..ON CONFLICT DO UPDATE holds the row lock on
-- (company_id, doc_type, year) and increments last_value atomically, so two
-- concurrent callers can never receive the same number.
create or replace function public.next_document_reference(
  p_company_id uuid,
  p_doc_type   text,
  p_prefix     text,
  p_year       integer
) returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_next bigint;
begin
  if p_company_id is null or p_doc_type is null or p_prefix is null or p_year is null then
    return null;
  end if;

  insert into public.document_reference_sequences (company_id, doc_type, prefix, year, last_value)
  values (p_company_id, p_doc_type, p_prefix, p_year, 1)
  on conflict (company_id, doc_type, year)
  do update set last_value = public.document_reference_sequences.last_value + 1
  returning last_value into v_next;

  return format('%s-%s-%s', p_prefix, p_year, lpad(v_next::text, 6, '0'));
end;
$$;

-- 3. Generic BEFORE INSERT trigger function ----------------------------------
-- Reads the row's company_id (falling back to the singleton company) and fills
-- NEW.reference only when it is NULL. TG_ARGV[0] = doc_type, TG_ARGV[1] = prefix.
create or replace function public.assign_document_reference()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company uuid;
  v_year    integer;
begin
  if NEW.reference is not null and NEW.reference <> '' then
    return NEW;
  end if;

  v_company := coalesce(
    NEW.company_id,
    (select c.id from public.company_settings c where c.singleton_key = true limit 1)
  );
  if v_company is null then
    return NEW;
  end if;

  v_year := extract(year from coalesce(NEW.created_at, now()))::integer;

  NEW.reference := public.next_document_reference(
    v_company,
    TG_ARGV[0],
    TG_ARGV[1],
    v_year
  );
  return NEW;
end;
$$;

-- 4. Add reference columns + company_id where missing ------------------------
alter table public.contracts add column if not exists reference text;
alter table public.invoices add column if not exists reference text;
alter table public.receipts add column if not exists reference text;
alter table public.expenses add column if not exists reference text;
alter table public.maintenance_records add column if not exists reference text;
alter table public.owner_agreements add column if not exists reference text;
alter table public.owner_agreements add column if not exists company_id uuid;
alter table public.owner_settlements add column if not exists reference text;
alter table public.tenant_deposits add column if not exists reference text;
alter table public.utility_bills add column if not exists reference text;
alter table public.bank_statement_imports add column if not exists reference text;

-- Backfill owner_agreements.company_id from its owner (owners carry company_id).
update public.owner_agreements a
set company_id = o.company_id
from public.owners o
where a.company_id is null and o.id = a.owner_id and o.company_id is not null;

-- 5. Per-table unique, partial indexes ---------------------------------------
-- A reference must be unique within a company once non-null, and only among
-- live (non-deleted) rows so archived rows keep a stable reference.
do $$
begin
  create unique index if not exists ux_contracts_reference
    on public.contracts (company_id, reference) where reference is not null and deleted_at is null;
exception when duplicate_table then null;
end $$;

do $$
begin
  create unique index if not exists ux_invoices_reference
    on public.invoices (company_id, reference) where reference is not null and deleted_at is null;
exception when duplicate_table then null;
end $$;

do $$
begin
  create unique index if not exists ux_receipts_reference
    on public.receipts (company_id, reference) where reference is not null and deleted_at is null;
exception when duplicate_table then null;
end $$;

do $$
begin
  create unique index if not exists ux_expenses_reference
    on public.expenses (company_id, reference) where reference is not null and deleted_at is null;
exception when duplicate_table then null;
end $$;

do $$
begin
  create unique index if not exists ux_maintenance_records_reference
    on public.maintenance_records (company_id, reference) where reference is not null and deleted_at is null;
exception when duplicate_table then null;
end $$;

do $$
begin
  create unique index if not exists ux_owner_agreements_reference
    on public.owner_agreements (company_id, reference) where reference is not null;
exception when duplicate_table then null;
end $$;

do $$
begin
  create unique index if not exists ux_owner_settlements_reference
    on public.owner_settlements (company_id, reference) where reference is not null;
exception when duplicate_table then null;
end $$;

do $$
begin
  create unique index if not exists ux_tenant_deposits_reference
    on public.tenant_deposits (company_id, reference) where reference is not null;
exception when duplicate_table then null;
end $$;

do $$
begin
  create unique index if not exists ux_utility_bills_reference
    on public.utility_bills (company_id, reference) where reference is not null;
exception when duplicate_table then null;
end $$;

do $$
begin
  create unique index if not exists ux_bank_statement_imports_reference
    on public.bank_statement_imports (company_id, reference) where reference is not null;
exception when duplicate_table then null;
end $$;

-- 6. BEFORE INSERT triggers ---------------------------------------------------
create trigger trg_contracts_reference
  before insert on public.contracts
  for each row when (NEW.reference is null)
  execute function public.assign_document_reference('contract', 'CNT');

create trigger trg_invoices_reference
  before insert on public.invoices
  for each row when (NEW.reference is null)
  execute function public.assign_document_reference('invoice', 'INV');

create trigger trg_receipts_reference
  before insert on public.receipts
  for each row when (NEW.reference is null)
  execute function public.assign_document_reference('receipt', 'RCT');

create trigger trg_expenses_reference
  before insert on public.expenses
  for each row when (NEW.reference is null)
  execute function public.assign_document_reference('expense', 'EXP');

create trigger trg_maintenance_records_reference
  before insert on public.maintenance_records
  for each row when (NEW.reference is null)
  execute function public.assign_document_reference('maintenance', 'MNT');

create trigger trg_owner_agreements_reference
  before insert on public.owner_agreements
  for each row when (NEW.reference is null)
  execute function public.assign_document_reference('owner_agreement', 'AGR');

create trigger trg_owner_settlements_reference
  before insert on public.owner_settlements
  for each row when (NEW.reference is null)
  execute function public.assign_document_reference('owner_settlement', 'STL');

create trigger trg_tenant_deposits_reference
  before insert on public.tenant_deposits
  for each row when (NEW.reference is null)
  execute function public.assign_document_reference('tenant_deposit', 'DEP');

create trigger trg_utility_bills_reference
  before insert on public.utility_bills
  for each row when (NEW.reference is null)
  execute function public.assign_document_reference('utility_bill', 'UTL');

create trigger trg_bank_statement_imports_reference
  before insert on public.bank_statement_imports
  for each row when (NEW.reference is null)
  execute function public.assign_document_reference('bank_import', 'BNK');

-- 7. Deterministic backfill of historical rows --------------------------------
-- Backfill function assigns references to existing NULL rows in created_at
-- order, scoped per company, so the resulting numbers are stable and safe.
create or replace function public.backfill_business_document_references()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  r record;
  v_company uuid;
  v_ref text;
begin
  for r in
    select c.id, c.company_id, c.created_at
    from public.contracts c
    where c.reference is null
    order by c.created_at, c.id
  loop
    if r.company_id is null then continue; end if;
    select public.next_document_reference(r.company_id, 'contract', 'CNT',
      extract(year from coalesce(r.created_at, now()))::integer) into v_ref;
    update public.contracts set reference = v_ref where id = r.id and reference is null;
  end loop;

  for r in
    select i.id, i.company_id, i.created_at
    from public.invoices i
    where i.reference is null
    order by i.created_at, i.id
  loop
    if r.company_id is null then continue; end if;
    select public.next_document_reference(r.company_id, 'invoice', 'INV',
      extract(year from coalesce(r.created_at, now()))::integer) into v_ref;
    update public.invoices set reference = v_ref where id = r.id and reference is null;
  end loop;

  for r in
    select r2.id, r2.company_id, r2.created_at
    from public.receipts r2
    where r2.reference is null
    order by r2.created_at, r2.id
  loop
    if r.company_id is null then continue; end if;
    select public.next_document_reference(r.company_id, 'receipt', 'RCT',
      extract(year from coalesce(r.created_at, now()))::integer) into v_ref;
    update public.receipts set reference = v_ref where id = r.id and reference is null;
  end loop;

  for r in
    select e.id, e.company_id, e.created_at
    from public.expenses e
    where e.reference is null
    order by e.created_at, e.id
  loop
    if r.company_id is null then continue; end if;
    select public.next_document_reference(r.company_id, 'expense', 'EXP',
      extract(year from coalesce(r.created_at, now()))::integer) into v_ref;
    update public.expenses set reference = v_ref where id = r.id and reference is null;
  end loop;

  for r in
    select m.id, m.company_id, m.created_at
    from public.maintenance_records m
    where m.reference is null
    order by m.created_at, m.id
  loop
    if r.company_id is null then continue; end if;
    select public.next_document_reference(r.company_id, 'maintenance', 'MNT',
      extract(year from coalesce(r.created_at, now()))::integer) into v_ref;
    update public.maintenance_records set reference = v_ref where id = r.id and reference is null;
  end loop;

  for r in
    select a.id, a.company_id, a.created_at
    from public.owner_agreements a
    where a.reference is null
    order by a.created_at, a.id
  loop
    if r.company_id is null then continue; end if;
    select public.next_document_reference(r.company_id, 'owner_agreement', 'AGR',
      extract(year from coalesce(r.created_at, now()))::integer) into v_ref;
    update public.owner_agreements set reference = v_ref where id = r.id and reference is null;
  end loop;

  for r in
    select s.id, s.company_id, s.created_at
    from public.owner_settlements s
    where s.reference is null
    order by s.created_at, s.id
  loop
    if r.company_id is null then continue; end if;
    select public.next_document_reference(r.company_id, 'owner_settlement', 'STL',
      extract(year from coalesce(r.created_at, now()))::integer) into v_ref;
    update public.owner_settlements set reference = v_ref where id = r.id and reference is null;
  end loop;

  for r in
    select d.id, d.company_id, d.created_at
    from public.tenant_deposits d
    where d.reference is null
    order by d.created_at, d.id
  loop
    if r.company_id is null then continue; end if;
    select public.next_document_reference(r.company_id, 'tenant_deposit', 'DEP',
      extract(year from coalesce(r.created_at, now()))::integer) into v_ref;
    update public.tenant_deposits set reference = v_ref where id = r.id and reference is null;
  end loop;

  for r in
    select u.id, u.company_id, u.created_at
    from public.utility_bills u
    where u.reference is null
    order by u.created_at, u.id
  loop
    if r.company_id is null then continue; end if;
    select public.next_document_reference(r.company_id, 'utility_bill', 'UTL',
      extract(year from coalesce(r.created_at, now()))::integer) into v_ref;
    update public.utility_bills set reference = v_ref where id = r.id and reference is null;
  end loop;

  for r in
    select b.id, b.company_id, b.imported_at as occurred_at
    from public.bank_statement_imports b
    where b.reference is null
    order by b.imported_at, b.id
  loop
    if r.company_id is null then continue; end if;
    select public.next_document_reference(r.company_id, 'bank_import', 'BNK',
      extract(year from coalesce(r.occurred_at, now()))::integer) into v_ref;
    update public.bank_statement_imports set reference = v_ref where id = r.id and reference is null;
  end loop;
end;
$$;

select public.backfill_business_document_references();

-- 8. Helpers used by the application layer ------------------------------------
-- Return a company-scoped reference for a document class without assigning it.
create or replace function public.format_document_reference(
  p_company_id uuid,
  p_doc_type text,
  p_prefix text,
  p_year integer,
  p_sequence bigint
) returns text
language sql
immutable
as $$
  select format('%s-%s-%s', p_prefix, p_year, lpad(p_sequence::text, 6, '0'))
$$;

commit;
