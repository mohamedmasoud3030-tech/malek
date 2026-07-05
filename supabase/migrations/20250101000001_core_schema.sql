-- Rentrix code-first baseline: core schema.
-- Replaces the historical 100+ migration replay chain with a clean single-office
-- database shape required by artifacts/rentrix/src as of 2026-06-16.

begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text check (role in ('ADMIN', 'MANAGER', 'USER')) default 'USER',
  status text check (status in ('ACTIVE', 'INACTIVE', 'BLACKLISTED')) default 'ACTIVE',
  full_name text,
  is_active boolean not null default true,
  password_hash text,
  last_login timestamptz,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.company_settings (
  id uuid primary key default gen_random_uuid(),
  singleton_key boolean not null default true unique,
  company_name text not null default 'Rentrix',
  legal_name text,
  tax_number text,
  registration_number text,
  phone text,
  email text,
  address text,
  city text,
  country text,
  currency text not null default 'EGP',
  locale text not null default 'ar-EG',
  timezone text not null default 'Africa/Cairo',
  date_format text not null default 'yyyy-MM-dd',
  number_format text not null default 'ar-EG',
  logo_url text,
  invoice_prefix text not null default 'INV',
  contract_prefix text not null default 'CON',
  receipt_prefix text not null default 'REC',
  default_vat_rate numeric(8,4) not null default 0,
  notification_email_enabled boolean not null default false,
  notification_sms_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.company_settings (singleton_key)
values (true)
on conflict (singleton_key) do nothing;

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  display_name text,
  phone text,
  email text,
  national_id text,
  tax_number text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null,
  address text not null,
  owner_name text,
  purchase_value numeric(14,2),
  current_value numeric(14,2),
  status text not null default 'active' check (status in ('active', 'inactive', 'maintenance', 'sold')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.property_owners (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete restrict,
  ownership_percentage numeric(7,4) not null default 100 check (ownership_percentage > 0 and ownership_percentage <= 100),
  is_primary boolean not null default true,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_owners_dates_chk check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  name text,
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_number text not null,
  floor text,
  status text not null default 'available' check (status in ('available', 'occupied', 'maintenance', 'reserved')),
  rent_amount numeric(14,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint units_property_unit_unique unique (property_id, unit_number)
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  national_id text,
  type text not null check (type in ('tenant', 'owner', 'contact')),
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid references public.units(id) on delete restrict,
  tenant_id uuid not null references public.people(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  rent_amount numeric(14,2) not null check (rent_amount >= 0),
  payment_cycle text not null default 'monthly' check (payment_cycle in ('monthly', 'quarterly', 'semi_annual', 'annual')),
  status text not null default 'active' check (status in ('draft', 'active', 'expired', 'terminated', 'ENDED', 'ACTIVE')),
  cancellation_reason text,
  renewed_from_id uuid references public.contracts(id) on delete set null,
  notes text,
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint contracts_dates_chk check (end_date >= start_date)
);

alter table public.contracts
  add constraint contracts_no_active_unit_overlap
  exclude using gist (
    unit_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
  where (deleted_at is null and unit_id is not null and lower(status) = 'active');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  issue_date date not null,
  due_date date not null,
  amount numeric(14,2) not null check (amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  status text not null default 'UNPAID',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null,
  payment_date date not null default current_date,
  reference_number text,
  reference_no text,
  contract_id uuid references public.contracts(id) on delete restrict,
  date_time timestamptz,
  channel text,
  status text default 'POSTED',
  notes text,
  receipt_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint payments_contract_required check (contract_id is not null),
  constraint payments_invoice_required check (invoice_id is not null)
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  no text unique,
  contract_id uuid references public.contracts(id) on delete restrict,
  date_time timestamptz not null default now(),
  channel text,
  amount numeric(14,2) not null check (amount > 0),
  ref text,
  notes text,
  status text not null default 'POSTED',
  check_number text,
  check_bank text,
  check_date date,
  check_status text,
  voided_at timestamptz,
  request_id text unique,
  tenant_id uuid references public.people(id) on delete set null,
  payment_id uuid unique references public.payments(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

alter table public.payments
  add constraint payments_receipt_id_fkey foreign key (receipt_id) references public.receipts(id) on delete set null;

create table public.receipt_allocations (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  tenant_id uuid references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  category text not null,
  amount numeric(14,2) not null check (amount >= 0),
  expense_date date not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  attachment_url text
);

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  no text,
  property_id uuid references public.properties(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  title text,
  description text,
  priority text default 'medium',
  status text default 'open',
  assigned_to text,
  cost numeric(14,2),
  charged_to text,
  notes text,
  request_date date,
  scheduled_date date,
  work_description text,
  technician_name text,
  response_time_hours numeric(10,2),
  expense_id uuid references public.expenses(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  reported_by text,
  completed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz,
  attachment_url text,
  deleted_at timestamptz
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  ts bigint,
  user_id uuid,
  username text,
  action text,
  entity text,
  entity_id text,
  note text,
  "table" text,
  details text,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table public.financial_operation_idempotency (
  operation_name text not null,
  request_id text not null,
  response_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint financial_operation_idempotency_pkey primary key (operation_name, request_id)
);

create table public.accounts (
  id text primary key,
  no text unique,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.accounts (id, no, name)
values
  ('1111', '1111', 'Cash'),
  ('1201', '1201', 'Tenant receivables')
on conflict (id) do nothing;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('attachments', 'attachments', true)
    on conflict (id) do update set public = excluded.public;
  end if;
end;
$$;

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  no text,
  date date not null default current_date,
  account_id text references public.accounts(id) on delete restrict,
  amount numeric(14,2) not null,
  type text not null check (type in ('DEBIT', 'CREDIT')),
  source_id uuid,
  entity_type text,
  entity_id text,
  created_at timestamptz not null default now()
);

create table public.contract_balances (
  contract_id uuid primary key references public.contracts(id) on delete cascade,
  tenant_id uuid references public.people(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  total_invoiced numeric(14,2) not null default 0,
  total_paid numeric(14,2) not null default 0,
  balance_due numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.owner_balances (
  owner_id uuid primary key references public.owners(id) on delete cascade,
  total_income numeric(14,2) not null default 0,
  total_expenses numeric(14,2) not null default 0,
  commission numeric(14,2) not null default 0,
  net_balance numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

create index properties_active_idx on public.properties (created_at desc) where deleted_at is null;
create index properties_search_idx on public.properties using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(address, '') || ' ' || coalesce(owner_name, '')));
create index property_owners_property_idx on public.property_owners (property_id, ends_on);
create index property_owners_owner_idx on public.property_owners (owner_id, ends_on);
create unique index property_owners_active_primary_unique_idx
  on public.property_owners (property_id)
  where ends_on is null and is_primary;
create index units_property_idx on public.units (property_id, unit_number) where deleted_at is null;
create index people_type_idx on public.people (type, created_at desc) where deleted_at is null;
create index contracts_property_idx on public.contracts (property_id, created_at desc) where deleted_at is null;
create index contracts_unit_idx on public.contracts (unit_id) where deleted_at is null;
create index contracts_tenant_idx on public.contracts (tenant_id) where deleted_at is null;
create index invoices_contract_idx on public.invoices (contract_id, due_date desc) where deleted_at is null;
create index invoices_status_issue_idx on public.invoices (status, issue_date) where deleted_at is null;
create index payments_invoice_idx on public.payments (invoice_id, payment_date desc) where deleted_at is null;
create index payments_contract_idx on public.payments (contract_id, payment_date desc) where deleted_at is null;
create index receipts_contract_idx on public.receipts (contract_id, date_time desc) where deleted_at is null;
create index receipt_allocations_invoice_idx on public.receipt_allocations (invoice_id);
create index expenses_property_date_idx on public.expenses (property_id, expense_date desc) where deleted_at is null;
create index maintenance_property_idx on public.maintenance_records (property_id, created_at desc) where deleted_at is null;
create index maintenance_unit_idx on public.maintenance_records (unit_id, created_at desc) where deleted_at is null;
create index audit_log_created_idx on public.audit_log (created_at desc);

commit;
