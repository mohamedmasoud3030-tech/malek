-- Manual rollback — not auto-applied; emergency use only after security review.
-- Rollback for: 20260809190000_p61_cumulative_security_documents_hardening.sql
-- This mitigation reopens the historical P3 table policies and therefore must
-- never be used merely to resolve an application defect. It intentionally keeps
-- the hardened RPC/catalog and document metadata so rollback cannot strand the
-- application with missing function dependencies or destroy document history.

begin;


-- Restore the prior role-based company-settings policy.
drop policy if exists admin_write_company_settings on public.company_settings;
create policy manager_write_company_settings on public.company_settings
  for all to authenticated using (public.is_admin_or_manager()) with check (public.is_admin_or_manager());

-- Restore the prior broad notification policy only if an emergency rollback is
-- explicitly approved. The company restrictive policy remains in force.
drop policy if exists app_notifications_read_own on public.app_notifications;
drop policy if exists app_notifications_update_own on public.app_notifications;
create policy app_user_app_notifications on public.app_notifications
  for all to authenticated using (app_private.is_app_user()) with check (app_private.is_app_user());

-- Restore historical mutation policies and grants.
create policy permission_requests_insert_self on public.permission_requests
  for insert to authenticated with check (company_id = public.require_company_id() and requester_user_id = auth.uid());
create policy permission_requests_update_manager on public.permission_requests
  for update to authenticated
  using (company_id = public.current_company_id() and public.is_admin_or_manager())
  with check (company_id = public.current_company_id() and public.is_admin_or_manager());
create policy permission_grants_manager_write on public.user_permission_grants
  for all to authenticated
  using (company_id = public.current_company_id() and public.is_admin_or_manager())
  with check (company_id = public.current_company_id() and public.is_admin_or_manager());
grant insert, update on public.permission_requests to authenticated;
grant insert, update, delete on public.user_permission_grants to authenticated;


commit;
