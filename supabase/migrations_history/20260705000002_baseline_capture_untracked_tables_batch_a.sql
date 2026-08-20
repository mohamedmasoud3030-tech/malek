-- Baseline capture: 27 previously-untracked, empty/scaffolding live tables.
--
-- Context: an audit (documented in docs/CURRENT_STATE.md, "Migration
-- consolidation audit findings") found that ~31 tables exist live on
-- nnggcnpcuomwfuupupwg but were never captured in any file under
-- supabase/migrations/. This file is Batch A of the fix: the 27 of those
-- 31 tables that currently hold zero rows (scaffolding/future-feature
-- tables). Batch B (20260705000001_baseline_capture_untracked_tables_batch_b.sql,
-- applied before this file) covers the remaining 4 tables that hold live
-- data (tenants, sessions, automation_jobs, profiles), reviewed
-- separately given the higher risk of documenting live data incorrectly.
--
-- Every statement below was generated from direct introspection of the
-- live schema (information_schema.columns, pg_constraint, pg_indexes,
-- pg_policies) on 2026-07-05, not hand-written from assumption. This
-- migration is registered as ALREADY APPLIED (metadata-only insert into
-- supabase_migrations.schema_migrations, no DDL executed) because the
-- schema it describes is already live — the goal is to make the
-- migrations directory match reality, not to re-run DDL against tables
-- that already exist. See supabase/migrations/README.md.
--
-- Ordering: this file depends on two earlier migrations and must sort
-- after both of them:
--   - 20260705000000_capture_live_enums_and_users_compatibility.sql
--     (charged_to_type, utility_status used by utility_bills below)
--   - 20260705000001_baseline_capture_untracked_tables_batch_b.sql
--     (automation_jobs.id referenced by automation_run_logs.job_id and
--     automation_runs.job_id; tenants.id referenced by
--     tenant_balances.tenant_id)

create table if not exists public.account_balances (
  account_id uuid not null primary key,
  balance numeric default 0
);
alter table public.account_balances enable row level security;
create policy app_user_account_balances on public.account_balances
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.app_notifications (
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
alter table public.app_notifications enable row level security;
create policy app_user_app_notifications on public.app_notifications
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.attachments (
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
alter table public.attachments enable row level security;
create policy app_user_attachments on public.attachments
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.auto_backups (
  id text not null primary key,
  created_at timestamptz,
  size bigint,
  checksum text,
  updated_at timestamptz default now()
);
alter table public.auto_backups enable row level security;
create policy app_user_auto_backups on public.auto_backups
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.automation_run_logs (
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
create index if not exists idx_automation_run_logs_job_id on public.automation_run_logs (job_id);
alter table public.automation_run_logs enable row level security;
create policy app_user_automation_run_logs on public.automation_run_logs
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.automation_runs (
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
create index if not exists idx_automation_runs_job_id on public.automation_runs (job_id);
alter table public.automation_runs enable row level security;
create policy automation_runs_auth on public.automation_runs
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.budgets (
  id text not null primary key,
  year integer,
  items jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
);
alter table public.budgets enable row level security;
create policy app_user_budgets on public.budgets
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.commissions (
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
alter table public.commissions enable row level security;
create policy app_user_commissions on public.commissions
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public."company-assets" (
  id text not null default (gen_random_uuid())::text primary key,
  key text not null,
  value text,
  mime_type text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public."company-assets" enable row level security;
create policy company_assets_auth on public."company-assets"
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.deposit_txs (
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
create index if not exists idx_deposit_txs_contract_id on public.deposit_txs (contract_id);
alter table public.deposit_txs enable row level security;
alter table public.deposit_txs force row level security;
create policy app_user_deposit_txs on public.deposit_txs
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.governance (
  id integer not null default 1 primary key,
  read_only boolean default false,
  locked_periods jsonb default '[]'::jsonb
);
alter table public.governance enable row level security;
create policy app_user_governance on public.governance
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.kpi_snapshots (
  id text not null primary key,
  total_owner_net_balance numeric default 0,
  total_contract_ar_balance numeric default 0,
  total_tenant_ar_balance numeric default 0
);
alter table public.kpi_snapshots enable row level security;
create policy app_user_kpi_snapshots on public.kpi_snapshots
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.lands (
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
alter table public.lands enable row level security;
create policy app_user_lands on public.lands
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.leads (
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
alter table public.leads enable row level security;
create policy app_user_leads on public.leads
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.missions (
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
alter table public.missions enable row level security;
create policy app_user_missions on public.missions
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.notification_templates (
  id text not null primary key,
  name text,
  template text,
  is_enabled boolean default true,
  updated_at timestamptz default now()
);
alter table public.notification_templates enable row level security;
create policy app_user_notification_templates on public.notification_templates
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.notifications (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  type varchar(100) not null,
  title varchar(255) not null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now(),
  updated_at bigint default ((extract(epoch from now()) * 1000::numeric))::bigint
);
create index if not exists idx_notifications_user_read on public.notifications (user_id, is_read);
alter table public.notifications enable row level security;
create policy app_user_notifications on public.notifications
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.outgoing_notifications (
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
create index if not exists idx_outgoing_notifications_status
  on public.outgoing_notifications (status, created_at) where (deleted_at is null);
create index if not exists idx_outgoing_notifications_status_created_at
  on public.outgoing_notifications (status, created_at);
alter table public.outgoing_notifications enable row level security;
create policy app_user_outgoing_notifications on public.outgoing_notifications
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.owner_settlements (
  id text not null primary key,
  no text,
  owner_id text,
  date text,
  amount numeric,
  method text,
  notes text,
  created_at timestamptz,
  ref text,
  updated_at timestamptz,
  status text default 'PAID'::text,
  constraint owner_settlements_status_check
    check (status = any (array['PENDING','PAID','CANCELLED']))
);
alter table public.owner_settlements enable row level security;
alter table public.owner_settlements force row level security;
create policy app_user_owner_settlements on public.owner_settlements
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.schema_refactor_notes (
  id uuid not null default gen_random_uuid() primary key,
  category text not null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at bigint default ((extract(epoch from now()) * 1000::numeric))::bigint
);
alter table public.schema_refactor_notes enable row level security;
create policy app_user_schema_refactor_notes on public.schema_refactor_notes
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.serials (
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
alter table public.serials enable row level security;
create policy app_user_serials on public.serials
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.settings (
  id integer not null default 1 primary key,
  data jsonb not null default '{}'::jsonb,
  automation_config jsonb default '{}'::jsonb,
  updated_at bigint default ((extract(epoch from now()) * 1000::numeric))::bigint
);
alter table public.settings enable row level security;
create policy app_user_settings on public.settings
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.snapshots (
  id text not null primary key,
  ts bigint,
  note text,
  data jsonb,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table public.snapshots enable row level security;
create policy app_user_snapshots on public.snapshots
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.status_history (
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
create index if not exists idx_status_history_actor_id on public.status_history (actor_id);
alter table public.status_history enable row level security;
create policy app_user_status_history on public.status_history
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.status_transition_rules (
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
alter table public.status_transition_rules enable row level security;
create policy app_user_status_transition_rules on public.status_transition_rules
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.tenant_balances (
  tenant_id text not null primary key,
  balance_due numeric default 0,
  updated_at timestamptz,
  constraint tenant_balances_tenant_fk foreign key (tenant_id) references public.tenants(id)
);
create index if not exists idx_tenant_balances_tenant_id on public.tenant_balances (tenant_id);
alter table public.tenant_balances enable row level security;
create policy app_user_tenant_balances on public.tenant_balances
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.utility_bills (
  id uuid not null default gen_random_uuid() primary key,
  property_id uuid not null,
  contract_id uuid,
  type varchar(100) not null,
  amount numeric(12,3) not null,
  billing_period_start date,
  billing_period_end date,
  due_date date not null,
  paid_at timestamptz,
  charged_to charged_to_type default 'COMPANY'::charged_to_type,
  expense_id uuid,
  invoice_id uuid,
  status utility_status default 'UNPAID'::utility_status,
  reference_no varchar(255),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.utility_bills enable row level security;
create policy app_user_utility_bills on public.utility_bills
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());
