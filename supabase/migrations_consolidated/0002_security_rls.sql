-- Consolidated production baseline: security, RLS, policies, and grants

begin;

create schema if not exists app_private;

create or replace function app_private.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'user_role', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    (select u.role::text from public.users u where u.id = auth.uid() and coalesce(u.deleted_at, null) is null and coalesce(u.is_active, true)),
    'USER'
  )
$$;

create or replace function app_private.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
$$;

create or replace function app_private.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.current_app_role() in ('ADMIN', 'MANAGER')
$$;

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
    (select u.role::text from public.users u where u.id = auth.uid() and u.deleted_at is null and u.is_active),
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

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_terms_templates ENABLE ROW LEVEL SECURITY;
alter table public."company-assets" enable row level security;
alter table public.account_balances enable row level security;
alter table public.accounts enable row level security;
alter table public.app_notifications enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_log enable row level security;
alter table public.auto_backups enable row level security;
alter table public.automation_jobs enable row level security;
alter table public.automation_run_logs enable row level security;
alter table public.automation_runs enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_reconciliation_matches enable row level security;
alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.budgets enable row level security;
alter table public.commissions enable row level security;
alter table public.communication_records enable row level security;
alter table public.company_settings enable row level security;
alter table public.contract_balances enable row level security;
alter table public.contract_documents enable row level security;
alter table public.contracts enable row level security;
alter table public.deposit_txs enable row level security;
alter table public.expenses enable row level security;
alter table public.financial_operation_idempotency enable row level security;
alter table public.governance enable row level security;
alter table public.invoices enable row level security;
alter table public.journal_entries enable row level security;
alter table public.kpi_snapshots enable row level security;
alter table public.lands enable row level security;
alter table public.leads enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.missions enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notifications enable row level security;
alter table public.outgoing_notifications enable row level security;
alter table public.owner_balances enable row level security;
alter table public.owner_settlements enable row level security;
alter table public.owners enable row level security;
alter table public.payments enable row level security;
alter table public.people enable row level security;
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_owners enable row level security;
alter table public.receipt_allocations enable row level security;
alter table public.receipts enable row level security;
alter table public.schema_refactor_notes enable row level security;
alter table public.serials enable row level security;
alter table public.sessions enable row level security;
alter table public.settings enable row level security;
alter table public.snapshots enable row level security;
alter table public.status_history enable row level security;
alter table public.status_transition_rules enable row level security;
alter table public.tenant_balances enable row level security;
alter table public.tenants enable row level security;
alter table public.units enable row level security;
alter table public.users enable row level security;
alter table public.utility_bills enable row level security;
alter table public.deposit_txs force row level security;
alter table public.owner_settlements force row level security;
alter table public.tenants force row level security;

CREATE POLICY "Admins and managers can manage cost centers" ON public.cost_centers
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "Admins and managers can manage payment terms" ON public.payment_terms_templates
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "Users can view cost centers" ON public.cost_centers
  FOR SELECT TO authenticated USING (public.is_app_user());

CREATE POLICY "Users can view payment terms" ON public.payment_terms_templates
  FOR SELECT TO authenticated USING (public.is_app_user());

create policy admin_read_audit_log on public.audit_log for select to authenticated using (public.is_admin());

create policy admin_read_journal_entries on public.journal_entries for select to authenticated using (public.is_admin_or_manager());

create policy admin_write_accounts on public.accounts for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy app_read_accounts on public.accounts for select to authenticated using (public.is_app_user());

create policy app_read_company_settings on public.company_settings
  for select to authenticated using (public.is_app_user());

create policy app_read_contract_balances on public.contract_balances for select to authenticated using (public.is_app_user());

create policy app_read_contracts on public.contracts for select to authenticated using (public.is_app_user());

create policy app_read_expenses on public.expenses for select to authenticated using (public.is_app_user());

create policy app_read_invoices on public.invoices for select to authenticated using (public.is_app_user());

create policy app_read_maintenance_records on public.maintenance_records for select to authenticated using (public.is_app_user());

create policy app_read_owner_balances on public.owner_balances for select to authenticated using (public.is_app_user());

create policy app_read_owners on public.owners for select to authenticated using (public.is_app_user());

create policy app_read_payments on public.payments for select to authenticated using (public.is_app_user());

create policy app_read_people on public.people for select to authenticated using (public.is_app_user());

create policy app_read_properties on public.properties for select to authenticated using (public.is_app_user());

create policy app_read_property_owners on public.property_owners for select to authenticated using (public.is_app_user());

create policy app_read_receipt_allocations on public.receipt_allocations for select to authenticated using (public.is_app_user());

create policy app_read_receipts on public.receipts for select to authenticated using (public.is_app_user());

create policy app_read_units on public.units for select to authenticated using (public.is_app_user());

create policy app_user_account_balances on public.account_balances
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_app_notifications on public.app_notifications
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_attachments on public.attachments
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_auto_backups on public.auto_backups
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_automation_jobs on public.automation_jobs
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_automation_run_logs on public.automation_run_logs
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_bank_accounts on public.bank_accounts
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_bank_reconciliation_matches on public.bank_reconciliation_matches
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_bank_statement_imports on public.bank_statement_imports
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_bank_statement_lines on public.bank_statement_lines
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_budgets on public.budgets
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_commissions on public.commissions
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_communication_records
  on public.communication_records for all to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());

create policy app_user_contract_documents
  on public.contract_documents for all to authenticated
  using (public.is_app_user())
  with check (public.is_app_user());

create policy app_user_deposit_txs on public.deposit_txs
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_governance on public.governance
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_kpi_snapshots on public.kpi_snapshots
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_lands on public.lands
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_leads on public.leads
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_missions on public.missions
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_notification_templates on public.notification_templates
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_notifications on public.notifications
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_outgoing_notifications on public.outgoing_notifications
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_owner_settlements on public.owner_settlements
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_schema_refactor_notes on public.schema_refactor_notes
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_serials on public.serials
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_settings on public.settings
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_snapshots on public.snapshots
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_status_history on public.status_history
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_status_transition_rules on public.status_transition_rules
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_tenant_balances on public.tenant_balances
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_tenants on public.tenants
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy app_user_utility_bills on public.utility_bills
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy automation_runs_auth on public.automation_runs
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy company_assets_auth on public."company-assets"
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

create policy financial_operation_idempotency_no_direct_access on public.financial_operation_idempotency
  for all to anon, authenticated using (false) with check (false);

create policy manager_write_company_settings on public.company_settings
  for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy manager_write_contracts on public.contracts for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy manager_write_expenses on public.expenses for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy manager_write_invoices on public.invoices for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy manager_write_maintenance_records on public.maintenance_records for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy manager_write_owners on public.owners for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy manager_write_payments on public.payments for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy manager_write_people on public.people for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy manager_write_properties on public.properties for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy manager_write_property_owners on public.property_owners for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy manager_write_receipt_allocations on public.receipt_allocations for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy manager_write_receipts on public.receipts for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy manager_write_units on public.units for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

create policy no_browser_write_journal_entries on public.journal_entries for all to authenticated using (false) with check (false);

CREATE POLICY "owner_agreements_delete"
  ON public.owner_agreements FOR DELETE TO authenticated USING (is_admin_or_manager());

CREATE POLICY "owner_agreements_insert"
  ON public.owner_agreements FOR INSERT TO authenticated WITH CHECK (is_admin_or_manager());

CREATE POLICY "owner_agreements_select"
  ON public.owner_agreements FOR SELECT TO authenticated USING (is_app_user());

CREATE POLICY "owner_agreements_update"
  ON public.owner_agreements FOR UPDATE TO authenticated
  USING (is_admin_or_manager()) WITH CHECK (is_admin_or_manager());

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy sessions_delete_own on public.sessions
  for delete to authenticated
  using (((select auth.uid()) = user_id) or app_private.is_admin_or_manager());

create policy sessions_insert_own on public.sessions
  for insert to authenticated
  with check (((select auth.uid()) = user_id) and app_private.is_app_user());

create policy sessions_select_own on public.sessions
  for select to authenticated
  using (((select auth.uid()) = user_id) or app_private.is_admin_or_manager());

create policy users_admin_write on public.users
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy users_read_self_or_admin on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());


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

revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, service_role;
revoke all on schema public from public;
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on table public.financial_operation_idempotency from anon, authenticated;
grant select, insert, update, delete on public.owner_agreements to authenticated;
grant select, insert, update on public.communication_records to authenticated;
revoke delete on public.communication_records from authenticated;
grant select, insert, update on public.contract_documents to authenticated;
revoke delete on public.contract_documents from authenticated;
grant select, insert, update on public.bank_accounts to authenticated;
grant select, insert, update on public.bank_statement_imports to authenticated;
grant select, insert, update on public.bank_statement_lines to authenticated;
grant select, insert, update on public.bank_reconciliation_matches to authenticated;
revoke delete on public.bank_accounts from authenticated;
revoke delete on public.bank_statement_imports from authenticated;
revoke delete on public.bank_statement_lines from authenticated;
revoke delete on public.bank_reconciliation_matches from authenticated;
revoke all on function app_private.current_app_role() from public, anon;
revoke all on function app_private.is_app_user() from public, anon;
revoke all on function app_private.is_admin_or_manager() from public, anon;
grant execute on function app_private.current_app_role() to authenticated, service_role;
grant execute on function app_private.is_app_user() to authenticated, service_role;
grant execute on function app_private.is_admin_or_manager() to authenticated, service_role;
revoke all on function public.current_app_role() from public, anon, authenticated;
revoke all on function public.is_app_user() from public, anon, authenticated;
revoke all on function public.is_admin_or_manager() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_app_user() to authenticated;
grant execute on function public.is_admin_or_manager() to authenticated;

commit;
