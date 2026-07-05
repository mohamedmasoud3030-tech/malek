-- Baseline capture: 4 previously-untracked, live-data tables.
--
-- Context: an audit (documented in docs/CURRENT_STATE.md, "Migration
-- consolidation audit findings") found that ~31 tables exist live on
-- nnggcnpcuomwfuupupwg but were never captured in any file under
-- supabase/migrations/. This file is Batch B: the 4 of those 31 tables
-- that hold live data (tenants, sessions, automation_jobs, profiles),
-- reviewed separately from Batch A (the 27 empty/scaffolding tables)
-- given the higher risk of documenting live data incorrectly.
--
-- Every statement below was generated from direct introspection of the
-- live schema (information_schema.columns, pg_constraint, pg_indexes,
-- pg_policies, information_schema.triggers) on 2026-07-05, not
-- hand-written from assumption. This migration is registered as ALREADY
-- APPLIED (metadata-only insert into supabase_migrations.schema_migrations,
-- no DDL executed) because the schema it describes is already live -- the
-- goal is to make the migrations directory match reality, not to re-run
-- DDL against tables that already exist. See supabase/migrations/README.md.
--
-- Ordering: this file must run after
-- 20260705000000_capture_live_enums_and_users_compatibility.sql (no
-- direct dependency here, but automation_jobs and tenants below are
-- depended on by Batch A's automation_run_logs, automation_runs, and
-- tenant_balances -- so Batch B must be timestamped earlier than Batch A).
--
-- Notable finding worth flagging, not corrected here (documenting
-- reality, not fixing it): sessions_select_own and sessions_delete_own
-- RLS policies compare auth.uid() to sessions.id (the session's own
-- primary key), not to sessions.user_id. This looks like a live bug, but
-- since the goal of this migration is to describe the live schema as-is,
-- it is captured verbatim below and flagged in docs/CURRENT_STATE.md
-- rather than silently fixed.

create table if not exists public.automation_jobs (
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
alter table public.automation_jobs enable row level security;
create policy app_user_automation_jobs on public.automation_jobs
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create table if not exists public.tenants (
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
create index if not exists idx_tenants_status on public.tenants (status) where (archived_at is null);
create index if not exists idx_tenants_unit_id on public.tenants (unit_id);
alter table public.tenants enable row level security;
alter table public.tenants force row level security;
create policy app_user_tenants on public.tenants
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());
create trigger tenants_updated_at
  before update on public.tenants
  for each row execute function public.update_updated_at();

create table if not exists public.profiles (
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
create index if not exists idx_profiles_auth_user_id on public.profiles (auth_user_id);
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create table if not exists public.sessions (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.users(id),
  token text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  constraint sessions_token_key unique (token)
);
create index if not exists idx_sessions_user_id on public.sessions (user_id);
alter table public.sessions enable row level security;
create policy sessions_select_own on public.sessions
  for select to authenticated
  using (((select auth.uid()) = id) or app_private.is_admin_or_manager());
create policy sessions_insert_own on public.sessions
  for insert to authenticated
  with check (((select auth.uid()) = id) and app_private.is_app_user());
create policy sessions_delete_own on public.sessions
  for delete to authenticated
  using (((select auth.uid()) = id) or app_private.is_admin_or_manager());
