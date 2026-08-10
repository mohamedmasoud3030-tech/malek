-- Manual rollback for 20260810113000_p61_permission_reviewer_authority_closeout.sql —
-- not auto-applied; run by hand only during an approved incident response.
-- P6.1 authority closeout is security hardening; the preceding migration
-- contains the legacy RPCs needed to restore the prior implementation.
begin;
revoke execute on function public.current_user_has_effective_app_permission(text), public.current_user_can_delegate_app_permission(text) from authenticated;
commit;
