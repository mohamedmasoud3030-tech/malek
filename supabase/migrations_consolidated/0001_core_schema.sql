-- Consolidated production baseline: core schema

begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create type public.user_role as enum ('ADMIN', 'MANAGER', 'USER');
create type public.entity_status as enum ('ACTIVE', 'INACTIVE', 'BLACKLISTED');
create type public.charged_to_type as enum ('OWNER', 'TENANT', 'COMPANY');
create type public.utility_status as enum ('UNPAID', 'PAID', 'OVERDUE');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role public.user_role not null default 'USER'::public.user_role,
  status public.entity_status not null default 'ACTIVE'::public.entity_status,
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
  vat_enabled boolean default false,
  vat_rate numeric(5,2) default 5.0,
  vat_registration_number text,
  notification_email_enabled boolean not null default false,
  notification_sms_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  full_name text not null,
  display_name text,
  phone text,
  email text,
  national_id text,
  tax_number text,
  address text,
  notes text,
  commission_type text,
  commission_value numeric(14,4),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id text primary key default (gen_random_uuid())::text,
  owner_id uuid references public.owners(id) on update cascade on delete set null,
  name text not null default '',
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
  property_id text not null references public.properties(id) on delete cascade,
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
  property_id text not null references public.properties(id) on delete restrict,
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
  id text primary key default (gen_random_uuid())::text,
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

create table public.cost_centers (
  id text primary key default (gen_random_uuid())::text,
  name text not null,
  property_id text references public.properties(id),
  parent_id text references public.cost_centers(id),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.payment_terms_templates (
  id text primary key default (gen_random_uuid())::text,
  name text not null,
  installments integer default 1,
  interval_type text check (interval_type in ('monthly', 'quarterly', 'biannual', 'annual', 'custom')),
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.owner_agreements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  property_id text not null references public.properties(id) on delete restrict,
  agreement_type text not null check (agreement_type in ('property_management', 'master_lease')),
  commission_type text not null check (commission_type in ('FIXED_MONTHLY', 'RATE')),
  commission_value numeric(14,4) not null check (
    (commission_type = 'RATE' and commission_value >= 0 and commission_value <= 100) or
    (commission_type = 'FIXED_MONTHLY' and commission_value >= 0)
  ),
  starts_on date not null,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contracts (
  id text primary key default (gen_random_uuid())::text,
  no text,
  property_id text not null references public.properties(id) on delete restrict,
  unit_id uuid references public.units(id) on delete restrict,
  tenant_id text not null references public.people(id) on delete restrict,
  agreement_id uuid references public.owner_agreements(id) on delete restrict,
  start_date text not null,
  end_date text not null,
  rent_amount numeric(14,2) not null check (rent_amount >= 0),
  monthly_rent numeric(14,2),
  deposit numeric(14,2) default 0,
  due_day integer default 1,
  payment_cycle text not null default 'monthly' check (payment_cycle in ('monthly', 'quarterly', 'semi_annual', 'annual')),
  payment_terms_id text references public.payment_terms_templates(id),
  status text not null default 'active' check (status in ('draft', 'active', 'expired', 'terminated', 'ENDED', 'ACTIVE')),
  cancellation_reason text,
  renewed_from_id text references public.contracts(id) on delete set null,
  sponsor_name text,
  sponsor_id text,
  sponsor_phone text,
  organization_id uuid,
  commission_rate numeric,
  notes text,
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint contracts_dates_chk check (end_date::date >= start_date::date)
);

create table public.accounts (
  id text primary key,
  no text unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id text primary key default (gen_random_uuid())::text,
  no text,
  contract_id text not null references public.contracts(id) on delete restrict,
  issue_date date not null,
  due_date date not null,
  amount numeric(14,2) not null check (amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  tax_rate numeric(5,2) default 0,
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  type text default 'RENT',
  status text not null default 'UNPAID',
  notes text,
  related_invoice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.payments (
  id text primary key default (gen_random_uuid())::text,
  invoice_id text references public.invoices(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null,
  payment_date date not null default current_date,
  reference_number text,
  payment_reference text,
  reference_no text,
  contract_id text references public.contracts(id) on delete restrict,
  date_time timestamptz,
  channel text,
  status text default 'POSTED',
  notes text,
  receipt_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint payments_contract_required check (contract_id is not null),
  constraint payments_invoice_required check (invoice_id is not null)
);

create table public.receipts (
  id text primary key default (gen_random_uuid())::text,
  no text unique,
  contract_id text references public.contracts(id) on delete restrict,
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
  tenant_id text references public.people(id) on delete set null,
  payment_id text unique references public.payments(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create table public.receipt_allocations (
  id text primary key default (gen_random_uuid())::text,
  receipt_id text not null references public.receipts(id) on delete cascade,
  invoice_id text references public.invoices(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  tenant_id text references public.people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.expenses (
  id text primary key default (gen_random_uuid())::text,
  property_id text not null references public.properties(id) on delete restrict,
  contract_id text references public.contracts(id) on delete set null,
  cost_center_id text references public.cost_centers(id),
  invoice_id text,
  category text not null,
  amount numeric(14,2) not null check (amount >= 0),
  expense_date date not null,
  date_time timestamptz,
  description text,
  notes text,
  ref text,
  status text,
  charged_to text,
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.maintenance_records (
  id text primary key default (gen_random_uuid())::text,
  no text,
  property_id text references public.properties(id) on delete set null,
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
  expense_id text references public.expenses(id) on delete set null,
  invoice_id text references public.invoices(id) on delete set null,
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
  old_value jsonb,
  new_value jsonb,
  action_timestamp timestamptz not null default now(),
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

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  no text,
  date date not null default current_date,
  account_id text references public.accounts(id) on delete restrict,
  amount numeric(14,2) not null,
  type text not null check (type in ('DEBIT', 'CREDIT')),
  source_id text,
  entity_type text,
  entity_id text,
  cost_center_id text references public.cost_centers(id),
  status text not null default 'posted' check (status in ('draft', 'posted')),
  created_at timestamptz not null default now()
);

create table public.contract_balances (
  contract_id text primary key references public.contracts(id) on delete restrict,
  tenant_id text references public.people(id) on delete set null,
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

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  account_code text,
  currency text not null default 'OMR',
  opening_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint bank_accounts_currency_chk check (currency ~ '^[A-Z]{3}$')
);

create table public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id),
  statement_name text not null,
  statement_from date,
  statement_to date,
  imported_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  constraint bank_statement_imports_period_chk check (statement_from is null or statement_to is null or statement_to >= statement_from)
);

create table public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.bank_statement_imports(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id),
  transaction_date date not null,
  description text not null default '',
  reference text,
  amount numeric(14,2) not null,
  status text not null default 'unmatched',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint bank_statement_lines_amount_nonzero_chk check (amount <> 0),
  constraint bank_statement_lines_status_chk check (status in ('unmatched', 'matched', 'ignored'))
);

create table public.bank_reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  statement_line_id uuid not null unique references public.bank_statement_lines(id) on delete cascade,
  matched_entity_type text not null,
  matched_entity_id text not null,
  matched_amount numeric(14,2) not null,
  notes text,
  matched_at timestamptz not null default now(),
  matched_by uuid default auth.uid(),
  constraint bank_reconciliation_matches_type_chk check (matched_entity_type in ('payment', 'receipt', 'expense', 'manual_adjustment')),
  constraint bank_reconciliation_matches_amount_nonzero_chk check (matched_amount <> 0)
);

create table public.communication_records (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  contact_phone text,
  contact_email text,
  channel text not null default 'phone',
  direction text not null default 'outbound',
  status text not null default 'logged',
  subject text,
  body text not null,
  related_entity_type text,
  related_entity_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint communication_records_channel_chk check (channel in ('phone', 'whatsapp', 'email', 'meeting', 'note')),
  constraint communication_records_direction_chk check (direction in ('inbound', 'outbound', 'internal')),
  constraint communication_records_status_chk check (status in ('logged', 'follow_up', 'resolved', 'archived'))
);

create table public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id text not null references public.contracts(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  storage_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.automation_jobs (
  id uuid not null default gen_random_uuid() primary key,
  job_name text not null,
  job_type text not null,
  schedule_cron text,
  schedule_interval_hours integer,
  is_enabled boolean default true,
  last_run_at bigint,
  last_run_status text,
  last_run_result text,
  config jsonb default '{}'::jsonb,
  created_at bigint default (extract(epoch from now()) * 1000::numeric),
  updated_at bigint default (extract(epoch from now()) * 1000::numeric),
  constraint automation_jobs_job_name_key unique (job_name),
  constraint automation_jobs_job_type_check
    check (job_type = any (array[
      'MONTHLY_INVOICES','OVERDUE_CHECK','LATE_FEE','PAYMENT_REMINDER',
      'OVERDUE_NOTICE','CONTRACT_EXPIRY_CHECK','MAINTENANCE_OVERDUE_CHECK',
      'UNIT_STATUS_UPDATE','LARGE_PAYMENT_ALERT'
    ])),
  constraint automation_jobs_last_run_status_check
    check (last_run_status = any (array['SUCCESS','FAILED','PARTIAL']))
);

create table public.tenants (
  id text not null primary key,
  name text not null,
  phone text,
  email text,
  id_no text,
  nationality text,
  notes text,
  created_at timestamptz,
  status text default 'ACTIVE'::text,
  updated_at timestamptz,
  tenant_type text default 'INDIVIDUAL'::text,
  cr_number text,
  address text,
  postal_code text,
  po_box text,
  unit_id uuid references public.units(id)
    on update cascade on delete set null deferrable initially deferred,
  archived_at timestamptz,
  constraint fk_unit foreign key (unit_id) references public.units(id)
    on update cascade on delete set null deferrable initially deferred
);

create table public.profiles (
  id uuid not null primary key
    references auth.users(id) on delete cascade,
  username text not null,
  role text not null default 'USER'::text,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  is_disabled boolean not null default false,
  auth_user_id uuid references auth.users(id),
  updated_at timestamptz default now(),
  constraint profiles_role_check check (role = any (array['ADMIN','USER']))
);

create table public.sessions (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.users(id),
  token text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  constraint sessions_token_key unique (token)
);

create table public.account_balances (
  account_id uuid not null primary key,
  balance numeric default 0
);

create table public.app_notifications (
  id text not null primary key,
  created_at timestamptz,
  is_read boolean default false,
  role text,
  type text,
  title text,
  message text,
  link text,
  source_type text,
  source_id uuid,
  notification_type text,
  deleted_at timestamptz
);

create table public.attachments (
  id text not null primary key,
  entity_type text,
  entity_id text,
  name text,
  mime text,
  size bigint,
  data_url text,
  created_at timestamptz,
  updated_at timestamptz default now()
);

create table public.auto_backups (
  id text not null primary key,
  created_at timestamptz,
  size bigint,
  checksum text,
  updated_at timestamptz default now()
);

create table public.automation_run_logs (
  id uuid not null default gen_random_uuid() primary key,
  job_id uuid references public.automation_jobs(id),
  job_name text not null,
  started_at bigint not null default (extract(epoch from now()) * 1000::numeric),
  completed_at bigint,
  status text not null,
  items_processed integer default 0,
  items_failed integer default 0,
  error_message text,
  actions_taken jsonb default '[]'::jsonb,
  is_system_generated boolean default true,
  rollback_performed boolean default false,
  constraint automation_run_logs_status_check
    check (status = any (array['RUNNING','SUCCESS','FAILED','PARTIAL','ROLLED_BACK']))
);

create table public.automation_runs (
  id uuid not null default gen_random_uuid() primary key,
  job_id uuid references public.automation_jobs(id) on delete set null,
  job_name text not null,
  started_at bigint not null default ((extract(epoch from now()) * 1000::numeric))::bigint,
  completed_at bigint,
  status text not null default 'running'::text,
  items_processed integer default 0,
  items_failed integer default 0,
  error_message text,
  actions_taken jsonb default '[]'::jsonb,
  is_system_generated boolean default true,
  rollback_performed boolean default false,
  updated_at timestamptz default to_timestamp(((((extract(epoch from now()) * 1000::numeric))::bigint)::double precision / 1000.0::double precision))
);

create table public.budgets (
  id text not null primary key,
  year integer,
  items jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
);

create table public.commissions (
  id text not null primary key,
  staff_id text,
  staff_name text,
  amount numeric,
  status text,
  source_id text,
  created_at timestamptz,
  type text,
  deal_value numeric,
  percentage numeric,
  expense_id uuid,
  paid_at bigint,
  updated_at timestamptz default now(),
  constraint check_commission_status
    check (status = any (array['PENDING','APPROVED','PAID','REJECTED'])) not valid,
  constraint commissions_amount_non_negative_chk
    check ((amount is null) or (amount >= 0::numeric)) not valid
);

create table public."company-assets" (
  id text not null default (gen_random_uuid())::text primary key,
  key text not null,
  value text,
  mime_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.deposit_txs (
  id text not null primary key,
  contract_id text references public.contracts(id),
  type text,
  amount numeric,
  date text,
  notes text,
  created_at timestamptz,
  note text,
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  constraint deposit_txs_amount_non_negative_chk
    check ((amount is null) or (amount >= 0::numeric)) not valid
);

create table public.governance (
  id integer not null default 1 primary key,
  read_only boolean default false,
  locked_periods jsonb default '[]'::jsonb
);

create table public.kpi_snapshots (
  id text not null primary key,
  total_owner_net_balance numeric default 0,
  total_contract_ar_balance numeric default 0,
  total_tenant_ar_balance numeric default 0
);

create table public.lands (
  id text not null primary key,
  plot_no text,
  location text,
  area numeric,
  owner_id text,
  purchase_price numeric,
  status text,
  notes text,
  created_at timestamptz,
  name text,
  category text,
  owner_price numeric,
  commission numeric,
  updated_at timestamptz
);

create table public.leads (
  id text not null primary key,
  no text,
  name text,
  phone text,
  email text,
  source text,
  status text,
  notes text,
  created_at timestamptz,
  desired_unit_type text,
  min_budget numeric,
  max_budget numeric,
  updated_at timestamptz
);

create table public.missions (
  id text not null primary key,
  no text,
  date text,
  description text,
  assigned_to text,
  status text,
  notes text,
  created_at timestamptz,
  title text,
  time text,
  owner_id uuid,
  lead_id uuid,
  result_summary text,
  updated_at timestamptz
);

create table public.notification_templates (
  id text not null primary key,
  name text,
  template text,
  is_enabled boolean default true,
  updated_at timestamptz default now()
);

create table public.notifications (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  type varchar(100) not null,
  title varchar(255) not null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now(),
  updated_at bigint default ((extract(epoch from now()) * 1000::numeric))::bigint
);

create table public.outgoing_notifications (
  id text not null primary key,
  template_id text,
  tenant_id text,
  message text,
  status text,
  sent_at bigint,
  created_at timestamptz,
  recipient_name text,
  recipient_contact text,
  source_type text,
  source_id uuid,
  is_system_generated boolean default false,
  notification_type text,
  deleted_at timestamptz,
  updated_at timestamptz default now()
);

create table public.owner_settlements (
  id text not null primary key,
  no text,
  owner_id text,
  date date,
  amount numeric,
  method text,
  notes text,
  created_at timestamptz,
  ref text,
  updated_at timestamptz,
  status text default 'PAID'::text,
  constraint owner_settlements_status_check check (status = any (array['PENDING','PAID','CANCELLED']))
);

create table public.schema_refactor_notes (
  id uuid not null default gen_random_uuid() primary key,
  category text not null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at bigint default ((extract(epoch from now()) * 1000::numeric))::bigint
);

create table public.serials (
  id integer not null default 1 primary key,
  receipt integer default 1000,
  expense integer default 1000,
  maintenance integer default 1000,
  invoice integer default 1000,
  lead integer default 1000,
  owner_settlement integer default 1000,
  journal_entry integer default 1000,
  mission integer default 1000,
  contract integer default 1000
);

create table public.settings (
  id integer not null default 1 primary key,
  data jsonb not null default '{}'::jsonb,
  automation_config jsonb default '{}'::jsonb,
  updated_at bigint default ((extract(epoch from now()) * 1000::numeric))::bigint
);

create table public.snapshots (
  id text not null primary key,
  ts bigint,
  note text,
  data jsonb,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table public.status_history (
  id uuid not null default gen_random_uuid() primary key,
  entity_type text not null,
  entity_id uuid not null,
  previous_status text,
  new_status text not null,
  actor_id uuid references public.users(id),
  actor_name text,
  notes text,
  "timestamp" bigint not null default (extract(epoch from now()) * 1000::numeric),
  updated_at bigint default ((extract(epoch from now()) * 1000::numeric))::bigint,
  constraint status_history_entity_type_check
    check (entity_type = any (array['MAINTENANCE','CONTRACT','INVOICE','EXPENSE']))
);

create table public.status_transition_rules (
  id uuid not null default gen_random_uuid() primary key,
  entity_type text not null,
  from_status text not null,
  to_status text not null,
  required_fields jsonb default '[]'::jsonb,
  requires_cost boolean default false,
  updated_at bigint default ((extract(epoch from now()) * 1000::numeric))::bigint,
  constraint status_transition_rules_entity_type_from_status_to_status_key
    unique (entity_type, from_status, to_status)
);

create table public.tenant_balances (
  tenant_id text not null primary key,
  balance_due numeric default 0,
  updated_at timestamptz,
  constraint tenant_balances_tenant_id_people_fkey foreign key (tenant_id) references public.people(id) on delete restrict
);

create table public.utility_bills (
  id uuid not null default gen_random_uuid() primary key,
  property_id text not null,
  contract_id text,
  type varchar(100) not null,
  amount numeric(12,3) not null,
  billing_period_start date,
  billing_period_end date,
  due_date date not null,
  paid_at timestamptz,
  charged_to public.charged_to_type default 'COMPANY'::public.charged_to_type,
  expense_id text,
  invoice_id text,
  status public.utility_status default 'UNPAID'::public.utility_status,
  reference_no varchar(255),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.company_settings (singleton_key) values (true) on conflict (singleton_key) do nothing;

insert into public.accounts (id, no, name) values ('1111', '1111', 'Cash'), ('1201', '1201', 'Tenant receivables'), ('6100', '6100', 'Operating Expenses') on conflict (id) do nothing;


do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('attachments', 'attachments', true)
    on conflict (id) do update set public = excluded.public;
  end if;
end;
$$;

alter table public.owner_agreements
  add constraint owner_agreements_no_overlap
  exclude using gist (
    property_id with =,
    daterange(starts_on, coalesce(ends_on, '9999-12-31'::date), '[]') with &&
  );

alter table public.contracts
  add constraint contracts_no_active_unit_overlap
  exclude using gist (
    unit_id with =,
    daterange(
      make_date(split_part(start_date, '-', 1)::int, split_part(start_date, '-', 2)::int, split_part(start_date, '-', 3)::int),
      make_date(split_part(end_date, '-', 1)::int, split_part(end_date, '-', 2)::int, split_part(end_date, '-', 3)::int),
      '[]'
    ) with &&
  )
  where (deleted_at is null and unit_id is not null and lower(status) = 'active');

alter table public.payments
  add constraint payments_receipt_id_fkey
  foreign key (receipt_id) references public.receipts(id) on delete set null;

commit;
