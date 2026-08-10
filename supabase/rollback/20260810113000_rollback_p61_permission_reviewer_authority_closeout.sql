-- P6.1 authority closeout is security hardening. Do not rollback outside an
-- approved incident response; the preceding migration contains the legacy RPCs.
begin;
revoke execute on function public.current_user_has_effective_app_permission(text), public.current_user_can_delegate_app_permission(text) from authenticated;
commit;
