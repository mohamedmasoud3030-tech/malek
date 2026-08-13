-- Manual rollback for forward migration 20260813210000_wp02_fixed_monthly_daily_accrual.sql.
-- NOT auto-applied. This rollback fails closed when any GAP-007 financial
-- history exists: posted accruals and reversals must never be erased.

begin;

do $rollback_guard$
begin
  if to_regclass('public.fixed_monthly_daily_accruals') is not null
     and exists (select 1 from public.fixed_monthly_daily_accruals limit 1) then
    raise exception 'ROLLBACK_BLOCKED_FINANCIAL_HISTORY: fixed_monthly_daily_accruals contains immutable financial history.';
  end if;
  if to_regclass('public.fixed_monthly_daily_accrual_reversals') is not null
     and exists (select 1 from public.fixed_monthly_daily_accrual_reversals limit 1) then
    raise exception 'ROLLBACK_BLOCKED_FINANCIAL_HISTORY: fixed_monthly_daily_accrual_reversals contains immutable financial history.';
  end if;
end;
$rollback_guard$;

revoke all on function public.execute_fixed_monthly_accruals_atomic(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.reverse_fixed_monthly_accrual_atomic(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.list_fixed_monthly_accruals(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.gl_reverse_fixed_monthly_accrual(uuid, uuid, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.gl_run_fixed_monthly_accruals(uuid, date, date, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.gl_accrue_fixed_monthly_day(uuid, uuid, date, uuid) from public, anon, authenticated, service_role;
revoke all on function public.fixed_monthly_daily_amount_omr(numeric, date) from public, anon, authenticated, service_role;

drop function if exists public.execute_fixed_monthly_accruals_atomic(jsonb);
drop function if exists public.reverse_fixed_monthly_accrual_atomic(jsonb);
drop function if exists public.list_fixed_monthly_accruals(jsonb);
drop function if exists public.gl_reverse_fixed_monthly_accrual(uuid, uuid, text, uuid);
drop function if exists public.gl_run_fixed_monthly_accruals(uuid, date, date, uuid, uuid);
drop function if exists public.gl_accrue_fixed_monthly_day(uuid, uuid, date, uuid);
drop function if exists public.fixed_monthly_daily_amount_omr(numeric, date);

drop table if exists public.fixed_monthly_daily_accrual_reversals;
drop table if exists public.fixed_monthly_daily_accruals;
drop function if exists public.guard_fixed_monthly_daily_ledger_immutable();

delete from public.app_permission_catalog
where permission in (
  'financial.fixed_monthly_accruals.view',
  'financial.fixed_monthly_accruals.execute',
  'financial.fixed_monthly_accruals.reverse'
);

-- Restore the six-role semantic map that immediately preceded GAP-007.
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

commit;
