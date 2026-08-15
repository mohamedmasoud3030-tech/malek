-- Manual / emergency rollback for
-- 20260818040000_wp03_gap004_contract_direct_write_revocation.sql.
-- Restores the legacy `manager_write_contracts` policy and the authenticated
-- write privileges on public.contracts. Production remains forward-only; use a
-- new forward migration in normal use.

begin;

-- Restore the legacy broad-write policy (bypass risk intentionally re-opened
-- only for rollback; do not run in normal operation).
drop policy if exists manager_write_contracts on public.contracts;
create policy manager_write_contracts on public.contracts
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- Restore direct write privileges for the API roles.
grant insert, update, delete, truncate, references on table public.contracts to authenticated;
grant insert, update, delete, truncate, references on table public.contracts to anon;

commit;
