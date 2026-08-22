-- Security hardening: this is an internal provisioning helper, not a client RPC.
-- It accepts an arbitrary company UUID and writes financial classifications,
-- so it must not be reachable from the public PostgREST/GraphQL API surface.
--
-- Keep execution available to trusted server-side work only. Revoke PUBLIC as
-- well as anon/authenticated because default EXECUTE grants can otherwise make
-- a SECURITY DEFINER function callable again.

begin;

revoke all on function public.wp05_provision_default_cashflow_classifications(uuid)
  from public, anon, authenticated;

grant execute on function public.wp05_provision_default_cashflow_classifications(uuid)
  to service_role;

commit;
