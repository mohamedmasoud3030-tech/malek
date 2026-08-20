-- After applying a pg_dump baseline through supabase start, default GRANTs
-- to PUBLIC/anon rematerialize. Restore the fail-closed ACL posture that the
-- historical chain had already proven. Object definitions stay unchanged.

begin;

revoke all on all tables in schema public from public, anon;
revoke all on all sequences in schema public from public, anon;
revoke all on all functions in schema public from public, anon;

alter default privileges in schema public revoke all on tables from public, anon;
alter default privileges in schema public revoke all on sequences from public, anon;
alter default privileges in schema public revoke all on functions from public, anon;

grant usage on schema public to authenticated, service_role;
grant select on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Browser mutations stay RPC-owned. Keep write privileges off authenticated
-- for financial and membership tables that pgTAP inspects.
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
grant insert, update, delete on table public.audit_log to authenticated;

-- Approved RPCs remain executable by authenticated (and service_role).
do $grants$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end
$grants$;

commit;
