-- Rentrix code-first baseline: RLS, policies, and grants.

begin;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'user_role', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    (select u.role from public.users u where u.id = auth.uid() and u.deleted_at is null and u.is_active),
    'USER'
  )
$$;

create or replace function public.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
$$;

create or replace function public.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_app_role() in ('ADMIN', 'MANAGER')
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_app_role() = 'ADMIN'
$$;

alter table public.users enable row level security;
alter table public.company_settings enable row level security;
alter table public.owners enable row level security;
alter table public.properties enable row level security;
alter table public.property_owners enable row level security;
alter table public.units enable row level security;
alter table public.people enable row level security;
alter table public.contracts enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_allocations enable row level security;
alter table public.expenses enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.audit_log enable row level security;
alter table public.financial_operation_idempotency enable row level security;
alter table public.accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.contract_balances enable row level security;
alter table public.owner_balances enable row level security;

create policy users_read_self_or_admin on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy users_admin_write on public.users
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy app_read_company_settings on public.company_settings
  for select to authenticated using (public.is_app_user());

create policy manager_write_company_settings on public.company_settings
  for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy app_read_owners on public.owners for select to authenticated using (public.is_app_user());
create policy manager_write_owners on public.owners for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy app_read_properties on public.properties for select to authenticated using (public.is_app_user());
create policy manager_write_properties on public.properties for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy app_read_property_owners on public.property_owners for select to authenticated using (public.is_app_user());
create policy manager_write_property_owners on public.property_owners for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy app_read_units on public.units for select to authenticated using (public.is_app_user());
create policy manager_write_units on public.units for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy app_read_people on public.people for select to authenticated using (public.is_app_user());
create policy manager_write_people on public.people for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy app_read_contracts on public.contracts for select to authenticated using (public.is_app_user());
create policy manager_write_contracts on public.contracts for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy app_read_invoices on public.invoices for select to authenticated using (public.is_app_user());
create policy manager_write_invoices on public.invoices for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy app_read_payments on public.payments for select to authenticated using (public.is_app_user());
create policy manager_write_payments on public.payments for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy app_read_receipts on public.receipts for select to authenticated using (public.is_app_user());
create policy manager_write_receipts on public.receipts for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy app_read_receipt_allocations on public.receipt_allocations for select to authenticated using (public.is_app_user());
create policy manager_write_receipt_allocations on public.receipt_allocations for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy app_read_expenses on public.expenses for select to authenticated using (public.is_app_user());
create policy manager_write_expenses on public.expenses for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy app_read_maintenance_records on public.maintenance_records for select to authenticated using (public.is_app_user());
create policy manager_write_maintenance_records on public.maintenance_records for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy admin_read_audit_log on public.audit_log for select to authenticated using (public.is_admin());

create policy financial_operation_idempotency_no_direct_access on public.financial_operation_idempotency
  for all to anon, authenticated using (false) with check (false);

create policy app_read_accounts on public.accounts for select to authenticated using (public.is_app_user());
create policy admin_write_accounts on public.accounts for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_read_journal_entries on public.journal_entries for select to authenticated using (public.is_admin_or_manager());
create policy no_browser_write_journal_entries on public.journal_entries for all to authenticated using (false) with check (false);

create policy app_read_contract_balances on public.contract_balances for select to authenticated using (public.is_app_user());
create policy app_read_owner_balances on public.owner_balances for select to authenticated using (public.is_app_user());

do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'create policy attachments_authenticated_read on storage.objects for select to authenticated using (bucket_id = ''attachments'')';
    execute 'create policy attachments_authenticated_insert on storage.objects for insert to authenticated with check (bucket_id = ''attachments'')';
  end if;
exception
  when duplicate_object then
    null;
end;
$$;

revoke all on schema public from public;
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on table public.financial_operation_idempotency from anon, authenticated;

revoke all on function public.current_app_role() from public, anon, authenticated;
revoke all on function public.is_app_user() from public, anon, authenticated;
revoke all on function public.is_admin_or_manager() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;

commit;
