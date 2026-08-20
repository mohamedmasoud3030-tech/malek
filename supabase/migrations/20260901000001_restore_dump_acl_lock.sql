-- After applying a pg_dump baseline through supabase start, default GRANTs
-- to PUBLIC/anon rematerialize. Restore fail-closed ACLs without exposing
-- internal SECURITY DEFINER helpers to authenticated.

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

revoke insert, update, delete, truncate on all tables in schema public from authenticated;
grant insert, update, delete on table public.audit_log to authenticated;

-- Internal helpers must stay hidden from browser roles.
do $revoke_internal$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname like '\\_%'
        or p.proname like 'assert\\_%'
        or p.proname like 'backfill\\_%'
        or p.proname like '%\\_internal'
        or p.proname in (
          'custom_access_token_hook',
          'provision_company_chart_of_accounts',
          'ensure_company_account',
          'gl_ml_insert_schedule_rows'
        )
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end
$revoke_internal$;

-- Compatibility archive table expected by Stage-3 tests; canonicalize dropped
-- the live archive while keeping journal_batches/lines as the store.
create table if not exists public.journal_entries_archive (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  created_at timestamptz default now()
);
alter table public.journal_entries_archive enable row level security;
revoke all on table public.journal_entries_archive from public, anon, authenticated;

commit;
