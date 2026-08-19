-- MALEK canonicalization transform
--
-- IMPORTANT: this file is NOT a deploy migration. It runs only against an
-- ephemeral database produced by replaying the historical migration chain.
-- Its purpose is to convert that proven end-state into the clean schema that
-- will be dumped as the new bootstrap baseline.
--
-- Remote/Demo convergence is a separate, forward-safe cutover. Never run this
-- file against a database carrying data without an explicit cutover plan.

begin;

-- ---------------------------------------------------------------------------
-- 1. Canonical tenant identity: public.people is the identity/contact record.
--    Preserve tenant-only attributes in a 1:1 profile instead of maintaining a
--    second full identity table (`tenants`).
--
-- Historical `tenants.id` is text, while the canonical `people.id` is UUID.
-- The preflight therefore proves every legacy id is exactly the textual form of
-- an existing people UUID before casting it. No best-effort conversion is used.
-- ---------------------------------------------------------------------------

create table if not exists public.tenant_profiles (
  tenant_id uuid primary key references public.people(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  nationality text,
  status text not null default 'active',
  tenant_type text not null default 'individual',
  cr_number text,
  postal_code text,
  po_box text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_profiles_status_check
    check (status in ('active','inactive','archived')),
  constraint tenant_profiles_tenant_type_check
    check (tenant_type in ('individual','company')),
  constraint tenant_profiles_tenant_company_key unique (tenant_id, company_id)
);

-- Fail closed if the historical identity copies disagree. A clean baseline may
-- only be created after every legacy tenant points at its canonical person and
-- both rows belong to the same company.
do $tenant_preflight$
begin
  if to_regclass('public.tenants') is not null then
    if exists (
      select 1
      from public.tenants t
      left join public.people p on p.id::text = t.id
      where p.id is null
         or p.type <> 'tenant'
         or p.company_id is distinct from t.company_id
    ) then
      raise exception 'CANONICAL_TENANT_IDENTITY_MISMATCH';
    end if;

    insert into public.tenant_profiles (
      tenant_id, company_id, nationality, status, tenant_type,
      cr_number, postal_code, po_box, archived_at, created_at, updated_at
    )
    select
      t.id::uuid,
      t.company_id,
      nullif(btrim(t.nationality), ''),
      case lower(coalesce(nullif(btrim(t.status), ''), 'active'))
        when 'active' then 'active'
        when 'inactive' then 'inactive'
        when 'archived' then 'archived'
        else 'inactive'
      end,
      case lower(coalesce(nullif(btrim(t.tenant_type), ''), 'individual'))
        when 'company' then 'company'
        when 'corporate' then 'company'
        else 'individual'
      end,
      nullif(btrim(t.cr_number), ''),
      nullif(btrim(t.postal_code), ''),
      nullif(btrim(t.po_box), ''),
      t.archived_at,
      coalesce(t.created_at, now()),
      coalesce(t.updated_at, now())
    from public.tenants t
    on conflict (tenant_id) do update set
      company_id = excluded.company_id,
      nationality = excluded.nationality,
      status = excluded.status,
      tenant_type = excluded.tenant_type,
      cr_number = excluded.cr_number,
      postal_code = excluded.postal_code,
      po_box = excluded.po_box,
      archived_at = excluded.archived_at,
      updated_at = excluded.updated_at;
  end if;
end
$tenant_preflight$;

alter table public.tenant_profiles enable row level security;
alter table public.tenant_profiles force row level security;

drop policy if exists tenant_profiles_company_select on public.tenant_profiles;
create policy tenant_profiles_company_select
  on public.tenant_profiles
  for select to authenticated
  using (
    public.is_app_user()
    and company_id = public.current_company_id()
  );

drop policy if exists tenant_profiles_company_manage on public.tenant_profiles;
create policy tenant_profiles_company_manage
  on public.tenant_profiles
  for all to authenticated
  using (
    public.is_admin_or_manager()
    and company_id = public.current_company_id()
  )
  with check (
    public.is_admin_or_manager()
    and company_id = public.current_company_id()
    and exists (
      select 1 from public.people p
      where p.id = tenant_id
        and p.type = 'tenant'
        and p.company_id = tenant_profiles.company_id
        and p.deleted_at is null
    )
  );

revoke all on table public.tenant_profiles from anon;
grant select, insert, update, delete on table public.tenant_profiles to authenticated;

-- The duplicated identity table has no current application/RPC/FK consumer in
-- the verified end-state. Its tenant-only data has been migrated above.
drop table if exists public.tenants;

-- ---------------------------------------------------------------------------
-- 2. Company settings are per-company, not a global singleton.
--    Keep singleton_key for client compatibility, but remove the old global
--    UNIQUE(singleton_key) invariant that prevents a second company row.
-- ---------------------------------------------------------------------------

do $company_settings$
begin
  if to_regclass('public.company_settings') is null then
    return;
  end if;

  if exists (
    select 1 from public.company_settings
    group by company_id
    having count(*) > 1
  ) then
    raise exception 'CANONICAL_COMPANY_SETTINGS_DUPLICATE_COMPANY_ROWS';
  end if;

  alter table public.company_settings
    drop constraint if exists company_settings_singleton_key_key;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.company_settings'::regclass
      and conname = 'company_settings_company_id_key'
  ) then
    alter table public.company_settings
      add constraint company_settings_company_id_key unique (company_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.company_settings'::regclass
      and conname = 'company_settings_singleton_true_chk'
  ) then
    alter table public.company_settings
      add constraint company_settings_singleton_true_chk
      check (singleton_key is true);
  end if;
end
$company_settings$;

-- ---------------------------------------------------------------------------
-- 3. Canonical contract status vocabulary. Historical aliases are normalized
--    once; the clean schema stores only lowercase domain values.
-- ---------------------------------------------------------------------------

do $contract_status_preflight$
begin
  if exists (
    select 1 from public.contracts
    where status is not null
      and lower(btrim(status)) not in
        ('draft','active','expired','ended','terminated')
  ) then
    raise exception 'CANONICAL_CONTRACT_STATUS_UNKNOWN_VALUE';
  end if;
end
$contract_status_preflight$;

update public.contracts
set status = case lower(btrim(status))
  when 'ended' then 'expired'
  else lower(btrim(status))
end
where status is not null;

alter table public.contracts
  drop constraint if exists contracts_status_check;

alter table public.contracts
  add constraint contracts_status_check
  check (status in ('draft','active','expired','terminated'));

-- ---------------------------------------------------------------------------
-- 4. Six-role model is the physical database contract, not only an application
--    convention. Historical rows must already satisfy it before baseline cut.
-- ---------------------------------------------------------------------------

do $role_preflight$
begin
  if exists (
    select 1 from public.users
    where role is not null
      and role::text not in
        ('ADMIN','MANAGER','ACCOUNTANT','OPERATIONS','USER','VIEWER')
  ) then
    raise exception 'CANONICAL_USER_ROLE_UNKNOWN_VALUE';
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_role_valid_chk'
  ) then
    alter table public.users validate constraint users_role_valid_chk;
  end if;
end
$role_preflight$;

-- ---------------------------------------------------------------------------
-- 5. Retire proven orphan/legacy bootstrap objects.
--    No CASCADE is intentionally used: an undiscovered dependency must fail the
--    canonical build rather than being silently removed.
-- ---------------------------------------------------------------------------

drop table if exists public.deposit_txs;
drop table if exists public.account_balances;
drop table if exists public.schema_refactor_notes;
drop table if exists public.sessions;
drop table if exists public.profiles;
drop table if exists public.settings;
drop table if exists public.snapshots;
drop table if exists public.kpi_snapshots;
drop table if exists public.missions;
drop table if exists public.auto_backups;
drop table if exists public.budgets;

-- Pre-Stage-3 rows are already represented in the canonical GL. A fresh
-- database has no historical rows to preserve, so the archive table does not
-- belong in the new bootstrap. Existing hosted data is handled separately by
-- the future cutover plan; this statement is only for the ephemeral builder.
drop table if exists public.journal_entries_archive;

-- Explicitly KEEP these domains. Prior reviews suggested deleting some of them,
-- but repository/domain evidence says they are retained product surfaces.
do $keep_guard$
begin
  if to_regclass('public.lands') is null
     or to_regclass('public.leads') is null
     or to_regclass('public.commissions') is null
     or to_regclass('public.payment_terms_templates') is null then
    raise exception 'CANONICAL_KEEP_SURFACE_MISSING';
  end if;
end
$keep_guard$;

commit;
