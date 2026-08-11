-- WP-01: Six-role authorization foundation.
-- Addresses GAP-001 (SEC-004) and GAP-002 (SEC-008).
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

begin;

-- ── 1. Forward-safe CHECK constraint on users.role ──────────────────────────
-- NOT VALID so it does not fail on any existing row. Validates only new writes.
-- To apply fully: ALTER TABLE public.users VALIDATE CONSTRAINT users_role_valid_chk;
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
        'financial.bank_reconciliation.view','financial.bank_reconciliation.match','financial.owner_settlements.view'
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

-- is_non_writer: true for VIEWER or base USER (no write capability by role).
-- Useful for UI affordance gating; backend enforcement still uses exact permissions.
create or replace function public.is_read_only_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_app_role() in ('USER', 'VIEWER');
$$;

revoke all on function public.is_read_only_role() from public, anon;
grant execute on function public.is_read_only_role() to authenticated, service_role;

-- ── 4. Update request_permission notification routing ──────────────────────
-- ADMIN, MANAGER, ACCOUNTANT can receive permission-request notifications.
-- ACCOUNTANT may review financial-related requests where delegated.
create or replace function public.request_permission(
  p_permission text,
  p_resource_route text default null,
  p_reason text default ''
) returns public.permission_requests
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_company uuid := public.require_company_id();
  v_permission text := btrim(coalesce(p_permission, ''));
  v_route text := nullif(btrim(coalesce(p_resource_route, '')), '');
  v_role text := public.current_app_role();
  result public.permission_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists(select 1 from public.app_permission_catalog c where c.permission = v_permission) then
    raise exception 'Unknown permission' using errcode = '22023';
  end if;
  if public.role_has_app_permission(v_role, v_permission)
     or exists(select 1 from public.user_permission_grants g where g.company_id = v_company and g.user_id = auth.uid() and g.permission = v_permission and g.revoked_at is null) then
    raise exception 'Permission is already granted' using errcode = '23505';
  end if;
  if not exists(select 1 from public.app_permission_catalog c where c.permission = v_permission and c.requestable) then
    raise exception 'Permission is not requestable' using errcode = '22023';
  end if;

  select * into result from public.permission_requests pr
  where pr.company_id = v_company and pr.requester_user_id = auth.uid()
    and pr.permission = v_permission and coalesce(pr.resource_route, '') = coalesce(v_route, '')
    and pr.status = 'PENDING'
  order by pr.created_at desc limit 1;
  if result.id is not null then return result; end if;

  insert into public.permission_requests(company_id, requester_user_id, permission, resource_route, reason)
  values (v_company, auth.uid(), v_permission, v_route, btrim(coalesce(p_reason, '')))
  returning * into result;

  insert into public.app_notifications(
    id, company_id, recipient_user_id, created_at, is_read, role, type, title, message,
    link, source_type, source_id, notification_type
  )
  select result.id::text || ':' || u.id::text || ':permission', v_company, u.id, now(), false, u.role::text,
    'permission_request', 'طلب صلاحية جديد',
    coalesce(requester.full_name, requester.name, requester.email, 'مستخدم') || ' طلب ' || catalog.label_ar,
    '/settings?section=users-permissions&sub=permission-requests', 'permission_request', result.id, 'permission_request'
  from public.users u
  join public.company_members cm on cm.user_id = u.id and cm.company_id = v_company and cm.is_active
  cross join public.app_permission_catalog catalog
  left join public.users requester on requester.id = auth.uid()
  where u.deleted_at is null and u.is_active and u.status::text = 'ACTIVE'
    and u.role::text in ('ADMIN','MANAGER') and catalog.permission = v_permission
  on conflict (id) do nothing;

  insert into public.audit_log(id, ts, user_id, action, entity, entity_id, note, "table", details, created_at)
  select gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(), 'PERMISSION_REQUESTED',
    'permission_request', result.id::text, 'طلب صلاحية جديد', 'permission_requests',
    jsonb_build_object('company_id', result.company_id, 'permission', result.permission, 'resource_route', result.resource_route)::text, now()
  where not exists(select 1 from public.audit_log a where a.action = 'PERMISSION_REQUESTED' and a.entity_id = result.id::text);
  return result;
end;
$$;

revoke all on function public.request_permission(text, text, text) from public, anon;
grant execute on function public.request_permission(text, text, text) to authenticated;

-- ── 5. Update app_permission_catalog for new role-gating semantics ──────────
-- ACCOUNTANT can review financial permissions without admin_only.
-- Mark financial approvals as admin_only so ACCOUNTANT cannot self-approve them.
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

comment on function public.is_read_only_role()
  is 'WP-01: returns true if the current role is USER or VIEWER (no write capability by role alone).';

commit;
