-- Stage S03 — close direct browser writes to the company chart of accounts.
--
-- Historical policy admin_write_accounts allowed authenticated ADMIN users to
-- INSERT/UPDATE/DELETE public.accounts directly. Stage 3 has an explicit
-- SECURITY DEFINER provisioning boundary (`ensure_company_chart_of_accounts`)
-- and internal service-role account resolvers; browser table mutation must not
-- bypass those invariants.

begin;

alter table public.accounts enable row level security;

drop policy if exists admin_write_accounts on public.accounts;
drop policy if exists no_browser_write_accounts on public.accounts;
create policy no_browser_write_accounts on public.accounts
  for all to authenticated
  using (false)
  with check (false);

-- Keep tenant-scoped authenticated reads, but remove every table-level mutation
-- privilege from the browser role. SECURITY DEFINER/server-side functions keep
-- operating as their trusted owner and service_role retains its server access.
revoke insert, update, delete, truncate, references, trigger on table public.accounts from authenticated;
grant select on table public.accounts to authenticated;
revoke all on table public.accounts from anon;
grant select, insert, update, delete on table public.accounts to service_role;

comment on table public.accounts is
  'Company-scoped Stage 3 chart of accounts. Authenticated clients may read tenant-scoped rows only; provisioning/mutation runs through approved server-side account RPCs.';

commit;
