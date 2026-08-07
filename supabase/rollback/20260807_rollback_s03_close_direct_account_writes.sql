-- Manual/emergency rollback only — not auto-applied; run by hand only.
-- Rollback for: supabase/migrations/20260807180000_s03_close_direct_account_writes.sql
--
-- WARNING: this restores the historical authenticated ADMIN direct-write policy
-- and should only be used to recover a broken provisioning path. It does not
-- change account rows or financial history.

begin;

drop policy if exists no_browser_write_accounts on public.accounts;
drop policy if exists admin_write_accounts on public.accounts;
create policy admin_write_accounts on public.accounts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on table public.accounts to authenticated;

commit;
