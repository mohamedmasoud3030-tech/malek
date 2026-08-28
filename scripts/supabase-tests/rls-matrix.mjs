#!/usr/bin/env node
// Behavioral RLS / authorization / integrity matrix.
//
// Replays the current migration chain into disposable PGlite (same engine as
// WP-DB0) and proves intended access AND denied access for the critical
// role boundaries. This is not a structural policy-text scan and it is not
// the historical P0 checkpoint: it runs against the schema the repository
// builds today.
//
// Nothing here talks to a hosted project. Cleanup is implicit: the database
// lives only in memory.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDatabase, replay, ROOT } from '../db0/lib/replay.mjs';
import { findIsolationViolations } from '../db0/lib/isolation.mjs';
import { introspect } from '../db0/lib/introspect.mjs';

const COMPANY_A = 'a1000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'b1000000-0000-4000-8000-00000000000b';
const ADMIN_A = 'a2000000-0000-4000-8000-000000000001';
const MANAGER_A = 'a2000000-0000-4000-8000-000000000002';
const ACCOUNTANT_A = 'a2000000-0000-4000-8000-000000000003';
const OPERATIONS_A = 'a2000000-0000-4000-8000-000000000004';
const USER_A = 'a2000000-0000-4000-8000-000000000005';
const VIEWER_A = 'a2000000-0000-4000-8000-000000000006';
const INACTIVE_A = 'a2000000-0000-4000-8000-000000000007';
const DELETED_A = 'a2000000-0000-4000-8000-000000000008';
const NOMEM_A = 'a2000000-0000-4000-8000-000000000009';
const ADMIN_B = 'b2000000-0000-4000-8000-000000000001';
const PROP_A = 'a3000000-0000-4000-8000-00000000000a';
const PROP_B = 'b3000000-0000-4000-8000-00000000000b';
const OWNER_A = 'a4000000-0000-4000-8000-00000000000a';
const OWNER_B = 'b4000000-0000-4000-8000-00000000000b';
const PERSON_A = 'a5000000-0000-4000-8000-00000000000a';
const PERSON_B = 'b5000000-0000-4000-8000-00000000000b';
const UNIT_A = 'a6000000-0000-4000-8000-00000000000a';
const UNIT_B = 'b6000000-0000-4000-8000-00000000000b';
const EXPENSE_A = 'a7000000-0000-4000-8000-00000000000a';
const EXPENSE_B = 'b7000000-0000-4000-8000-00000000000b';
const COMM_A = 'READINESS-MATRIX-A';
const COMM_B = 'READINESS-MATRIX-B';

const results = [];

function record(result) {
  results.push(result);
  const mark = result.status === 'pass' ? 'PASS' : result.status === 'skip' ? 'SKIP' : 'FAIL';
  console.log(`  ${mark.padEnd(4)} ${result.id}  ${result.title}`);
  if (result.status === 'fail' && result.detail) console.log(`       ${result.detail}`);
}

function firstLine(error) {
  return String(error?.message ?? error).split('\n')[0].slice(0, 240);
}

function isDenied(error) {
  return /row-level security|policy|permission denied|42501|not in your company|NOT_FOUND_OR_FORBIDDEN|forbidden|not found/i.test(
    String(error?.message ?? error),
  );
}

async function withIdentity(db, identity, fn) {
  const pgRole = identity.pgRole ?? 'authenticated';
  const claims = JSON.stringify({
    sub: identity.userId ?? null,
    role: pgRole,
    email: identity.email ?? null,
    app_metadata: {
      user_role: identity.userRole ?? null,
      company_id: identity.companyId ?? null,
    },
  });
  await db.exec('begin');
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    await db.exec(`set local role ${pgRole}`);
    const value = await fn();
    await db.exec('rollback');
    return { ok: true, value, error: null };
  } catch (error) {
    try {
      await db.exec('rollback');
    } catch {
      /* already aborted */
    }
    return { ok: false, value: null, error };
  }
}

async function queryAs(db, identity, sql, params = []) {
  return withIdentity(db, identity, async () => {
    const res = await db.query(sql, params);
    return res.rows;
  });
}

async function seed(db) {
  await db.exec(`
    grant anon, authenticated, service_role, supabase_auth_admin to current_user;

    insert into public.companies (id, name, slug, currency, locale, is_active)
    values
      ('${COMPANY_A}', 'Matrix Company A', 'matrix-company-a', 'OMR', 'ar-OM', true),
      ('${COMPANY_B}', 'Matrix Company B', 'matrix-company-b', 'OMR', 'ar-OM', true)
    on conflict (id) do update
      set is_active = excluded.is_active, name = excluded.name;

    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) values
      ('${ADMIN_A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin.a@matrix.test', 'not-used', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${MANAGER_A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager.a@matrix.test', 'not-used', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${ACCOUNTANT_A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'accountant.a@matrix.test', 'not-used', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${OPERATIONS_A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operations.a@matrix.test', 'not-used', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${USER_A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user.a@matrix.test', 'not-used', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${VIEWER_A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer.a@matrix.test', 'not-used', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${INACTIVE_A}', '00000000-0000-0000-8000-000000000000', 'authenticated', 'authenticated', 'inactive.a@matrix.test', 'not-used', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${DELETED_A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'deleted.a@matrix.test', 'not-used', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${NOMEM_A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nomem.a@matrix.test', 'not-used', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_B}"}'::jsonb),
      ('${ADMIN_B}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin.b@matrix.test', 'not-used', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_B}"}'::jsonb)
    on conflict (id) do update
      set raw_user_meta_data = excluded.raw_user_meta_data, updated_at = now();

    insert into public.users (id, email, name, role, status, is_active, deleted_at)
    values
      ('${ADMIN_A}', 'admin.a@matrix.test', 'Admin A', 'ADMIN', 'ACTIVE', true, null),
      ('${MANAGER_A}', 'manager.a@matrix.test', 'Manager A', 'MANAGER', 'ACTIVE', true, null),
      ('${ACCOUNTANT_A}', 'accountant.a@matrix.test', 'Accountant A', 'ACCOUNTANT', 'ACTIVE', true, null),
      ('${OPERATIONS_A}', 'operations.a@matrix.test', 'Operations A', 'OPERATIONS', 'ACTIVE', true, null),
      ('${USER_A}', 'user.a@matrix.test', 'User A', 'USER', 'ACTIVE', true, null),
      ('${VIEWER_A}', 'viewer.a@matrix.test', 'Viewer A', 'VIEWER', 'ACTIVE', true, null),
      ('${INACTIVE_A}', 'inactive.a@matrix.test', 'Inactive A', 'ADMIN', 'INACTIVE', false, null),
      ('${DELETED_A}', 'deleted.a@matrix.test', 'Deleted A', 'ADMIN', 'ACTIVE', true, now()),
      ('${NOMEM_A}', 'nomem.a@matrix.test', 'No Membership A', 'ADMIN', 'ACTIVE', true, null),
      ('${ADMIN_B}', 'admin.b@matrix.test', 'Admin B', 'ADMIN', 'ACTIVE', true, null)
    on conflict (id) do update
      set role = excluded.role, status = excluded.status, is_active = excluded.is_active, deleted_at = excluded.deleted_at;

    insert into public.company_members (company_id, user_id, role, is_active, created_at)
    values
      ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN', true, timestamptz '2026-01-01 00:00:00+00'),
      ('${COMPANY_A}', '${MANAGER_A}', 'MANAGER', true, timestamptz '2026-01-01 00:00:01+00'),
      ('${COMPANY_A}', '${ACCOUNTANT_A}', 'ACCOUNTANT', true, timestamptz '2026-01-01 00:00:02+00'),
      ('${COMPANY_A}', '${OPERATIONS_A}', 'OPERATIONS', true, timestamptz '2026-01-01 00:00:03+00'),
      ('${COMPANY_A}', '${USER_A}', 'USER', true, timestamptz '2026-01-01 00:00:04+00'),
      ('${COMPANY_A}', '${VIEWER_A}', 'VIEWER', true, timestamptz '2026-01-01 00:00:05+00'),
      ('${COMPANY_A}', '${INACTIVE_A}', 'ADMIN', true, timestamptz '2026-01-01 00:00:06+00'),
      ('${COMPANY_A}', '${DELETED_A}', 'ADMIN', true, timestamptz '2026-01-01 00:00:07+00'),
      ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN', true, timestamptz '2026-01-01 00:00:08+00')
    on conflict (company_id, user_id) do update
      set role = excluded.role, is_active = excluded.is_active;

    insert into public.owners (id, full_name, company_id)
    values
      ('${OWNER_A}', 'Owner A', '${COMPANY_A}'),
      ('${OWNER_B}', 'Owner B', '${COMPANY_B}')
    on conflict (id) do nothing;

    insert into public.properties (id, title, type, address, status, company_id)
    values
      ('${PROP_A}', 'Property A', 'residential', 'Muscat A', 'active', '${COMPANY_A}'),
      ('${PROP_B}', 'Property B', 'residential', 'Muscat B', 'active', '${COMPANY_B}')
    on conflict (id) do nothing;

    insert into public.units (id, property_id, unit_number, status, rent_amount, company_id)
    values
      ('${UNIT_A}', '${PROP_A}', 'A-1', 'available', 100, '${COMPANY_A}'),
      ('${UNIT_B}', '${PROP_B}', 'B-1', 'available', 200, '${COMPANY_B}')
    on conflict (id) do nothing;

    insert into public.people (id, full_name, type, company_id)
    values
      ('${PERSON_A}', 'Tenant A', 'tenant', '${COMPANY_A}'),
      ('${PERSON_B}', 'Tenant B', 'tenant', '${COMPANY_B}')
    on conflict (id) do nothing;
  `);

  try {
    await db.exec(`
      insert into public.expenses (id, property_id, category, amount, expense_date, status, charged_to, company_id)
      values
        ('${EXPENSE_A}', '${PROP_A}', 'maintenance', 25, date '2026-07-15', 'POSTED', 'office', '${COMPANY_A}'),
        ('${EXPENSE_B}', '${PROP_B}', 'maintenance', 80, date '2026-07-15', 'POSTED', 'office', '${COMPANY_B}')
      on conflict (id) do nothing;
    `);
  } catch (error) {
    await db.exec('rollback').catch(() => undefined);
    await db.exec(`
      insert into public.expenses (id, property_id, category, amount, expense_date, company_id)
      values
        ('${EXPENSE_A}', '${PROP_A}', 'maintenance', 25, date '2026-07-15', '${COMPANY_A}'),
        ('${EXPENSE_B}', '${PROP_B}', 'maintenance', 80, date '2026-07-15', '${COMPANY_B}')
      on conflict (id) do nothing;
    `);
  }

  try {
    await db.exec(`
      insert into public.commissions (id, staff_name, type, source_id, status, amount, company_id, created_at, updated_at)
      values
        ('${COMM_A}', 'Broker A', 'contract', '${PROP_A}', 'pending', 100, '${COMPANY_A}', now(), now()),
        ('${COMM_B}', 'Broker B', 'contract', '${PROP_B}', 'pending', 200, '${COMPANY_B}', now(), now())
      on conflict (id) do nothing;
    `);
  } catch (error) {
    await db.exec('rollback').catch(() => undefined);
    console.log(`  note: commissions fixture skipped (${firstLine(error)})`);
  }
}

function identities() {
  return {
    anon: { pgRole: 'anon', userId: null, companyId: null, userRole: null, label: 'anon' },
    adminA: { pgRole: 'authenticated', userId: ADMIN_A, companyId: COMPANY_A, userRole: 'ADMIN', label: 'adminA' },
    managerA: { pgRole: 'authenticated', userId: MANAGER_A, companyId: COMPANY_A, userRole: 'MANAGER', label: 'managerA' },
    accountantA: { pgRole: 'authenticated', userId: ACCOUNTANT_A, companyId: COMPANY_A, userRole: 'ACCOUNTANT', label: 'accountantA' },
    operationsA: { pgRole: 'authenticated', userId: OPERATIONS_A, companyId: COMPANY_A, userRole: 'OPERATIONS', label: 'operationsA' },
    userA: { pgRole: 'authenticated', userId: USER_A, companyId: COMPANY_A, userRole: 'USER', label: 'userA' },
    viewerA: { pgRole: 'authenticated', userId: VIEWER_A, companyId: COMPANY_A, userRole: 'VIEWER', label: 'viewerA' },
    inactiveA: { pgRole: 'authenticated', userId: INACTIVE_A, companyId: COMPANY_A, userRole: 'ADMIN', label: 'inactiveA' },
    deletedA: { pgRole: 'authenticated', userId: DELETED_A, companyId: COMPANY_A, userRole: 'ADMIN', label: 'deletedA' },
    noMemA: { pgRole: 'authenticated', userId: NOMEM_A, companyId: COMPANY_B, userRole: 'ADMIN', label: 'noMembership' },
    adminB: { pgRole: 'authenticated', userId: ADMIN_B, companyId: COMPANY_B, userRole: 'ADMIN', label: 'adminB' },
    spoofB: { pgRole: 'authenticated', userId: ADMIN_A, companyId: COMPANY_B, userRole: 'ADMIN', label: 'adminA-spoofing-B' },
    service: { pgRole: 'service_role', userId: ADMIN_A, companyId: COMPANY_A, userRole: 'ADMIN', label: 'service_role' },
  };
}

async function expectCount(db, identity, sql, expected, spec) {
  const result = await queryAs(db, identity, sql);
  if (!result.ok) {
    record({
      ...spec,
      status: expected === 'deny' ? 'pass' : 'fail',
      detail: expected === 'deny' ? undefined : firstLine(result.error),
    });
    return;
  }
  const actual = Number(result.value?.[0]?.n ?? result.value?.[0]?.count ?? NaN);
  if (expected === 'deny') {
    record({
      ...spec,
      status: actual === 0 ? 'pass' : 'fail',
      detail: actual === 0 ? undefined : `expected 0 visible rows, got ${actual}`,
    });
    return;
  }
  record({
    ...spec,
    status: actual === expected ? 'pass' : 'fail',
    detail: actual === expected ? undefined : `expected ${expected}, got ${actual}`,
  });
}

async function expectMutationDenied(db, identity, sql, spec) {
  const result = await queryAs(db, identity, sql);
  if (!result.ok) {
    record({
      ...spec,
      status: isDenied(result.error) ? 'pass' : 'fail',
      detail: isDenied(result.error) ? undefined : firstLine(result.error),
    });
    return;
  }
  const affected = Number(result.value?.[0]?.n ?? 0);
  record({
    ...spec,
    status: affected === 0 ? 'pass' : 'fail',
    detail: affected === 0 ? undefined : `mutation unexpectedly affected ${affected} row(s)`,
  });
}

async function expectMutationAllowed(db, identity, sql, spec) {
  const result = await queryAs(db, identity, sql);
  if (!result.ok) {
    record({
      ...spec,
      status: 'fail',
      detail: firstLine(result.error),
    });
    return;
  }
  const affected = Number(result.value?.[0]?.n ?? 1);
  record({
    ...spec,
    status: affected > 0 ? 'pass' : 'fail',
    detail: affected > 0 ? undefined : 'mutation returned no rows',
  });
}

async function expectRpcDenied(db, identity, sql, spec) {
  const result = await queryAs(db, identity, sql);
  record({
    ...spec,
    status: !result.ok && isDenied(result.error) ? 'pass' : result.ok ? 'fail' : 'fail',
    detail: result.ok
      ? `RPC unexpectedly succeeded: ${JSON.stringify(result.value).slice(0, 160)}`
      : isDenied(result.error)
        ? undefined
        : firstLine(result.error),
  });
}

async function expectHelper(db, identity, sql, expected, spec) {
  const result = await queryAs(db, identity, sql);
  if (!result.ok) {
    record({ ...spec, status: 'fail', detail: firstLine(result.error) });
    return;
  }
  const actual = result.value?.[0]?.v;
  // Boolean-returning helpers may legitimately resolve to SQL NULL when
  // authority cannot be proven (fail-closed); treat NULL as equivalent to
  // false for boolean expectations so the comparison isn't a stricter check
  // than the authorization semantics it is verifying.
  const normalized = actual === null && expected === false ? false : actual;
  record({
    ...spec,
    status: String(normalized) === String(expected) ? 'pass' : 'fail',
    detail: String(normalized) === String(expected) ? undefined : `expected ${expected}, got ${actual}`,
  });
}

async function runStructural(db, schema) {
  console.log('\n[structural] RLS, grants, storage, privileged objects');
  const { tenantTables, violations } = findIsolationViolations(schema);
  record({
    id: 'struct.isolation',
    group: 'structural',
    title: `company-scoped tables keep RLS/policy/FK isolation (${tenantTables.length} tables)`,
    status: violations.length === 0 ? 'pass' : 'fail',
    detail: violations.slice(0, 5).map((v) => `${v.rule}: ${v.detail}`).join('; '),
  });

  const publicTables = schema.tables ?? [];
  const rlsOff = publicTables.filter((table) => !table.rls_enabled);
  record({
    id: 'struct.rls_all_tables',
    group: 'structural',
    title: 'every public table has RLS enabled',
    status: rlsOff.length === 0 ? 'pass' : 'fail',
    detail: rlsOff.map((table) => table.name).join(', '),
  });

  const bucket = (await db.query(
    `select id, public, file_size_limit, allowed_mime_types
       from storage.buckets where id = 'attachments'`,
  )).rows[0];
  const mime = (bucket?.allowed_mime_types ?? []).slice().sort().join(',');
  record({
    id: 'struct.storage_bucket',
    group: 'storage',
    title: 'attachments bucket is private with the 5MB PDF/image contract',
    status:
      bucket
      && bucket.public === false
      && Number(bucket.file_size_limit) === 5242880
      && mime === 'application/pdf,image/jpeg,image/png,image/webp'
        ? 'pass'
        : 'fail',
    detail: bucket ? JSON.stringify(bucket) : 'attachments bucket missing',
  });

  const storageMutation = (await db.query(`
    select count(*)::int as n
      from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
       and (
         coalesce(qual, '') ilike '%attachments%'
         or coalesce(with_check, '') ilike '%attachments%'
         or policyname ilike '%attachments%'
       )
       and concat_ws(' ', qual, with_check) not ilike '%is_admin_or_manager()%'
  `)).rows[0]?.n;
  record({
    id: 'struct.storage_write_admin',
    group: 'storage',
    title: 'attachments mutation policies require ADMIN or MANAGER',
    status: Number(storageMutation) === 0 ? 'pass' : 'fail',
    detail: storageMutation ? `${storageMutation} overly-permissive storage policies` : undefined,
  });

  const anonDefiners = (await db.query(`
    select p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and has_function_privilege('anon', p.oid, 'EXECUTE')
     order by p.proname, pg_get_function_identity_arguments(p.oid)
  `)).rows;
  const allowedAnonDefiners = new Set([
    'get_owner_portal_snapshot(p_token uuid)',
    'get_tenant_portal_snapshot(p_token uuid)',
    'get_owner_portal_snapshot(uuid)',
    'get_tenant_portal_snapshot(uuid)',
  ]);
  const anonDefinerNames = anonDefiners.map((row) => `${row.name}(${row.args})`);
  const unexpectedAnonDefiners = anonDefinerNames.filter((sig) => !allowedAnonDefiners.has(sig));
  const missingAllowed = [...allowedAnonDefiners].filter((sig) => !anonDefinerNames.includes(sig));
  record({
    id: 'struct.no_anon_definer',
    group: 'structural',
    title: 'only audited portal snapshot RPCs are anon-executable SECURITY DEFINER (get_owner_portal_snapshot, get_tenant_portal_snapshot)',
    status: unexpectedAnonDefiners.length === 0 && anonDefinerNames.length === 2 ? 'pass' : 'fail',
    detail: unexpectedAnonDefiners.length
      ? `unexpected anon definers: ${unexpectedAnonDefiners.join(', ')}; allowed: ${[...allowedAnonDefiners].join(', ')}; found: ${anonDefinerNames.join(', ')}`
      : anonDefinerNames.length !== 2
        ? `expected exactly 2 audited anon definers, found ${anonDefinerNames.length}: ${anonDefinerNames.join(', ')}`
        : `${anonDefinerNames.length} anon-executable definers: ${anonDefinerNames.join(', ')}`,
  });

  const hookGrants = (await db.query(`
    select
      has_function_privilege('anon', 'public.custom_access_token_hook(jsonb)', 'EXECUTE') as anon_ok,
      has_function_privilege('authenticated', 'public.custom_access_token_hook(jsonb)', 'EXECUTE') as auth_ok,
      has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'EXECUTE') as hook_ok
  `)).rows[0];
  record({
    id: 'struct.hook_grants',
    group: 'auth',
    title: 'auth hook is callable only by supabase_auth_admin',
    status: hookGrants && hookGrants.anon_ok === false && hookGrants.auth_ok === false && hookGrants.hook_ok === true
      ? 'pass'
      : 'fail',
    detail: JSON.stringify(hookGrants),
  });

  const hookMeta = (await db.query(`
    select p.prosecdef as security_definer,
           coalesce(array_to_string(p.proconfig, ','), '') as config
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'custom_access_token_hook'
       and pg_get_function_identity_arguments(p.oid) = 'event jsonb'
  `)).rows[0];
  record({
    id: 'struct.hook_definer_search_path',
    group: 'auth',
    title: 'auth hook is SECURITY DEFINER with a pinned search_path',
    status: hookMeta?.security_definer === true && /search_path/i.test(hookMeta?.config ?? '') ? 'pass' : 'fail',
    detail: JSON.stringify(hookMeta),
  });

  const views = schema.views ?? [];
  const insecureViews = views.filter((view) => String(view.security_invoker) !== 'true');
  record({
    id: 'struct.view_invoker',
    group: 'structural',
    title: 'every public view uses security_invoker',
    status: insecureViews.length === 0 ? 'pass' : 'fail',
    detail: insecureViews.map((view) => view.name).join(', '),
  });
}

async function runAuthLifecycle(db) {
  console.log('\n[auth] profile, membership, hook, inactive/deleted users');
  const ids = identities();

  await expectHelper(
    db,
    ids.adminA,
    'select public.current_company_id()::text as v',
    COMPANY_A,
    { id: 'auth.current_company_admin_a', group: 'auth', title: 'ADMIN A JWT resolves Company A' },
  );
  await expectHelper(
    db,
    ids.adminB,
    'select public.current_company_id()::text as v',
    COMPANY_B,
    { id: 'auth.current_company_admin_b', group: 'auth', title: 'ADMIN B JWT resolves Company B' },
  );
  await expectHelper(
    db,
    { pgRole: 'authenticated', userId: ADMIN_A, companyId: null, userRole: 'ADMIN', label: 'adminA-no-claim' },
    'select public.current_company_id()::text as v',
    null,
    { id: 'auth.current_company_missing_claim', group: 'auth', title: 'missing company claim fail-closes current_company_id()' },
  );
  await expectHelper(
    db,
    ids.adminA,
    'select public.is_app_user() as v',
    true,
    { id: 'auth.is_app_user_admin', group: 'auth', title: 'active ADMIN is an app user' },
  );
  await expectHelper(
    db,
    ids.inactiveA,
    'select public.is_app_user() as v',
    false,
    { id: 'auth.inactive_user_denied', group: 'auth', title: 'inactive user is not an app user' },
  );
  await expectHelper(
    db,
    ids.deletedA,
    'select public.is_app_user() as v',
    false,
    { id: 'auth.deleted_user_denied', group: 'auth', title: 'soft-deleted user is not an app user' },
  );
  await expectHelper(
    db,
    ids.inactiveA,
    `select public.is_admin_or_manager() as v`,
    false,
    { id: 'auth.inactive_admin_not_manager', group: 'auth', title: 'inactive ADMIN cannot keep manager authority' },
  );

  const hookOwn = await db.query(
    `select public.custom_access_token_hook($1::jsonb)->'claims'->'app_metadata'->>'company_id' as company_id,
            public.custom_access_token_hook($1::jsonb)->'claims'->'app_metadata'->>'user_role' as user_role`,
    [JSON.stringify({ user_id: ADMIN_A, claims: { role: 'authenticated', app_metadata: {} } })],
  );
  record({
    id: 'auth.hook_selects_membership',
    group: 'auth',
    title: 'access-token hook stamps Company A and ADMIN from live membership',
    status: hookOwn.rows[0]?.company_id === COMPANY_A && hookOwn.rows[0]?.user_role === 'ADMIN' ? 'pass' : 'fail',
    detail: JSON.stringify(hookOwn.rows[0]),
  });

  const hookSpoof = await db.query(
    `select public.custom_access_token_hook($1::jsonb)->'claims'->'app_metadata'->>'company_id' as company_id`,
    [JSON.stringify({
      user_id: ADMIN_A,
      claims: { role: 'authenticated', app_metadata: { company_id: COMPANY_B } },
    })],
  );
  record({
    id: 'auth.hook_ignores_spoofed_claim',
    group: 'auth',
    title: 'incoming Company B claim cannot override Admin A membership',
    status: hookSpoof.rows[0]?.company_id === COMPANY_A ? 'pass' : 'fail',
    detail: JSON.stringify(hookSpoof.rows[0]),
  });

  const hookNoMem = await db.query(
    `select public.custom_access_token_hook($1::jsonb)->'claims'->'app_metadata'->>'company_id' as company_id`,
    [JSON.stringify({
      user_id: NOMEM_A,
      claims: { role: 'authenticated', app_metadata: { company_id: COMPANY_B } },
    })],
  );
  record({
    id: 'auth.hook_no_membership',
    group: 'auth',
    title: 'user with no membership receives no company claim',
    status: hookNoMem.rows[0]?.company_id == null ? 'pass' : 'fail',
    detail: JSON.stringify(hookNoMem.rows[0]),
  });

  await db.exec(`
    update public.company_members
       set is_active = false
     where company_id = '${COMPANY_A}' and user_id = '${USER_A}'
  `);
  const hookInactiveMembership = await db.query(
    `select public.custom_access_token_hook($1::jsonb)->'claims'->'app_metadata'->>'company_id' as company_id`,
    [JSON.stringify({ user_id: USER_A, claims: { role: 'authenticated', app_metadata: {} } })],
  );
  record({
    id: 'auth.hook_inactive_membership',
    group: 'auth',
    title: 'inactive membership cannot issue a company claim',
    status: hookInactiveMembership.rows[0]?.company_id == null ? 'pass' : 'fail',
    detail: JSON.stringify(hookInactiveMembership.rows[0]),
  });
  await db.exec(`
    update public.company_members
       set is_active = true
     where company_id = '${COMPANY_A}' and user_id = '${USER_A}'
  `);
}

async function issuedIdentity(db, userId, requestedCompanyId, userRole) {
  await db.exec(`
    update auth.users
       set raw_user_meta_data = jsonb_build_object('company_id', '${requestedCompanyId}')
     where id = '${userId}'
  `);
  const hooked = await db.query(
    `select public.custom_access_token_hook($1::jsonb) as event`,
    [JSON.stringify({
      user_id: userId,
      claims: { role: 'authenticated', app_metadata: { user_role: userRole, company_id: requestedCompanyId } },
    })],
  );
  const claims = hooked.rows[0]?.event?.claims ?? {};
  return {
    pgRole: 'authenticated',
    userId,
    companyId: claims?.app_metadata?.company_id ?? null,
    userRole: claims?.app_metadata?.user_role ?? userRole,
    label: `hooked:${userId}`,
  };
}

async function runVisibility(db) {
  console.log('\n[visibility] SELECT allow/deny across roles and tenants');
  const ids = identities();
  const tables = [
    ['properties', PROP_A, PROP_B],
    ['owners', OWNER_A, OWNER_B],
    ['people', PERSON_A, PERSON_B],
    ['units', UNIT_A, UNIT_B],
    ['expenses', EXPENSE_A, EXPENSE_B],
  ];

  for (const [table] of tables) {
    await expectCount(
      db,
      ids.anon,
      `select count(*)::int as n from public.${table} where id in ('${PROP_A}','${PROP_B}','${OWNER_A}','${OWNER_B}','${PERSON_A}','${PERSON_B}','${UNIT_A}','${UNIT_B}','${EXPENSE_A}','${EXPENSE_B}')`,
      'deny',
      { id: `rls.anon.select.${table}`, group: 'rls-select', title: `anon cannot read ${table}` },
    );
  }

  for (const [table, ownId, otherId] of tables) {
    await expectCount(
      db,
      ids.adminA,
      `select count(*)::int as n from public.${table} where id in ('${ownId}','${otherId}')`,
      1,
      { id: `rls.adminA.select.${table}`, group: 'rls-select', title: `ADMIN A sees only own-company ${table}` },
    );
    await expectCount(
      db,
      ids.adminB,
      `select count(*)::int as n from public.${table} where id in ('${ownId}','${otherId}')`,
      1,
      { id: `rls.adminB.select.${table}`, group: 'rls-select', title: `ADMIN B sees only own-company ${table}` },
    );
    await expectCount(
      db,
      ids.userA,
      `select count(*)::int as n from public.${table} where id = '${ownId}'`,
      1,
      { id: `rls.userA.select.${table}`, group: 'rls-select', title: `USER A can read own-company ${table}` },
    );
    await expectCount(
      db,
      ids.viewerA,
      `select count(*)::int as n from public.${table} where id = '${ownId}'`,
      1,
      { id: `rls.viewerA.select.${table}`, group: 'rls-select', title: `VIEWER A can read own-company ${table}` },
    );
    const issued = await issuedIdentity(db, ADMIN_A, COMPANY_B, 'ADMIN');
    await expectCount(
      db,
      issued,
      `select count(*)::int as n from public.${table} where id = '${otherId}'`,
      'deny',
      { id: `rls.hook_to_rls.select.${table}`, group: 'rls-select', title: `hook-issued Admin A token cannot read Company B ${table}` },
    );
    await expectCount(
      db,
      ids.inactiveA,
      `select count(*)::int as n from public.${table} where id = '${ownId}'`,
      'deny',
      { id: `rls.inactive.select.${table}`, group: 'rls-select', title: `inactive user cannot read ${table}` },
    );
  }

  await expectCount(
    db,
    ids.userA,
    `select count(*)::int as n from public.financial_operation_idempotency`,
    'deny',
    { id: 'rls.userA.select.idempotency', group: 'rls-select', title: 'browser USER cannot read idempotency records' },
  );
  const issuedNoMem = await issuedIdentity(db, NOMEM_A, COMPANY_B, 'ADMIN');
  await expectCount(
    db,
    issuedNoMem,
    `select count(*)::int as n from public.properties where id in ('${PROP_A}','${PROP_B}')`,
    'deny',
    { id: 'rls.nomembership.select.properties', group: 'rls-select', title: 'hook-issued token with no membership cannot read either company property' },
  );
}

async function runMutations(db) {
  console.log('\n[mutations] INSERT/UPDATE/DELETE allow/deny and spoofed company_id');
  const ids = identities();

  await expectMutationAllowed(
    db,
    ids.adminA,
    `with u as (
       insert into public.properties (title, type, address, status, company_id)
       values ('Created by Admin A', 'residential', 'A', 'active', '${COMPANY_A}')
       returning id
     ) select count(*)::int as n from u`,
    { id: 'rls.adminA.insert.properties', group: 'rls-write', title: 'ADMIN A can insert a Company A property' },
  );

  await expectMutationDenied(
    db,
    ids.adminA,
    `with u as (
       insert into public.properties (title, type, address, status, company_id)
       values ('Spoof into B', 'residential', 'B', 'active', '${COMPANY_B}')
       returning id
     ) select count(*)::int as n from u`,
    { id: 'rls.adminA.insert.spoof_company', group: 'rls-write', title: 'ADMIN A cannot insert a Company B property' },
  );

  await expectMutationDenied(
    db,
    ids.adminB,
    `with u as (
       update public.properties set notes = 'crossed' where id = '${PROP_A}' returning id
     ) select count(*)::int as n from u`,
    { id: 'rls.adminB.update.propertyA', group: 'rls-write', title: 'ADMIN B cannot update Company A property' },
  );

  await expectMutationDenied(
    db,
    ids.adminB,
    `with u as (
       delete from public.properties where id = '${PROP_A}' returning id
     ) select count(*)::int as n from u`,
    { id: 'rls.adminB.delete.propertyA', group: 'rls-write', title: 'ADMIN B cannot delete Company A property' },
  );

  await expectMutationDenied(
    db,
    ids.userA,
    `with u as (
       insert into public.properties (title, type, address, status, company_id)
       values ('User write', 'residential', 'A', 'active', '${COMPANY_A}')
       returning id
     ) select count(*)::int as n from u`,
    { id: 'rls.userA.insert.properties', group: 'rls-write', title: 'USER cannot insert properties' },
  );

  await expectMutationDenied(
    db,
    ids.viewerA,
    `with u as (
       update public.properties set notes = 'viewer' where id = '${PROP_A}' returning id
     ) select count(*)::int as n from u`,
    { id: 'rls.viewerA.update.properties', group: 'rls-write', title: 'VIEWER cannot update properties' },
  );

  await expectMutationDenied(
    db,
    ids.accountantA,
    `with u as (
       insert into public.properties (title, type, address, status, company_id)
       values ('Accountant write', 'residential', 'A', 'active', '${COMPANY_A}')
       returning id
     ) select count(*)::int as n from u`,
    { id: 'rls.accountantA.insert.properties', group: 'rls-write', title: 'ACCOUNTANT cannot insert properties' },
  );

  await expectMutationDenied(
    db,
    ids.anon,
    `with u as (
       insert into public.properties (title, type, address, status, company_id)
       values ('Anon write', 'residential', 'A', 'active', '${COMPANY_A}')
       returning id
     ) select count(*)::int as n from u`,
    { id: 'rls.anon.insert.properties', group: 'rls-write', title: 'anon cannot insert properties' },
  );

  await expectMutationAllowed(
    db,
    ids.managerA,
    `with u as (
       update public.properties set notes = 'manager-ok' where id = '${PROP_A}' returning id
     ) select count(*)::int as n from u`,
    { id: 'rls.managerA.update.propertyA', group: 'rls-write', title: 'MANAGER A can update own-company property' },
  );

  // OPERATIONS may still appear in the SQL catalog for properties.write,
  // but the current properties write policy is is_admin_or_manager().
  // Record the live database truth. The frontend now fences the same way.
  const operationsWrite = await queryAs(
    db,
    ids.operationsA,
    `with u as (
       insert into public.properties (title, type, address, status, company_id)
       values ('Operations write', 'residential', 'A', 'active', '${COMPANY_A}')
       returning id
     ) select count(*)::int as n from u`,
  );
  record({
    id: 'rls.operationsA.insert.properties',
    group: 'rls-write',
    title: 'OPERATIONS property insert is enforced by is_admin_or_manager() (DB deny)',
    status: !operationsWrite.ok || Number(operationsWrite.value?.[0]?.n ?? 0) === 0 ? 'pass' : 'fail',
    detail: operationsWrite.ok
      ? 'OPERATIONS unexpectedly inserted a property'
      : undefined,
    note: 'Frontend grants properties.write to OPERATIONS; RLS still requires ADMIN/MANAGER.',
  });

  await expectMutationDenied(
    db,
    ids.adminA,
    `with u as (
       update public.expenses set amount = amount + 1 where id = '${EXPENSE_B}' returning id
     ) select count(*)::int as n from u`,
    { id: 'rls.adminA.update.expenseB', group: 'rls-write', title: 'ADMIN A cannot update Company B expense' },
  );

  await expectMutationDenied(
    db,
    ids.userA,
    `with u as (
       insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
       values ('probe', 'matrix-1', '{}'::jsonb)
       returning request_id
     ) select count(*)::int as n from u`,
    { id: 'rls.userA.insert.idempotency', group: 'rls-write', title: 'browser USER cannot write idempotency records' },
  );

  const journalWrite = await queryAs(
    db,
    ids.adminA,
    `select to_regclass('public.journal_lines') as lines, to_regclass('public.journal_entries') as entries`,
  );
  if (journalWrite.ok && journalWrite.value?.[0]?.lines) {
    await expectMutationDenied(
      db,
      ids.adminA,
      `with u as (
         insert into public.journal_lines (id) values (gen_random_uuid()) returning id
       ) select count(*)::int as n from u`,
      { id: 'rls.adminA.insert.journal_lines', group: 'rls-write', title: 'browser ADMIN cannot insert journal lines directly' },
    );
  } else {
    record({
      id: 'rls.adminA.insert.journal_lines',
      group: 'rls-write',
      title: 'browser ADMIN cannot insert journal lines directly',
      status: 'skip',
      detail: 'journal_lines not present as a table in this replay',
    });
  }
}

async function runRpcs(db) {
  console.log('\n[rpc] SECURITY DEFINER company isolation and role gates');
  const ids = identities();

  const hasCommissionRpc = (await db.query(
    `select to_regprocedure('public.create_commission_atomic(jsonb)') is not null as ok`,
  )).rows[0]?.ok;
  if (hasCommissionRpc) {
    await expectRpcDenied(
      db,
      ids.adminA,
      `select public.update_commission_atomic('{"commission_id":"${COMM_B}","staff_name":"Cross-company","type":"contract","requested_status":"approved","amount":200,"request_id":"matrix-cross-a-to-b"}'::jsonb)`,
      { id: 'rpc.adminA.update_commission_b', group: 'rpc', title: 'ADMIN A cannot update Company B commission via RPC' },
    );

    const createOwn = await withIdentity(db, ids.adminA, async () => {
      await db.query(
        `select public.create_commission_atomic('{"staff_name":"Created by A","type":"contract","source_id":"${PROP_A}","amount":125,"request_id":"matrix-create-a"}'::jsonb) as out`,
      );
      const stamped = await db.query(
        `select company_id::text as company_id from public.commissions where staff_name = 'Created by A' limit 1`,
      );
      return stamped.rows[0]?.company_id;
    });
    record({
      id: 'rpc.adminA.create_commission',
      group: 'rpc',
      title: 'ADMIN A can create a commission in Company A',
      status: createOwn.ok ? 'pass' : 'fail',
      detail: createOwn.ok ? undefined : firstLine(createOwn.error),
    });
    record({
      id: 'rpc.adminA.create_commission.stamped',
      group: 'rpc',
      title: 'commission RPC stamps Company A server-side',
      status: createOwn.ok && createOwn.value === COMPANY_A ? 'pass' : createOwn.ok ? 'fail' : 'skip',
      detail: createOwn.ok ? `stamped=${createOwn.value}` : firstLine(createOwn.error),
    });
  } else {
    record({
      id: 'rpc.adminA.create_commission',
      group: 'rpc',
      title: 'ADMIN A can create a commission in Company A',
      status: 'skip',
      detail: 'create_commission_atomic is not present',
    });
  }

  const hasPaymentRpc = (await db.query(
    `select to_regprocedure('public.record_invoice_payment_atomic(jsonb)') is not null as ok`,
  )).rows[0]?.ok;
  if (hasPaymentRpc) {
    await expectRpcDenied(
      db,
      ids.adminA,
      `select public.record_invoice_payment_atomic(jsonb_build_object(
         'invoice_id', 'b8000000-0000-4000-8000-00000000000b',
         'amount', 5,
         'method', 'cash',
         'date', '2026-07-21',
         'reference', 'matrix-cross',
         'request_id', 'matrix-cross-pay'
       ))`,
      { id: 'rpc.adminA.pay_foreign_invoice', group: 'rpc', title: 'ADMIN A cannot pay a foreign/missing invoice' },
    );
    await expectRpcDenied(
      db,
      ids.anon,
      `select public.record_invoice_payment_atomic('{"invoice_id":"${PROP_A}","amount":1,"request_id":"anon-pay"}'::jsonb)`,
      { id: 'rpc.anon.pay_invoice', group: 'rpc', title: 'anon cannot execute payment RPC' },
    );
  }

  const hasDashboard = (await db.query(
    `select to_regprocedure('public.rpt_dashboard_snapshot(date,date,date)') is not null as ok`,
  )).rows[0]?.ok;
  if (hasDashboard) {
    const snapA = await queryAs(
      db,
      ids.adminA,
      `select public.rpt_dashboard_snapshot(date '2026-07-01', date '2026-07-31', date '2026-07-31') as out`,
    );
    const snapB = await queryAs(
      db,
      ids.adminB,
      `select public.rpt_dashboard_snapshot(date '2026-07-01', date '2026-07-31', date '2026-07-31') as out`,
    );
    const countA = Number(snapA.value?.[0]?.out?.portfolio?.properties ?? snapA.value?.[0]?.out?.operational?.properties ?? NaN);
    const countB = Number(snapB.value?.[0]?.out?.portfolio?.properties ?? snapB.value?.[0]?.out?.operational?.properties ?? NaN);
    record({
      id: 'rpc.dashboard.company_isolation',
      group: 'rpc',
      title: 'dashboard snapshot is callable and company-scoped for A and B',
      status: snapA.ok && snapB.ok ? 'pass' : 'fail',
      detail: snapA.ok && snapB.ok
        ? `A properties=${countA} B properties=${countB}`
        : firstLine(snapA.error || snapB.error),
    });
    await expectRpcDenied(
      db,
      ids.anon,
      `select public.rpt_dashboard_snapshot(date '2026-07-01', date '2026-07-31', date '2026-07-31')`,
      { id: 'rpc.anon.dashboard', group: 'rpc', title: 'anon cannot execute dashboard snapshot' },
    );
  }

  const sixRole = (await db.query(`
    select
      public.role_has_app_permission('ADMIN', 'users.manage') as admin_users,
      public.role_has_app_permission('MANAGER', 'users.manage') as manager_users,
      public.role_has_app_permission('ACCOUNTANT', 'properties.write') as accountant_props,
      public.role_has_app_permission('OPERATIONS', 'financial.payments.create') as operations_pay,
      public.role_has_app_permission('USER', 'properties.write') as user_props,
      public.role_has_app_permission('VIEWER', 'documents.write') as viewer_docs,
      public.role_has_app_permission('SUPERADMIN', 'users.manage') as superadmin
  `)).rows[0];
  record({
    id: 'auth.six_role_matrix',
    group: 'auth',
    title: 'six-role permission helper allow/deny matches the locked matrix',
    status:
      sixRole?.admin_users === true
      && sixRole?.manager_users === false
      && sixRole?.accountant_props === false
      && sixRole?.operations_pay === false
      && sixRole?.user_props === false
      && sixRole?.viewer_docs === false
      && sixRole?.superadmin === false
        ? 'pass'
        : 'fail',
    detail: JSON.stringify(sixRole),
  });
}

async function runIntegrity(db) {
  console.log('\n[integrity] constraints, generated values, service-role bypass');
  const ids = identities();

  const overlap = await db.query(`
    select conname
      from pg_constraint
     where conrelid = 'public.contracts'::regclass
       and conname = 'contracts_no_active_unit_overlap'
  `);
  record({
    id: 'integrity.unit_overlap_exclusion',
    group: 'integrity',
    title: 'active contracts cannot overlap on the same unit',
    status: overlap.rows.length === 1 ? 'pass' : 'fail',
    detail: overlap.rows.length ? undefined : 'contracts_no_active_unit_overlap missing',
  });

  const roleCheck = await db.query(`
    select 1
      from pg_constraint
     where conname = 'users_role_valid_chk'
       and conrelid = 'public.users'::regclass
  `);
  record({
    id: 'integrity.users_role_check',
    group: 'integrity',
    title: 'users.role is constrained to the six canonical roles',
    status: roleCheck.rows.length === 1 ? 'pass' : 'fail',
  });

  const serviceSeeBoth = await queryAs(
    db,
    ids.service,
    `select count(*)::int as n from public.properties where id in ('${PROP_A}','${PROP_B}')`,
  );
  record({
    id: 'integrity.service_role_bypass',
    group: 'integrity',
    title: 'service_role can read both companies (server-only privilege)',
    status: serviceSeeBoth.ok && Number(serviceSeeBoth.value?.[0]?.n) === 2 ? 'pass' : 'fail',
    detail: serviceSeeBoth.ok ? `visible=${serviceSeeBoth.value?.[0]?.n}` : firstLine(serviceSeeBoth.error),
  });

  const ownerName = await db.query(
    `select name from public.owners where id = '${OWNER_A}'`,
  );
  record({
    id: 'integrity.owner_name_generated',
    group: 'integrity',
    title: 'owner compatibility name is populated from full_name',
    status: ownerName.rows[0]?.name === 'Owner A' ? 'pass' : 'fail',
    detail: JSON.stringify(ownerName.rows[0]),
  });
}

const started = Date.now();
console.log('Supabase behavioral RLS / auth / integrity matrix');
console.log('='.repeat(70));

const db = await createDatabase();
const replayed = await replay(db, { stopOnError: false });
if (replayed.failures.length) {
  console.error(`Migration replay failed (${replayed.failures.length}).`);
  for (const failure of replayed.failures.slice(0, 8)) {
    console.error(`  ${failure.file}: ${failure.error}`);
  }
  process.exit(2);
}
console.log(`Replayed ${replayed.applied.length} migrations.`);

try {
  const referenceSeed = await readFile(join(ROOT, 'supabase', 'seed.sql'), 'utf8');
  await db.exec(referenceSeed);
  console.log('Applied canonical reference seed.');
} catch (error) {
  console.error(`Reference seed failed: ${firstLine(error)}`);
  process.exit(2);
}

try {
  await seed(db);
} catch (error) {
  console.error(`Fixture seed failed: ${firstLine(error)}`);
  process.exit(2);
}

const schema = await introspect(db);
await runStructural(db, schema);
await runAuthLifecycle(db);
await runVisibility(db);
await runMutations(db);
await runRpcs(db);
await runIntegrity(db);

await db.close();

const passed = results.filter((row) => row.status === 'pass').length;
const failed = results.filter((row) => row.status === 'fail').length;
const skipped = results.filter((row) => row.status === 'skip').length;
const seconds = ((Date.now() - started) / 1000).toFixed(1);

console.log('\n' + '='.repeat(70));
console.log(`Supabase RLS matrix  ${passed} passed  ${failed} failed  ${skipped} skipped  (${seconds}s)`);
console.log('='.repeat(70));

if (typeof process.send === 'function') {
  process.send?.({ passed, failed, skipped, seconds, results });
}

process.exit(failed ? 1 : 0);
