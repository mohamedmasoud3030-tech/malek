-- General Supabase security/drift checks.
--
-- Unlike release_blockers.sql (which pins specific launch-critical RPC
-- behavior), this file asserts *global invariants* across every object in
-- `public`, so newly added tables/functions are automatically covered
-- without needing to update a hardcoded list every time.
begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- 1. RLS must be enabled on every table in public, no exceptions.
select ok(
  not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ),
  'RLS is enabled on every table in the public schema'
);

-- 2. Every SECURITY DEFINER function in public pins a non-empty search_path
-- (either "public" alone or "public, pg_temp"). An unpinned search_path lets
-- a caller who can influence session state redirect unqualified identifiers
-- to a hostile schema.
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') !~ 'search_path=("?public"?)(,\s*"?pg_temp"?)?$'
  ),
  'every SECURITY DEFINER function in public pins a safe, non-empty search_path'
);

-- 3. No SECURITY DEFINER function in public is executable by anon.
-- Privileged RPCs should only ever be reachable by authenticated sessions
-- (or not exposed via PostgREST at all).
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'no SECURITY DEFINER function in public is executable by anon'
);

-- 4. Every trigger function (SECURITY DEFINER or not) also pins a safe
-- search_path. These run implicitly on DML and are just as exploitable as
-- RPCs if a hostile schema can shadow an unqualified reference.
select ok(
  not exists (
    select distinct p.oid
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not t.tgisinternal
      and coalesce(array_to_string(p.proconfig, ','), '') !~ 'search_path=("?public"?)(,\s*"?pg_temp"?)?$'
  ),
  'every trigger function bound to a public table pins a safe search_path'
);

-- Note: we deliberately do NOT assert "anon has no table-level GRANT" here.
-- Supabase's standard convention grants table-level INSERT/UPDATE/DELETE to
-- anon/authenticated by default and relies on RLS policies (checked above)
-- as the actual enforcement layer. Asserting on GRANT alone produces a
-- wall of false positives across nearly every table in this project and
-- tests the wrong layer of the security model.

-- 5. Every FK column named *_id referencing an owners/contracts/properties/
-- units/tenants/people row must have a supporting index, or RLS/FK joins on
-- these hot paths degrade to sequential scans as data grows.
select ok(
  not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    join pg_class frel on frel.oid = con.confrelid
    where n.nspname = 'public'
      and con.contype = 'f'
      and frel.relname in ('owners', 'contracts', 'properties', 'units', 'tenants', 'people')
      and not exists (
        select 1
        from pg_index idx
        where idx.indrelid = con.conrelid
          and (con.conkey::int[])[1] = any(idx.indkey::int[])
      )
  ),
  'every FK referencing a core entity table has a supporting index on the referencing column'
);

select * from finish();
rollback;
