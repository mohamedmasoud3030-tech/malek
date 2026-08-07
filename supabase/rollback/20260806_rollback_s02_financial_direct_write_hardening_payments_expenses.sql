-- Operational rollback for S02-T06 table hardening.
-- Restores the exact legacy table grants/policies documented in
-- 20250101000002_rls_policies_and_grants.sql. It intentionally does not widen
-- financial RPC EXECUTE back to PUBLIC/anon; security rollback is fail-closed.
begin;

drop policy if exists payments_select_app_users on public.payments;
drop policy if exists expenses_select_app_users on public.expenses;
drop policy if exists app_read_payments on public.payments;
drop policy if exists manager_write_payments on public.payments;
drop policy if exists app_read_expenses on public.expenses;
drop policy if exists manager_write_expenses on public.expenses;

create policy app_read_payments
  on public.payments
  for select to authenticated
  using (public.is_app_user());
create policy manager_write_payments
  on public.payments
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

create policy app_read_expenses
  on public.expenses
  for select to authenticated
  using (public.is_app_user());
create policy manager_write_expenses
  on public.expenses
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

grant select, insert, update, delete on table public.payments to authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;
revoke all on table public.payments from anon, public;
revoke all on table public.expenses from anon, public;

commit;
