-- Phase: Real Utilities Implementation
-- Creates utility_meters table and enhances utility_bills with missing columns
-- No destructive changes, additive only, idempotent with IF NOT EXISTS

begin;

-- 1. Create utility_meters table if not exists
create table if not exists public.utility_meters (
  id uuid primary key default gen_random_uuid(),
  property_id text not null references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  utility_type text not null check (utility_type in ('electricity','water','sanitation','internet','gas','other')),
  meter_number text not null,
  account_number text not null,
  provider_name text,
  responsible_party text not null default 'tenant' check (responsible_party in ('tenant','landlord','company')),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint utility_meters_meter_number_not_empty check (length(trim(meter_number)) > 0),
  constraint utility_meters_account_number_not_empty check (length(trim(account_number)) > 0)
);

create index if not exists idx_utility_meters_property_id on public.utility_meters(property_id) where deleted_at is null;
create index if not exists idx_utility_meters_unit_id on public.utility_meters(unit_id) where deleted_at is null;
create index if not exists idx_utility_meters_type on public.utility_meters(utility_type) where deleted_at is null;

-- 2. Enable RLS and policies: read for all app users, write for ADMIN/MANAGER
alter table public.utility_meters enable row level security;

drop policy if exists app_read_utility_meters on public.utility_meters;
drop policy if exists manager_write_utility_meters on public.utility_meters;
drop policy if exists app_user_utility_meters on public.utility_meters;

create policy app_read_utility_meters on public.utility_meters
  for select to authenticated
  using (public.is_app_user());

create policy manager_write_utility_meters on public.utility_meters
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

grant select on public.utility_meters to authenticated;
grant insert, update on public.utility_meters to authenticated;
revoke delete on public.utility_meters from authenticated;

-- 3. Enhance utility_bills with missing columns if not exists
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='utility_bills' and column_name='meter_id') then
    alter table public.utility_bills add column meter_id uuid references public.utility_meters(id) on delete set null;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='utility_bills' and column_name='unit_id') then
    alter table public.utility_bills add column unit_id uuid references public.units(id) on delete set null;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='utility_bills' and column_name='previous_reading') then
    alter table public.utility_bills add column previous_reading numeric(14,2);
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='utility_bills' and column_name='current_reading') then
    alter table public.utility_bills add column current_reading numeric(14,2);
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='utility_bills' and column_name='consumption_units') then
    alter table public.utility_bills add column consumption_units numeric(14,2);
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='utility_bills' and column_name='paid_amount') then
    alter table public.utility_bills add column paid_amount numeric(14,2) not null default 0;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='utility_bills' and column_name='attachment_url') then
    alter table public.utility_bills add column attachment_url text;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='utility_bills' and column_name='deleted_at') then
    alter table public.utility_bills add column deleted_at timestamptz;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='utility_bills' and column_name='updated_at') then
    alter table public.utility_bills add column updated_at timestamptz default now();
  end if;
end $$;

create index if not exists idx_utility_bills_meter_id on public.utility_bills(meter_id) where deleted_at is null;
create index if not exists idx_utility_bills_property_id on public.utility_bills(property_id) where deleted_at is null;
create index if not exists idx_utility_bills_status on public.utility_bills(status) where deleted_at is null;
create index if not exists idx_utility_bills_due_date on public.utility_bills(due_date desc) where deleted_at is null;

-- 4. Harden RLS for utility_bills to ADMIN/MANAGER write
alter table public.utility_bills enable row level security;

drop policy if exists app_user_utility_bills on public.utility_bills;
drop policy if exists app_read_utility_bills on public.utility_bills;
drop policy if exists manager_write_utility_bills on public.utility_bills;

create policy app_read_utility_bills on public.utility_bills
  for select to authenticated
  using (public.is_app_user());

create policy manager_write_utility_bills on public.utility_bills
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

grant select on public.utility_bills to authenticated;
grant insert, update on public.utility_bills to authenticated;
revoke delete on public.utility_bills from authenticated;

-- 5. Trigger to auto-update updated_at
drop trigger if exists trg_utility_meters_updated_at on public.utility_meters;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_utility_meters_updated_at
  before update on public.utility_meters
  for each row execute function public.set_updated_at();

drop trigger if exists trg_utility_bills_updated_at on public.utility_bills;
create trigger trg_utility_bills_updated_at
  before update on public.utility_bills
  for each row execute function public.set_updated_at();

commit;
