-- Baseline capture: 4 live enum types + users.role/users.status compatibility.
--
-- Context: an audit (documented in docs/CURRENT_STATE.md, "Migration
-- consolidation audit findings") found that public.users.role and
-- public.users.status are live enum columns (user_role, entity_status
-- respectively) on nnggcnpcuomwfuupupwg, but supabase/migrations/
-- 20250101000001_core_schema.sql still describes them as plain text
-- columns with inline check constraints. The enum types themselves
-- (user_role, entity_status) and two more used by the untracked
-- utility_bills table (charged_to_type, utility_status, captured in
-- Batch A) were never created by any file under supabase/migrations/.
--
-- This migration exists to make the migrations directory match reality
-- for the 4 enum types that are actually used by a live column. Nine
-- additional enum types exist live but are not referenced by any column
-- (contract_status, invoice_status, invoice_type, journal_entry_type,
-- maintenance_status, payment_method, property_status,
-- transaction_status, unit_status) -- these are intentionally NOT
-- created here; see docs/CURRENT_STATE.md, "Orphaned live-schema enum
-- types" for the deferred cleanup decision.
--
-- Every statement below was generated from direct introspection of the
-- live schema (pg_type/pg_enum, information_schema.columns,
-- pg_constraint) on 2026-07-05, not hand-written from assumption. This
-- migration is registered as ALREADY APPLIED (metadata-only insert into
-- supabase_migrations.schema_migrations, no DDL executed) because the
-- types and column types it describes already exist live -- the goal is
-- to make the migrations directory match reality, not to re-run DDL
-- against a database that's already in this state. See
-- supabase/migrations/README.md.
--
-- Ordering: this file must run before both baseline batches, since
-- Batch A's utility_bills table depends on charged_to_type and
-- utility_status, and users (core schema) depends on user_role and
-- entity_status.

create type public.user_role as enum ('ADMIN', 'MANAGER', 'USER');
create type public.entity_status as enum ('ACTIVE', 'INACTIVE', 'BLACKLISTED');
create type public.charged_to_type as enum ('OWNER', 'TENANT', 'COMPANY');
create type public.utility_status as enum ('UNPAID', 'PAID', 'OVERDUE');

-- users.role and users.status were originally created as
-- `text check (...)` by 20250101000001_core_schema.sql. Live schema has
-- since moved both columns to the enum types above, with the check
-- constraints dropped (there are no check constraints left on
-- public.users in the live schema). Reproduce that same transition here
-- so a fresh rebuild from migrations ends up in the same state.
alter table public.users
  alter column role drop default;
alter table public.users
  alter column role type public.user_role using role::public.user_role;
alter table public.users
  alter column role set default 'USER'::public.user_role;

alter table public.users
  alter column status drop default;
alter table public.users
  alter column status type public.entity_status using status::public.entity_status;
alter table public.users
  alter column status set default 'ACTIVE'::public.entity_status;
