-- STATUS AS OF 2026-07-05: NOT YET APPLIED to nnggcnpcuomwfuupupwg (production).
-- Confirmed via information_schema.tables that public.communication_records
-- does not exist live. Committed and reviewed, but never run. Applying this
-- is a deliberate operator action (via apply_migration), not something this
-- consolidation pass does silently. See supabase/migrations/README.md.

begin;

-- Product-expansion support for the approved internal communication module.
-- No external provider sends are created here.
create table if not exists public.communication_records (
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

create index if not exists communication_records_active_idx
  on public.communication_records (status, channel, created_at desc)
  where deleted_at is null;

create index if not exists communication_records_related_idx
  on public.communication_records (related_entity_type, related_entity_id)
  where related_entity_type is not null and related_entity_id is not null;

alter table public.communication_records enable row level security;

drop policy if exists app_user_communication_records on public.communication_records;
create policy app_user_communication_records
  on public.communication_records for all to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());

grant select, insert, update on public.communication_records to authenticated;
revoke delete on public.communication_records from authenticated;

-- Harden and normalize approved pre-existing planned-module tables when present.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['lands', 'leads', 'commissions'] loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise notice 'Skipping planned module hardening for missing table public.%', table_name;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', 'app_user_' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_app_user()) with check (public.is_app_user())',
      'app_user_' || table_name,
      table_name
    );
    execute format('grant select, insert, update on public.%I to authenticated', table_name);
    execute format('revoke delete on public.%I from authenticated', table_name);
  end loop;
end $$;

-- Security Advisor-compatible view setting, when PostgreSQL supports it and the view exists.
do $$
begin
  if to_regclass('public.v_balance_reconciliation') is not null then
    alter view public.v_balance_reconciliation set (security_invoker = true);
  end if;
exception
  when undefined_object or feature_not_supported then
    raise notice 'Skipping v_balance_reconciliation security_invoker adjustment on this environment';
end $$;

-- Remove only the redundant idempotency unique index/constraint if it exists independently.
do $$
begin
  if to_regclass('public.financial_operation_idempotency') is null then
    return;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.financial_operation_idempotency'::regclass
      and conname = 'financial_operation_idempotency_operation_request_uidx'
      and contype = 'u'
  ) then
    alter table public.financial_operation_idempotency
      drop constraint financial_operation_idempotency_operation_request_uidx;
  elsif exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'financial_operation_idempotency_operation_request_uidx'
      and c.relkind = 'i'
  ) then
    drop index public.financial_operation_idempotency_operation_request_uidx;
  end if;
end $$;

commit;
