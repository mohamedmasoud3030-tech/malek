-- Security containment: recalculate_unit_statuses() is an internal
-- SECURITY DEFINER helper, not a browser RPC.
--
-- The canonical dump revokes PUBLIC and grants service_role, but
-- ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO authenticated
-- still leaves an explicit authenticated EXECUTE grant. The function
-- body has no caller/company/role check and updates unit operational
-- status across companies, so browser execution must be closed.
--
-- ACL only. Function body, ownership, search_path, and data are unchanged.

begin;

revoke all on function public.recalculate_unit_statuses()
  from public, anon, authenticated;

grant execute on function public.recalculate_unit_statuses()
  to service_role;

do $verify_recalculate_unit_statuses_acl$
begin
  if has_function_privilege('anon', 'public.recalculate_unit_statuses()', 'EXECUTE') then
    raise exception 'recalculate_unit_statuses must not be executable by anon';
  end if;

  if has_function_privilege('authenticated', 'public.recalculate_unit_statuses()', 'EXECUTE') then
    raise exception 'recalculate_unit_statuses must not be executable by authenticated';
  end if;

  if not has_function_privilege('service_role', 'public.recalculate_unit_statuses()', 'EXECUTE') then
    raise exception 'recalculate_unit_statuses must remain executable by service_role';
  end if;
end
$verify_recalculate_unit_statuses_acl$;

commit;
