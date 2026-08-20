-- WP-01: Six-role authorization foundation.
-- Addresses GAP-001 (SEC-004).
--
-- Canonical roles: ADMIN, MANAGER, ACCOUNTANT, OPERATIONS, USER, VIEWER.
-- Authorization remains capability/effective-permission based.
-- Backend/RLS/RPC is authoritative; frontend affordances are never the security boundary.
-- Unknown, legacy, malformed, or unmapped roles fail closed with least privilege.
--
-- Existing role data is preserved. ADMIN/MANAGER/USER map conservatively.
-- No automatic elevation into ACCOUNTANT, OPERATIONS, or VIEWER.
-- Migration is reversible: drop the CHECK constraint to restore pre-migration state.
--
-- No live/production Supabase mutations.
-- No financial RPC replacement; no journal_entries writes.

begin;

-- ── 1. Forward-safe CHECK constraint on users.role ──────────────────────────
-- NOT VALID so it does not fail on any existing row. Validates only new writes.
-- To apply fully: ALTER TABLE public.users VALIDATE CONSTRAINT users_role_valid_chk;
-- To reverse: ALTER TABLE public.users DROP CONSTRAINT users_role_valid_chk;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_role_valid_chk'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_role_valid_chk
      check (role is null or role::text in (
        'ADMIN','MANAGER','ACCOUNTANT','OPERATIONS','USER','VIEWER'
      )) not valid;
  end if;
end $$;

-- ── 2. Update role_has_app_permission with all six roles ────────────────────
-- This is the single authoritative capability matrix for role → permission.
-- ADMIN is dynamic (all permissions from catalog).
-- Other roles use explicit whitelists.
-- Unknown roles return false (fail closed).
-- Existing RPCs that call this function (e.g. request_permission, decide_permission_request)
-- automatically pick up the new role matrix without replacement.
create or replace function public.role_has_app_permission(p_role text, p_permission text)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select case upper(coalesce(p_role, ''))
    when 'ADMIN' then
      exists(select 1 from public.app_permission_catalog c where c.permission = p_permission)
    when 'MANAGER' then
      p_permission = any(array[
        'app.dashboard.view','maintenance.view','permission_requests.review','cost_centers.manage','documents.write',
        'owners.hub.view','owners.detail.view','lands.view','leads.view','commissions.view','communication.view',
        'automation.view','auth.password.change','properties.write','contracts.write','expenses.view','expenses.write',
        'arrears.view','financial.deposits.view','financial.invoices.generate','financial.invoices.export',
        'financial.payments.create','financial.receipts.void','financial.reports.export',
        'financial.bank_reconciliation.view','financial.bank_reconciliation.match','financial.owner_settlements.view',
        'service_providers.view','service_providers.write'
      ]::text[])
    when 'ACCOUNTANT' then
      p_permission = any(array[
        'app.dashboard.view','audit.view','expenses.view','arrears.view',
        'financial.deposits.view','financial.invoices.generate','financial.invoices.export',
        'financial.reports.export','financial.bank_reconciliation.view','financial.bank_reconciliation.match',
        'financial.owner_settlements.view','auth.password.change'
      ]::text[])
    when 'OPERATIONS' then
      p_permission = any(array[
        'app.dashboard.view','maintenance.view','service_providers.view','service_providers.write',
        'cost_centers.manage','documents.write','owners.hub.view','owners.detail.view','lands.view',
        'leads.view','communication.view','automation.view','auth.password.change','properties.write',
        'contracts.write','expenses.view','expenses.write','arrears.view'
      ]::text[])
    when 'USER' then
      p_permission = any(array['app.dashboard.view','auth.password.change']::text[])
    when 'VIEWER' then
      p_permission = any(array[
        'app.dashboard.view','maintenance.view','service_providers.view',
        'owners.hub.view','owners.detail.view','lands.view','leads.view','commissions.view',
        'communication.view','automation.view','expenses.view','arrears.view',
        'financial.deposits.view','financial.owner_settlements.view',
        'financial.bank_reconciliation.view','auth.password.change'
      ]::text[])
    else false
  end
$$;

revoke all on function public.role_has_app_permission(text, text) from public, anon;
grant execute on function public.role_has_app_permission(text, text) to authenticated, service_role;

-- ── 3. New role-gate helper functions ───────────────────────────────────────
-- These complement the existing is_admin(), is_admin_or_manager(), is_app_user().

create or replace function public.is_accountant()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.users u
       where u.id = auth.uid()
         and u.deleted_at is null
         and u.is_active
         and u.status::text = 'ACTIVE'
         and upper(coalesce(u.role::text, 'USER')) = 'ACCOUNTANT'
     );
$$;

revoke all on function public.is_accountant() from public, anon;
grant execute on function public.is_accountant() to authenticated, service_role;

create or replace function public.is_operations()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.users u
       where u.id = auth.uid()
         and u.deleted_at is null
         and u.is_active
         and u.status::text = 'ACTIVE'
         and upper(coalesce(u.role::text, 'USER')) = 'OPERATIONS'
     );
$$;

revoke all on function public.is_operations() from public, anon;
grant execute on function public.is_operations() to authenticated, service_role;

create or replace function public.is_viewer()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.users u
       where u.id = auth.uid()
         and u.deleted_at is null
         and u.is_active
         and u.status::text = 'ACTIVE'
         and upper(coalesce(u.role::text, 'USER')) = 'VIEWER'
     );
$$;

revoke all on function public.is_viewer() from public, anon;
grant execute on function public.is_viewer() to authenticated, service_role;

-- ── 4. Update app_permission_catalog for new role-gating semantics ──────────
-- Mark financial approvals as admin_only so ACCOUNTANT cannot self-approve them
-- through the effective-grant mechanism without explicit ADMIN delegation.
update public.app_permission_catalog
  set admin_only = true
  where permission in (
    'financial.owner_settlements.approve',
    'financial.owner_settlements.pay',
    'financial.receipts.void',
    'users.manage',
    'company.settings.manage',
    'system.view',
    'integrity.view'
  )
  and not admin_only;

comment on function public.role_has_app_permission(text, text)
  is 'WP-01: six-role capability matrix. ADMIN is dynamic (all catalog permissions); other roles use explicit whitelists; unknown roles return false.';

comment on function public.is_accountant()
  is 'WP-01: returns true if the current authenticated user has the ACCOUNTANT role and is active.';

comment on function public.is_operations()
  is 'WP-01: returns true if the current authenticated user has the OPERATIONS role and is active.';

comment on function public.is_viewer()
  is 'WP-01: returns true if the current authenticated user has the VIEWER role and is active.';

commit;
