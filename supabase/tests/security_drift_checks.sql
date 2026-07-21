-- General Supabase security/drift checks.
--
-- Unlike release_blockers.sql (which pins specific launch-critical RPC
-- behavior), this file asserts global invariants across public and the
-- launch-critical private Storage bucket.
begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

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

-- 2. Every SECURITY DEFINER function in public pins a safe search_path.
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

-- 4. Trigger functions bound to public tables also pin a safe search_path.
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

-- We deliberately do not assert on table-level GRANT alone. Supabase grants
-- broad table privileges and relies on RLS as the enforcement layer.

-- 5. Core-entity foreign keys must have a supporting index.
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

-- 6. The attachment vault must remain private and match the browser contract.
select ok(
  exists (
    select 1
    from storage.buckets b
    where b.id = 'attachments'
      and b.public is false
      and b.file_size_limit = 5242880
      and b.allowed_mime_types @> array['application/pdf','image/jpeg','image/png','image/webp']::text[]
      and b.allowed_mime_types <@ array['application/pdf','image/jpeg','image/png','image/webp']::text[]
  ),
  'attachments bucket is private with the canonical 5MB PDF/image contract'
);

-- 7. Any mutation policy targeting attachments must require manager/admin.
-- This catches legacy permissive policies such as a bucket_id-only INSERT rule.
select ok(
  not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and (
        coalesce(p.qual, '') ilike '%attachments%'
        or coalesce(p.with_check, '') ilike '%attachments%'
        or p.policyname ilike '%attachments%'
      )
      and concat_ws(' ', p.qual, p.with_check) not ilike '%is_admin_or_manager()%'
  ),
  'every attachments mutation policy requires ADMIN or MANAGER'
);

select * from finish();
rollback;
