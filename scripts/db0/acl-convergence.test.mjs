/**
 * ACL convergence regression test.
 *
 * Applies the full canonical migration chain to a clean PGlite (real
 * PostgreSQL) database, then asserts the privilege end state that
 * `20260917000001_converge_authenticated_delete_privileges.sql` establishes and
 * that the read-only production probe `scripts/verify-supabase-live-readiness.sh`
 * checks against live.
 *
 * It also executes the probe's own assertions against this database, so the SQL
 * shipped for production measurement is proven to parse and to hold on a
 * conformant database rather than being validated only by inspection.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { createDatabase, listMigrations, replay } from './lib/replay.mjs';

const repoRoot = join(import.meta.dirname, '..', '..');

/**
 * Boots one clean database with the full canonical chain applied and shares it
 * across every test — replaying 108 migrations per assertion would be wasteful
 * and would obscure a chain failure behind repeated work.
 */
let sharedDatabase;
async function convergedDatabase() {
  if (!sharedDatabase) {
    sharedDatabase = (async () => {
      const db = await createDatabase();
      const files = await listMigrations();
      const result = await replay(db, { files, stopOnError: true });
      assert.equal(result.failures?.length ?? 0, 0, 'the canonical migration chain must apply cleanly');
      return db;
    })();
  }
  return sharedDatabase;
}

test('the canonical chain leaves browser roles without DELETE or TRUNCATE on any public table', async () => {
  const db = await convergedDatabase();

  const { rows } = await db.query(`
    select g.table_name, g.grantee, g.privilege_type
    from information_schema.role_table_grants g
    join information_schema.tables t
      on t.table_schema = g.table_schema
     and t.table_name = g.table_name
     and t.table_type = 'BASE TABLE'
    where g.table_schema = 'public'
      and g.privilege_type in ('DELETE', 'TRUNCATE')
      and lower(g.grantee) in ('authenticated', 'anon', 'public')
  `);

  assert.deepEqual(
    rows,
    [],
    `browser roles must not hold DELETE/TRUNCATE, found: ${JSON.stringify(rows)}`,
  );
}, { timeout: 120_000 });

test('the direct-write surface keeps INSERT and UPDATE for authenticated', async () => {
  const db = await convergedDatabase();

  const expected = [
    'properties', 'units', 'people', 'leads', 'lands', 'owners',
    'property_owners', 'communication_records', 'company_settings',
    'cost_centers', 'payment_terms_templates', 'automation_rules',
    'utility_bills', 'utility_meters', 'vault_documents',
    'service_provider_categories',
  ];

  const { rows } = await db.query(`
    select g.table_name, g.privilege_type
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.grantee = 'authenticated'
      and g.privilege_type in ('INSERT', 'UPDATE')
      and g.table_name = any($1)
  `, [expected]);

  const held = new Set(rows.map((row) => `${row.table_name}:${row.privilege_type}`));
  const missing = [];
  for (const table of expected) {
    for (const privilege of ['INSERT', 'UPDATE']) {
      if (!held.has(`${table}:${privilege}`)) missing.push(`${table}:${privilege}`);
    }
  }

  assert.deepEqual(missing, [], `the UI write path would fail with 42501 for: ${missing.join(', ')}`);
}, { timeout: 120_000 });

test('maintenance_records stays UPDATE-only for authenticated', async () => {
  const db = await convergedDatabase();

  const { rows } = await db.query(`
    select privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'maintenance_records'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    order by privilege_type
  `);

  assert.deepEqual(rows.map((row) => row.privilege_type), ['UPDATE']);
}, { timeout: 120_000 });

test('every public base table has row level security enabled', async () => {
  const db = await convergedDatabase();

  const { rows } = await db.query(`
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    order by c.relname
  `);

  assert.deepEqual(rows, [], `tables without RLS: ${rows.map((row) => row.relname).join(', ')}`);
}, { timeout: 120_000 });

test('the production probe SQL parses and holds on a conformant database', async () => {
  const db = await convergedDatabase();

  // P1 — the probe's DELETE/TRUNCATE assertion body.
  await db.query(`
    do $probe$
    declare
      v_offenders text;
    begin
      select string_agg(distinct g.table_name || '(' || g.grantee || ':' || g.privilege_type || ')', ', ' order by g.table_name || '(' || g.grantee || ':' || g.privilege_type || ')')
        into v_offenders
      from information_schema.role_table_grants g
      join information_schema.tables t
        on t.table_schema = g.table_schema
       and t.table_name = g.table_name
       and t.table_type = 'BASE TABLE'
      where g.table_schema = 'public'
        and g.privilege_type in ('DELETE', 'TRUNCATE')
        and lower(g.grantee) in ('authenticated', 'anon', 'public');

      if v_offenders is not null then
        raise exception 'ACL DRIFT: %', v_offenders using errcode = '42501';
      end if;
    end
    $probe$;
  `);

  // P4 — the probe's RLS assertion body.
  await db.query(`
    do $probe$
    declare
      v_unprotected text;
    begin
      select string_agg(c.relname, ', ' order by c.relname) into v_unprotected
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

      if v_unprotected is not null then
        raise exception 'RLS DRIFT: %', v_unprotected using errcode = '42501';
      end if;
    end
    $probe$;
  `);

  // P5 — the probe's SECURITY DEFINER search_path assertion body.
  await db.query(`
    do $probe$
    declare
      v_unpinned text;
    begin
      select string_agg(p.proname || '(' || pg_get_function_arguments(p.oid) || ')', ', ' order by p.proname)
        into v_unpinned
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef
        and (p.proconfig is null or not exists (
          select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%'
        ));

      if v_unpinned is not null then
        raise exception 'DEFINER DRIFT: %', v_unpinned using errcode = '42501';
      end if;
    end
    $probe$;
  `);

  assert.ok(true, 'all probe assertion bodies executed without raising');
}, { timeout: 120_000 });
