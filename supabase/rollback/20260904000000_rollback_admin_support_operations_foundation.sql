-- Manual emergency rollback; not auto-applied.
-- Rollback for 20260904000000_admin_support_operations_foundation.sql.
-- Restores historical direct user administration and reason-optional support status access; use only after security review.

begin;
grant select,insert,update,delete on public.users to authenticated;
create policy users_admin_write on public.users for all to authenticated
  using(public.is_admin()) with check(public.is_admin());
grant execute on function public.update_support_request_status_atomic(uuid,text,text) to authenticated,service_role;

drop function if exists public.propose_user_access_change_atomic(uuid,text,boolean,text,uuid);
drop function if exists public.triage_support_request_atomic(uuid,text,text,text,uuid);
drop function if exists public.get_admin_support_operations_snapshot(text);
drop function if exists public.mask_admin_support_email(text);
drop function if exists public.mask_admin_support_name(text);
drop function if exists public.current_user_has_support_capability(text);
drop trigger if exists trg_admin_support_audit_immutable on public.admin_support_audit_events;
drop function if exists public.prevent_admin_support_audit_mutation();
drop table if exists public.admin_user_access_change_proposals;
drop table if exists public.admin_support_audit_events;
drop index if exists public.support_request_events_company_idempotency_idx;
alter table public.support_request_events drop column if exists idempotency_key;
alter table public.support_request_events drop column if exists reason;
delete from public.app_permission_catalog where permission in (
  'support.operations.view','support.requests.triage','support.user_lookup.view'
);
commit;
