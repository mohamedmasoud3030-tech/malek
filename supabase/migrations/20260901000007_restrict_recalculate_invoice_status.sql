-- SEC-003 / SEC-010: keep invoice status recalculation server-owned.
--
-- recalculate_invoice_status(uuid) is an internal SECURITY DEFINER helper.
-- Browser roles must not execute it directly; only trusted server work may do so.

revoke all on function public.recalculate_invoice_status(uuid)
  from public, anon, authenticated;

grant execute on function public.recalculate_invoice_status(uuid)
  to service_role;

do $verify_recalculate_invoice_status_acl$
begin
  if has_function_privilege(
    'authenticated',
    'public.recalculate_invoice_status(uuid)',
    'EXECUTE'
  ) then
    raise exception 'recalculate_invoice_status must not be executable by authenticated';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.recalculate_invoice_status(uuid)',
    'EXECUTE'
  ) then
    raise exception 'recalculate_invoice_status must remain executable by service_role';
  end if;
end
$verify_recalculate_invoice_status_acl$;
