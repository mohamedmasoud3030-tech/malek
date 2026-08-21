#!/usr/bin/env node
// Canonical authority resolver + Auth Hook behavioral matrix.
//
// Proves the governance-stabilization fix: active_company_role(),
// current_app_role(), is_admin()/is_admin_or_manager()/is_accountant()/
// is_operations()/is_viewer()/is_app_user(), and custom_access_token_hook()
// all derive authority from company_members.role for a validated active
// membership in an active company, never from users.role, and never fall
// back to a default role when authority cannot be proven.
//
// Replays the current migration chain into disposable PGlite (same engine as
// WP-DB0). Nothing here talks to a hosted project.

import { createDatabase, replay, listMigrations } from '../db0/lib/replay.mjs';

const COMPANY_A = 'c1000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'c1000000-0000-4000-8000-00000000000b';
const COMPANY_INACTIVE = 'c1000000-0000-4000-8000-00000000000c';

// Deliberately-conflicting fixture: users.role vs company_members.role.
const U_CONFLICT_ADMIN_USERS_VIEWER_MEMBER = 'c2000000-0000-4000-8000-000000000001'; // users.role=ADMIN, membership.role=VIEWER
const U_CONFLICT_VIEWER_USERS_ADMIN_MEMBER = 'c2000000-0000-4000-8000-000000000002'; // users.role=VIEWER, membership.role=ADMIN
const U_INACTIVE_IDENTITY = 'c2000000-0000-4000-8000-000000000003'; // users.is_active=false
const U_DELETED_IDENTITY = 'c2000000-0000-4000-8000-000000000004'; // users.deleted_at set
const U_INACTIVE_MEMBERSHIP = 'c2000000-0000-4000-8000-000000000005'; // company_members.is_active=false
const U_INACTIVE_COMPANY = 'c2000000-0000-4000-8000-000000000006'; // membership active, company inactive
const U_NO_MEMBERSHIP = 'c2000000-0000-4000-8000-000000000007'; // no company_members row at all
const U_ACCOUNTANT = 'c2000000-0000-4000-8000-000000000008';
const U_OPERATIONS = 'c2000000-0000-4000-8000-000000000009';
const U_MANAGER = 'c2000000-0000-4000-8000-00000000000a';
const U_PLAIN_USER = 'c2000000-0000-4000-8000-00000000000b';

const results = [];

function record(id, title, status, detail) {
  results.push({ id, title, status, detail });
  const mark = status === 'pass' ? 'PASS' : 'FAIL';
  console.log(`  ${mark.padEnd(4)} ${id}  ${title}`);
  if (status === 'fail' && detail) console.log(`       ${detail}`);
}

function firstLine(error) {
  return String(error?.message ?? error).split('\n')[0].slice(0, 240);
}

async function asUser(db, userId, fn) {
  await db.exec('begin');
  try {
    const claims = JSON.stringify({ sub: userId, role: 'authenticated' });
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    await db.exec(`set local role authenticated`);
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

async function callHook(db, userId) {
  // service_role executes the hook, exactly as supabase_auth_admin would.
  await db.exec('begin');
  try {
    await db.exec(`set local role service_role`);
    const event = JSON.stringify({ user_id: userId, claims: { app_metadata: {} } });
    const res = await db.query(`select public.custom_access_token_hook($1::jsonb) as result`, [event]);
    await db.exec('rollback');
    return res.rows[0].result;
  } catch (error) {
    await db.exec('rollback').catch(() => undefined);
    throw error;
  }
}

async function seed(db) {
  await db.exec(`
    grant anon, authenticated, service_role, supabase_auth_admin to current_user;

    insert into public.companies (id, name, slug, currency, locale, is_active)
    values
      ('${COMPANY_A}', 'Authority Matrix Co A', 'authority-matrix-a', 'OMR', 'ar-OM', true),
      ('${COMPANY_B}', 'Authority Matrix Co B', 'authority-matrix-b', 'OMR', 'ar-OM', true),
      ('${COMPANY_INACTIVE}', 'Authority Matrix Co Inactive', 'authority-matrix-inactive', 'OMR', 'ar-OM', false)
    on conflict (id) do update set is_active = excluded.is_active;

    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) values
      ('${U_CONFLICT_ADMIN_USERS_VIEWER_MEMBER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'conflict1@authority.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_CONFLICT_VIEWER_USERS_ADMIN_MEMBER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'conflict2@authority.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_INACTIVE_IDENTITY}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inactive-identity@authority.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_DELETED_IDENTITY}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'deleted-identity@authority.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_INACTIVE_MEMBERSHIP}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inactive-membership@authority.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_INACTIVE_COMPANY}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inactive-company@authority.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_INACTIVE}"}'::jsonb),
      ('${U_NO_MEMBERSHIP}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'no-membership@authority.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_ACCOUNTANT}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'accountant@authority.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_OPERATIONS}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operations@authority.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_MANAGER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager@authority.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_PLAIN_USER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'plain-user@authority.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb)
    on conflict (id) do update set raw_user_meta_data = excluded.raw_user_meta_data, updated_at = now();

    -- users.role is deliberately set OPPOSITE to company_members.role for the
    -- two conflict fixtures, and to ADMIN for every other "should be denied"
    -- fixture, to prove users.role is never consulted.
    insert into public.users (id, email, name, role, status, is_active, deleted_at)
    values
      ('${U_CONFLICT_ADMIN_USERS_VIEWER_MEMBER}', 'conflict1@authority.test', 'Conflict 1', 'ADMIN', 'ACTIVE', true, null),
      ('${U_CONFLICT_VIEWER_USERS_ADMIN_MEMBER}', 'conflict2@authority.test', 'Conflict 2', 'VIEWER', 'ACTIVE', true, null),
      ('${U_INACTIVE_IDENTITY}', 'inactive-identity@authority.test', 'Inactive Identity', 'ADMIN', 'ACTIVE', false, null),
      ('${U_DELETED_IDENTITY}', 'deleted-identity@authority.test', 'Deleted Identity', 'ADMIN', 'ACTIVE', true, now()),
      ('${U_INACTIVE_MEMBERSHIP}', 'inactive-membership@authority.test', 'Inactive Membership', 'ADMIN', 'ACTIVE', true, null),
      ('${U_INACTIVE_COMPANY}', 'inactive-company@authority.test', 'Inactive Company', 'ADMIN', 'ACTIVE', true, null),
      ('${U_NO_MEMBERSHIP}', 'no-membership@authority.test', 'No Membership', 'ADMIN', 'ACTIVE', true, null),
      ('${U_ACCOUNTANT}', 'accountant@authority.test', 'Accountant', 'VIEWER', 'ACTIVE', true, null),
      ('${U_OPERATIONS}', 'operations@authority.test', 'Operations', 'VIEWER', 'ACTIVE', true, null),
      ('${U_MANAGER}', 'manager@authority.test', 'Manager', 'VIEWER', 'ACTIVE', true, null),
      ('${U_PLAIN_USER}', 'plain-user@authority.test', 'Plain User', 'ADMIN', 'ACTIVE', true, null)
    on conflict (id) do update
      set role = excluded.role, status = excluded.status, is_active = excluded.is_active, deleted_at = excluded.deleted_at;

    insert into public.company_members (company_id, user_id, role, is_active, created_at)
    values
      ('${COMPANY_A}', '${U_CONFLICT_ADMIN_USERS_VIEWER_MEMBER}', 'VIEWER', true, now()),
      ('${COMPANY_A}', '${U_CONFLICT_VIEWER_USERS_ADMIN_MEMBER}', 'ADMIN', true, now()),
      ('${COMPANY_A}', '${U_INACTIVE_IDENTITY}', 'ADMIN', true, now()),
      ('${COMPANY_A}', '${U_DELETED_IDENTITY}', 'ADMIN', true, now()),
      ('${COMPANY_A}', '${U_INACTIVE_MEMBERSHIP}', 'ADMIN', false, now()),
      ('${COMPANY_INACTIVE}', '${U_INACTIVE_COMPANY}', 'ADMIN', true, now()),
      ('${COMPANY_A}', '${U_ACCOUNTANT}', 'ACCOUNTANT', true, now()),
      ('${COMPANY_A}', '${U_OPERATIONS}', 'OPERATIONS', true, now()),
      ('${COMPANY_A}', '${U_MANAGER}', 'MANAGER', true, now()),
      ('${COMPANY_A}', '${U_PLAIN_USER}', 'USER', true, now())
    on conflict (company_id, user_id) do update
      set role = excluded.role, is_active = excluded.is_active;
  `);
}

async function main() {
  const files = await listMigrations();
  const db = await createDatabase();
  const replayResult = await replay(db, { files, stopOnError: true });
  if (replayResult.failures.length > 0) {
    console.error('Migration replay failed before tests could run:', replayResult.failures);
    process.exit(1);
  }
  console.log(`Canonical authority matrix: ${files.length} migrations replayed cleanly.\n`);

  await seed(db);

  // --- 1. Conflicting roles: membership always wins, never users.role. ---
  {
    const r = await asUser(db, U_CONFLICT_ADMIN_USERS_VIEWER_MEMBER, async () =>
      db.query(`select public.active_company_role($1::uuid) as role`, [COMPANY_A]),
    );
    const role = r.ok ? r.value.rows[0].role : null;
    record(
      'AUTH-01',
      'users.role=ADMIN, membership.role=VIEWER -> resolver returns VIEWER',
      role === 'VIEWER' ? 'pass' : 'fail',
      `got: ${JSON.stringify(role)} error: ${r.error ? firstLine(r.error) : 'none'}`,
    );
  }
  {
    const r = await asUser(db, U_CONFLICT_VIEWER_USERS_ADMIN_MEMBER, async () =>
      db.query(`select public.active_company_role($1::uuid) as role`, [COMPANY_A]),
    );
    const role = r.ok ? r.value.rows[0].role : null;
    record(
      'AUTH-02',
      'users.role=VIEWER, membership.role=ADMIN -> resolver returns ADMIN',
      role === 'ADMIN' ? 'pass' : 'fail',
      `got: ${JSON.stringify(role)} error: ${r.error ? firstLine(r.error) : 'none'}`,
    );
  }

  // --- 2. is_admin() must agree with the conflict resolution too. ---
  {
    const r = await asUser(db, U_CONFLICT_ADMIN_USERS_VIEWER_MEMBER, async () => {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: U_CONFLICT_ADMIN_USERS_VIEWER_MEMBER, role: 'authenticated', app_metadata: { company_id: COMPANY_A } }),
      ]);
      return db.query(`select public.is_admin() as is_admin`);
    });
    const isAdmin = r.ok ? r.value.rows[0].is_admin : null;
    record(
      'AUTH-03',
      'is_admin() false when users.role=ADMIN but membership.role=VIEWER',
      isAdmin === false ? 'pass' : 'fail',
      `got: ${JSON.stringify(isAdmin)}`,
    );
  }

  // --- 3. Identity gating: inactive user denied regardless of membership. ---
  {
    const r = await asUser(db, U_INACTIVE_IDENTITY, async () =>
      db.query(`select public.active_company_role($1::uuid) as role`, [COMPANY_A]),
    );
    const role = r.ok ? r.value.rows[0].role : 'ERROR';
    record(
      'AUTH-04',
      'is_active=false -> resolver returns NULL (denied) despite ADMIN membership',
      r.ok && role === null ? 'pass' : 'fail',
      `got: ${JSON.stringify(role)}`,
    );
  }
  {
    const r = await asUser(db, U_DELETED_IDENTITY, async () =>
      db.query(`select public.active_company_role($1::uuid) as role`, [COMPANY_A]),
    );
    const role = r.ok ? r.value.rows[0].role : 'ERROR';
    record(
      'AUTH-05',
      'deleted_at set -> resolver returns NULL (denied) despite ADMIN membership',
      r.ok && role === null ? 'pass' : 'fail',
      `got: ${JSON.stringify(role)}`,
    );
  }

  // --- 4. Membership/company gating. ---
  {
    const r = await asUser(db, U_INACTIVE_MEMBERSHIP, async () =>
      db.query(`select public.active_company_role($1::uuid) as role`, [COMPANY_A]),
    );
    const role = r.ok ? r.value.rows[0].role : 'ERROR';
    record(
      'AUTH-06',
      'company_members.is_active=false -> resolver returns NULL',
      r.ok && role === null ? 'pass' : 'fail',
      `got: ${JSON.stringify(role)}`,
    );
  }
  {
    const r = await asUser(db, U_INACTIVE_COMPANY, async () =>
      db.query(`select public.active_company_role($1::uuid) as role`, [COMPANY_INACTIVE]),
    );
    const role = r.ok ? r.value.rows[0].role : 'ERROR';
    record(
      'AUTH-07',
      'companies.is_active=false -> resolver returns NULL',
      r.ok && role === null ? 'pass' : 'fail',
      `got: ${JSON.stringify(role)}`,
    );
  }
  {
    const r = await asUser(db, U_NO_MEMBERSHIP, async () =>
      db.query(`select public.active_company_role($1::uuid) as role`, [COMPANY_A]),
    );
    const role = r.ok ? r.value.rows[0].role : 'ERROR';
    record(
      'AUTH-08',
      'no company_members row -> resolver returns NULL',
      r.ok && role === null ? 'pass' : 'fail',
      `got: ${JSON.stringify(role)}`,
    );
  }

  // --- 5. Auth Hook: identity-invalid users get no role/company claim. ---
  {
    const out = await callHook(db, U_INACTIVE_IDENTITY);
    const claims = out.claims.app_metadata ?? {};
    record(
      'AUTH-09',
      'Auth Hook: inactive user -> no user_role/company_id claim emitted',
      claims.user_role === undefined && claims.company_id === undefined ? 'pass' : 'fail',
      `got: ${JSON.stringify(claims)}`,
    );
  }
  {
    const out = await callHook(db, U_DELETED_IDENTITY);
    const claims = out.claims.app_metadata ?? {};
    record(
      'AUTH-10',
      'Auth Hook: deleted user -> no user_role/company_id claim emitted',
      claims.user_role === undefined && claims.company_id === undefined ? 'pass' : 'fail',
      `got: ${JSON.stringify(claims)}`,
    );
  }
  {
    const out = await callHook(db, U_INACTIVE_MEMBERSHIP);
    const claims = out.claims.app_metadata ?? {};
    record(
      'AUTH-11',
      'Auth Hook: inactive membership -> no user_role/company_id claim emitted',
      claims.user_role === undefined && claims.company_id === undefined ? 'pass' : 'fail',
      `got: ${JSON.stringify(claims)}`,
    );
  }
  {
    const out = await callHook(db, U_INACTIVE_COMPANY);
    const claims = out.claims.app_metadata ?? {};
    record(
      'AUTH-12',
      'Auth Hook: inactive company -> no user_role/company_id claim emitted',
      claims.user_role === undefined && claims.company_id === undefined ? 'pass' : 'fail',
      `got: ${JSON.stringify(claims)}`,
    );
  }

  // --- 6. Auth Hook: valid conflicting-role users get the membership role. ---
  {
    const out = await callHook(db, U_CONFLICT_ADMIN_USERS_VIEWER_MEMBER);
    const claims = out.claims.app_metadata ?? {};
    record(
      'AUTH-13',
      'Auth Hook: users.role=ADMIN/membership=VIEWER -> claim.user_role=VIEWER',
      claims.user_role === 'VIEWER' && claims.company_id === COMPANY_A ? 'pass' : 'fail',
      `got: ${JSON.stringify(claims)}`,
    );
  }
  {
    const out = await callHook(db, U_CONFLICT_VIEWER_USERS_ADMIN_MEMBER);
    const claims = out.claims.app_metadata ?? {};
    record(
      'AUTH-14',
      'Auth Hook: users.role=VIEWER/membership=ADMIN -> claim.user_role=ADMIN',
      claims.user_role === 'ADMIN' && claims.company_id === COMPANY_A ? 'pass' : 'fail',
      `got: ${JSON.stringify(claims)}`,
    );
  }

  // --- 7. Full six-role helper coverage. ---
  const roleHelperCases = [
    [U_ACCOUNTANT, 'is_accountant', 'AUTH-15'],
    [U_OPERATIONS, 'is_operations', 'AUTH-16'],
    [U_MANAGER, 'is_admin_or_manager', 'AUTH-17'],
    [U_PLAIN_USER, 'is_app_user', 'AUTH-18'],
  ];
  for (const [userId, fnName, id] of roleHelperCases) {
    const r = await asUser(db, userId, async () => {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId, role: 'authenticated', app_metadata: { company_id: COMPANY_A } }),
      ]);
      return db.query(`select public.${fnName}() as result`);
    });
    const value = r.ok ? r.value.rows[0].result : null;
    record(id, `${fnName}() true for its matching active membership role`, value === true ? 'pass' : 'fail', `got: ${JSON.stringify(value)}`);
  }
  // is_viewer should be false for the manager fixture (negative case).
  {
    const r = await asUser(db, U_MANAGER, async () => {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: U_MANAGER, role: 'authenticated', app_metadata: { company_id: COMPANY_A } }),
      ]);
      return db.query(`select public.is_viewer() as result`);
    });
    const value = r.ok ? r.value.rows[0].result : null;
    record('AUTH-19', 'is_viewer() false for a MANAGER membership', value === false ? 'pass' : 'fail', `got: ${JSON.stringify(value)}`);
  }
  // is_app_user should be false when no proven membership exists.
  {
    const r = await asUser(db, U_NO_MEMBERSHIP, async () => {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: U_NO_MEMBERSHIP, role: 'authenticated', app_metadata: { company_id: COMPANY_A } }),
      ]);
      return db.query(`select public.is_app_user() as result`);
    });
    const value = r.ok ? r.value.rows[0].result : null;
    record('AUTH-20', 'is_app_user() false with no active membership', value === false ? 'pass' : 'fail', `got: ${JSON.stringify(value)}`);
  }

  const failed = results.filter((r) => r.status === 'fail');
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.log(`FAILED: ${failed.map((f) => f.id).join(', ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Canonical authority matrix crashed:', error);
  process.exit(1);
});
