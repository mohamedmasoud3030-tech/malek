-- Manual rollback for 20260804020000_financial_direct_write_hardening_commissions.sql
-- Restores the pre-PR-C direct INSERT/UPDATE posture for commissions.

begin;

drop function if exists public.cancel_commission_atomic(jsonb);
drop function if exists public.update_commission_atomic(jsonb);
drop function if exists public.create_commission_atomic(jsonb);

drop policy if exists commissions_select_own_company on public.commissions;
drop policy if exists app_read_commissions on public.commissions;
drop policy if exists manager_write_commissions on public.commissions;

create policy app_read_commissions
  on public.commissions
  for select to authenticated
  using (public.is_app_user());

create policy manager_write_commissions
  on public.commissions
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

grant select, insert, update on public.commissions to authenticated;
revoke delete on public.commissions from authenticated;

commit;
