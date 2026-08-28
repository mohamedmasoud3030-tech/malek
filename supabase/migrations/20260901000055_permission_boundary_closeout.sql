-- Permission boundary closeout: align six-role matrix with granular frontend
-- and make private permission/portal tables explicitly deny browser access.
-- Compatibility semantics here intentionally preserve migration 51 precedence.
--
-- Fixes:
-- * Preserve the P6/P51 compatibility contract for OPERATIONS: historical
--   properties.write/contracts.write remain fallback inputs until the office owner
--   makes an explicit granular decision. Exact granular owner overrides still win.
-- * MANAGER and OPERATIONS now explicitly include granular create/edit/archive/approve/cancel
--   so role_has_app_permission itself supports granular checks, not only via
--   parent fallback in current_user_has_effective_app_permission().
-- * owner_portal_links, tenant_portal_links, user_permission_overrides are
--   private/server-command stores. They already have RLS enabled and REVOKE ALL,
--   but isolation/contract gates expect explicit policies. Add explicit
--   restrictive deny-all policies so the gates prove deny-all rather than
--   NO_POLICY, while SECURITY DEFINER command paths continue to work because
--   postgres owner bypasses RLS.

begin;

-- ---------------------------------------------------------------------------
-- Six-role matrix alignment: keep historical OPERATIONS portfolio/leasing
-- broad writes as compatibility parents. Granular owner decisions remain the
-- authoritative way to refine those defaults action by action.
-- ---------------------------------------------------------------------------
create or replace function public.role_has_app_permission(p_role text, p_permission text)
returns boolean
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select case upper(coalesce(p_role, ''))
    when 'ADMIN' then
      exists(select 1 from public.app_permission_catalog c where c.permission = p_permission)
    when 'MANAGER' then
      p_permission = any(array[
        'app.dashboard.view',
        'properties.view','properties.create','properties.edit','properties.archive','properties.write',
        'contracts.view','contracts.create','contracts.edit','contracts.approve','contracts.cancel','contracts.write',
        'maintenance.view','maintenance.create','maintenance.edit','maintenance.approve','maintenance.cancel','maintenance.write',
        'financial.workspace.view',
        'permission_requests.review','cost_centers.manage','documents.write',
        'owners.hub.view','owners.detail.view','lands.view','leads.view','commissions.view','communication.view',
        'automation.view','auth.password.change','expenses.view','expenses.write','arrears.view',
        'financial.deposits.view','financial.invoices.generate','financial.invoices.export',
        'financial.payments.create','financial.receipts.void','financial.reports.view','financial.reports.export',
        'financial.bank_reconciliation.view','financial.bank_reconciliation.match','financial.owner_settlements.view',
        'service_providers.view','service_providers.write',
        'financial.fixed_monthly_accruals.view','financial.fixed_monthly_accruals.execute',
        'financial.fixed_monthly_accruals.reverse','support.operations.view','support.requests.triage'
      ]::text[])
    when 'ACCOUNTANT' then
      p_permission = any(array[
        'app.dashboard.view','financial.workspace.view','audit.view','expenses.view','arrears.view',
        'financial.deposits.view','financial.invoices.generate','financial.invoices.export',
        'financial.reports.view','financial.reports.export','financial.bank_reconciliation.view',
        'financial.bank_reconciliation.match','financial.owner_settlements.view','auth.password.change',
        'financial.fixed_monthly_accruals.view','financial.fixed_monthly_accruals.execute',
        'financial.fixed_monthly_accruals.reverse'
      ]::text[])
    when 'OPERATIONS' then
      p_permission = any(array[
        'app.dashboard.view',
        'properties.view','properties.write',
        'contracts.view','contracts.write',
        'maintenance.view','maintenance.create','maintenance.edit','maintenance.approve','maintenance.cancel','maintenance.write',
        'financial.workspace.view',
        'service_providers.view','service_providers.write',
        'cost_centers.manage',
        'owners.hub.view','owners.detail.view','lands.view','leads.view',
        'communication.view','automation.view','auth.password.change',
        'expenses.view','arrears.view'
      ]::text[])
    when 'USER' then
      p_permission = any(array['app.dashboard.view','auth.password.change']::text[])
    when 'VIEWER' then
      p_permission = any(array[
        'app.dashboard.view','properties.view','contracts.view','maintenance.view','financial.workspace.view',
        'financial.reports.view','service_providers.view','owners.hub.view','owners.detail.view','lands.view','leads.view',
        'commissions.view','communication.view','automation.view','expenses.view','arrears.view',
        'financial.deposits.view','financial.owner_settlements.view','financial.bank_reconciliation.view','auth.password.change'
      ]::text[])
    else false
  end
$function$;

-- ---------------------------------------------------------------------------
-- Private permission/portal tables: explicit deny-all for browser roles.
-- SECURITY DEFINER functions owned by postgres bypass RLS, so trusted command
-- paths continue to work. Direct PostgREST access remains denied.
-- ---------------------------------------------------------------------------
do $private_tables$
declare
  v_table text;
  v_policy text;
begin
  foreach v_table in array array['owner_portal_links','tenant_portal_links','user_permission_overrides'] loop
    if to_regclass('public.' || v_table) is null then
      continue;
    end if;

    -- Drop any existing deny policies from previous attempts (idempotent).
    foreach v_policy in array array[
      v_table || '_deny_all',
      'deny_all',
      v_table || '_no_access'
    ] loop
      execute format('drop policy if exists %I on public.%I', v_policy, v_table);
    end loop;

    -- Explicit restrictive deny-all for browser roles. Using FOR ALL covers
    -- SELECT/INSERT/UPDATE/DELETE. The policy is restrictive with USING/WITH CHECK false,
    -- so it denies even if a future permissive policy is added without company scoping.
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated, anon using (false) with check (false)',
      v_table || '_deny_all',
      v_table
    );
  end loop;
end
$private_tables$;

notify pgrst, 'reload schema';
commit;
