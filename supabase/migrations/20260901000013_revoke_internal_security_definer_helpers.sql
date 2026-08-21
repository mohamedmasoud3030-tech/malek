-- SECURITY DEFINER trigger/helpers must not be exposed as browser RPC endpoints.
-- They execute under their owner when called by table triggers or other trusted
-- server-side functions, so direct authenticated execution is unnecessary and
-- would allow a caller to supply a foreign company identifier.
begin;

revoke all on function public.next_document_reference(uuid, text, text, integer) from public;
revoke all on function public.next_document_reference(uuid, text, text, integer) from anon;
revoke all on function public.next_document_reference(uuid, text, text, integer) from authenticated;
grant execute on function public.next_document_reference(uuid, text, text, integer) to service_role;

revoke all on function public.assign_document_reference() from public;
revoke all on function public.assign_document_reference() from anon;
revoke all on function public.assign_document_reference() from authenticated;
grant execute on function public.assign_document_reference() to service_role;

revoke all on function public.update_unit_status_from_activity() from public;
revoke all on function public.update_unit_status_from_activity() from anon;
revoke all on function public.update_unit_status_from_activity() from authenticated;
grant execute on function public.update_unit_status_from_activity() to service_role;

revoke all on function public.wp05_provision_default_cashflow_classifications(uuid) from public;
revoke all on function public.wp05_provision_default_cashflow_classifications(uuid) from anon;
revoke all on function public.wp05_provision_default_cashflow_classifications(uuid) from authenticated;
grant execute on function public.wp05_provision_default_cashflow_classifications(uuid) to service_role;

commit;
