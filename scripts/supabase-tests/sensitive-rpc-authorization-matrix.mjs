#!/usr/bin/env node
// Sensitive RPC authorization boundary matrix (Phases 4 + 7).
//
// Proves the deployed EXECUTE boundary and the effective role/company behavior
// of the hardened financial RPCs. Permission-governed RPC expectations are
// derived from role_has_app_permission, not from their old ADMIN/MANAGER guards.
//
// post_receipt_atomic and execute_receipt_void_internal are intentionally not
// browser-executable. After asserting their deployed ACLs, this disposable
// PGlite test grants authenticated EXECUTE only inside the temporary database so
// their defense-in-depth authorization blocks can be exercised directly.

import { createDatabase, replay, listMigrations } from '../db0/lib/replay.mjs';

const COMPANY_A = 'd1000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'd1000000-0000-4000-8000-00000000000c';
const COMPANY_INACTIVE = 'd1000000-0000-4000-8000-00000000000b';

const U_ADMIN = 'd2000000-0000-4000-8000-000000000001'; // users.role=VIEWER, membership=ADMIN
const U_MANAGER = 'd2000000-0000-4000-8000-000000000002'; // users.role=VIEWER, membership=MANAGER
const U_VIEWER_WITH_ADMIN_USERS_ROLE = 'd2000000-0000-4000-8000-000000000003'; // users.role=ADMIN, membership=VIEWER
const U_ACCOUNTANT = 'd2000000-0000-4000-8000-000000000004'; // users.role=VIEWER, membership=ACCOUNTANT
const U_INACTIVE_IDENTITY_ADMIN_MEMBER = 'd2000000-0000-4000-8000-000000000005';
const U_DELETED_IDENTITY_ADMIN_MEMBER = 'd2000000-0000-4000-8000-000000000006';
const U_INACTIVE_COMPANY_ADMIN_MEMBER = 'd2000000-0000-4000-8000-000000000007';
const U_NO_MEMBERSHIP = 'd2000000-0000-4000-8000-000000000008';
const U_OPERATIONS = 'd2000000-0000-4000-8000-000000000009';
const U_USER = 'd2000000-0000-4000-8000-00000000000a';

const results = [];

function record(id, title, status, detail) {
  results.push({ id, title, status, detail });
  const mark = status === 'pass' ? 'PASS' : 'FAIL';
  console.log(`  ${mark.padEnd(4)} ${id}  ${title}`);
  if (status === 'fail' && detail) console.log(`       ${detail}`);
}

function firstLine(error) {
  return String(error?.message ?? error).split('\n')[0].slice(0, 320);
}

function isAuthorityDenied(error) {
  return /Authenticated app user is required|financial\.[a-z0-9_.]+ is required|ADMIN or MANAGER role is required|غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول/i.test(
    String(error?.message ?? error),
  );
}

async function asUser(db, userId, companyId, fn) {
  await db.exec('begin');
  try {
    const claims = JSON.stringify({
      sub: userId,
      role: 'authenticated',
      app_metadata: { company_id: companyId },
    });
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    await db.exec('set local role authenticated');
    const value = await fn();
    await db.exec('rollback');
    return { ok: true, value, error: null };
  } catch (error) {
    try { await db.exec('rollback'); } catch { /* already aborted */ }
    return { ok: false, value: null, error };
  }
}

async function seed(db) {
  await db.exec(`
    grant anon, authenticated, service_role, supabase_auth_admin to current_user;

    insert into public.companies (id, name, slug, currency, locale, is_active)
    values
      ('${COMPANY_A}', 'RPC Auth Matrix Co A', 'rpc-auth-matrix-a', 'OMR', 'ar-OM', true),
      ('${COMPANY_B}', 'RPC Auth Matrix Co B', 'rpc-auth-matrix-b', 'OMR', 'ar-OM', true),
      ('${COMPANY_INACTIVE}', 'RPC Auth Matrix Co Inactive', 'rpc-auth-matrix-inactive', 'OMR', 'ar-OM', false)
    on conflict (id) do update set is_active = excluded.is_active;

    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) values
      ('${U_ADMIN}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@rpcauth.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_MANAGER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager@rpcauth.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_VIEWER_WITH_ADMIN_USERS_ROLE}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer-conflict@rpcauth.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_ACCOUNTANT}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'accountant@rpcauth.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_INACTIVE_IDENTITY_ADMIN_MEMBER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inactive-admin@rpcauth.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_DELETED_IDENTITY_ADMIN_MEMBER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'deleted-admin@rpcauth.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_INACTIVE_COMPANY_ADMIN_MEMBER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inactive-company-admin@rpcauth.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_INACTIVE}"}'::jsonb),
      ('${U_NO_MEMBERSHIP}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'no-membership@rpcauth.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_OPERATIONS}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operations@rpcauth.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb),
      ('${U_USER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user@rpcauth.test', 'x', now(), now(), now(), '{}'::jsonb, '{"company_id":"${COMPANY_A}"}'::jsonb)
    on conflict (id) do update set raw_user_meta_data = excluded.raw_user_meta_data, updated_at = now();

    -- users.role is deliberately misleading. Positive permission cases use
    -- users.role=VIEWER; a negative VIEWER membership uses users.role=ADMIN.
    insert into public.users (id, email, name, role, status, is_active, deleted_at)
    values
      ('${U_ADMIN}', 'admin@rpcauth.test', 'Admin', 'VIEWER', 'ACTIVE', true, null),
      ('${U_MANAGER}', 'manager@rpcauth.test', 'Manager', 'VIEWER', 'ACTIVE', true, null),
      ('${U_VIEWER_WITH_ADMIN_USERS_ROLE}', 'viewer-conflict@rpcauth.test', 'Viewer Conflict', 'ADMIN', 'ACTIVE', true, null),
      ('${U_ACCOUNTANT}', 'accountant@rpcauth.test', 'Accountant', 'VIEWER', 'ACTIVE', true, null),
      ('${U_INACTIVE_IDENTITY_ADMIN_MEMBER}', 'inactive-admin@rpcauth.test', 'Inactive Admin', 'VIEWER', 'ACTIVE', false, null),
      ('${U_DELETED_IDENTITY_ADMIN_MEMBER}', 'deleted-admin@rpcauth.test', 'Deleted Admin', 'VIEWER', 'ACTIVE', true, now()),
      ('${U_INACTIVE_COMPANY_ADMIN_MEMBER}', 'inactive-company-admin@rpcauth.test', 'Inactive Company Admin', 'VIEWER', 'ACTIVE', true, null),
      ('${U_NO_MEMBERSHIP}', 'no-membership@rpcauth.test', 'No Membership', 'ADMIN', 'ACTIVE', true, null),
      ('${U_OPERATIONS}', 'operations@rpcauth.test', 'Operations', 'ADMIN', 'ACTIVE', true, null),
      ('${U_USER}', 'user@rpcauth.test', 'User', 'ADMIN', 'ACTIVE', true, null)
    on conflict (id) do update
      set role = excluded.role, status = excluded.status, is_active = excluded.is_active, deleted_at = excluded.deleted_at;

    insert into public.company_members (company_id, user_id, role, is_active, created_at)
    values
      ('${COMPANY_A}', '${U_ADMIN}', 'ADMIN', true, now()),
      ('${COMPANY_A}', '${U_MANAGER}', 'MANAGER', true, now()),
      ('${COMPANY_A}', '${U_VIEWER_WITH_ADMIN_USERS_ROLE}', 'VIEWER', true, now()),
      ('${COMPANY_A}', '${U_ACCOUNTANT}', 'ACCOUNTANT', true, now()),
      ('${COMPANY_A}', '${U_INACTIVE_IDENTITY_ADMIN_MEMBER}', 'ADMIN', true, now()),
      ('${COMPANY_A}', '${U_DELETED_IDENTITY_ADMIN_MEMBER}', 'ADMIN', true, now()),
      ('${COMPANY_INACTIVE}', '${U_INACTIVE_COMPANY_ADMIN_MEMBER}', 'ADMIN', true, now()),
      ('${COMPANY_A}', '${U_OPERATIONS}', 'OPERATIONS', true, now()),
      ('${COMPANY_A}', '${U_USER}', 'USER', true, now())
    on conflict (company_id, user_id) do update set role = excluded.role, is_active = excluded.is_active;
  `);
}

async function callRpc(db, fnName, payload) {
  const res = await db.query(`select public.${fnName}($1::jsonb) as result`, [JSON.stringify(payload)]);
  return res.rows[0].result;
}

async function hasExecutePrivilege(db, role, signature) {
  const res = await db.query(`select has_function_privilege($1, $2, 'EXECUTE') as allowed`, [role, signature]);
  return Boolean(res.rows[0].allowed);
}

async function main() {
  const files = await listMigrations();
  const db = await createDatabase();
  const replayResult = await replay(db, { files, stopOnError: true });
  if (replayResult.failures.length > 0) {
    console.error('Migration replay failed before tests could run:', replayResult.failures);
    process.exit(1);
  }
  console.log(`Sensitive RPC authorization matrix: ${files.length} migrations replayed cleanly.\n`);

  await seed(db);

  console.log('[deployed EXECUTE boundaries]');
  const grantCases = [
    ['GRANT-1', 'authenticated cannot execute post_receipt_atomic', 'public.post_receipt_atomic(jsonb)', false],
    ['GRANT-2', 'authenticated cannot execute execute_receipt_void_internal', 'public.execute_receipt_void_internal(jsonb)', false],
    ['GRANT-3', 'authenticated can execute preview_bank_statement_batch_atomic', 'public.preview_bank_statement_batch_atomic(jsonb)', true],
    ['GRANT-4', 'authenticated can execute import_bank_statement_batch_atomic', 'public.import_bank_statement_batch_atomic(jsonb)', true],
  ];
  for (const [id, title, rpcSignature, expected] of grantCases) {
    const actual = await hasExecutePrivilege(db, 'authenticated', rpcSignature);
    record(id, title, actual === expected ? 'pass' : 'fail', `expected=${expected} actual=${actual}`);
  }

  // Test-only opening of internal functions after proving their deployed ACLs.
  await db.exec(`
    grant execute on function public.post_receipt_atomic(jsonb) to authenticated;
    grant execute on function public.execute_receipt_void_internal(jsonb) to authenticated;
  `);

  const minimalReceiptPayload = { request_id: 'test-req-1', receipt: {}, allocations: [], journal_entries: [] };
  const minimalVoidPayload = { receipt_id: '00000000-0000-0000-0000-000000000000', reason: 'test', request_id: 'test-void-1' };
  const minimalBankPayload = {
    bank_account_id: '00000000-0000-0000-0000-000000000000',
    file_name: 'test.csv',
    file_fingerprint: 'abc123',
    file_size: 10,
    rows: [],
  };

  const invalidAuthorityCases = [
    [U_INACTIVE_IDENTITY_ADMIN_MEMBER, COMPANY_A, 'is_active=false despite ADMIN membership'],
    [U_DELETED_IDENTITY_ADMIN_MEMBER, COMPANY_A, 'deleted_at set despite ADMIN membership'],
    [U_INACTIVE_COMPANY_ADMIN_MEMBER, COMPANY_INACTIVE, 'inactive company despite ADMIN membership'],
    [U_NO_MEMBERSHIP, COMPANY_A, 'no company_members row'],
    [U_ADMIN, COMPANY_B, 'ADMIN membership exists only in company A while JWT selects company B'],
  ];

  let idCounter = 1;

  async function expectDenied(fnName, payload, userId, companyId, description, label) {
    const id = `RPC-${idCounter++}`;
    const r = await asUser(db, userId, companyId, () => callRpc(db, fnName, payload));
    const denied = !r.ok && isAuthorityDenied(r.error);
    record(id, `${label}: denied for ${description}`, denied ? 'pass' : 'fail', r.ok ? 'call unexpectedly succeeded' : firstLine(r.error));
  }

  async function expectPassesAuthorityGate(fnName, payload, userId, companyId, description, label) {
    const id = `RPC-${idCounter++}`;
    const r = await asUser(db, userId, companyId, () => callRpc(db, fnName, payload));
    const authorityRejected = !r.ok && isAuthorityDenied(r.error);
    record(
      id,
      `${label}: passes authority gate for ${description}`,
      authorityRejected ? 'fail' : 'pass',
      authorityRejected ? firstLine(r.error) : r.ok ? 'call succeeded' : `later business/data error: ${firstLine(r.error)}`,
    );
  }

  async function testPermissionRpc({ fnName, payload, label, allow, deny }) {
    for (const [userId, description] of deny) {
      await expectDenied(fnName, payload, userId, COMPANY_A, description, label);
    }
    for (const [userId, companyId, description] of invalidAuthorityCases) {
      await expectDenied(fnName, payload, userId, companyId, description, label);
    }
    for (const [userId, description] of allow) {
      await expectPassesAuthorityGate(fnName, payload, userId, COMPANY_A, description, label);
    }
  }

  console.log('\n[bank preview — financial.bank_reconciliation.view]');
  await testPermissionRpc({
    fnName: 'preview_bank_statement_batch_atomic',
    payload: minimalBankPayload,
    label: 'preview bank statement',
    allow: [
      [U_ADMIN, 'ADMIN membership; users.role=VIEWER'],
      [U_MANAGER, 'MANAGER membership; users.role=VIEWER'],
      [U_ACCOUNTANT, 'ACCOUNTANT membership; users.role=VIEWER'],
      [U_VIEWER_WITH_ADMIN_USERS_ROLE, 'VIEWER membership (read permission)'],
    ],
    deny: [
      [U_OPERATIONS, 'OPERATIONS membership despite users.role=ADMIN'],
      [U_USER, 'USER membership despite users.role=ADMIN'],
    ],
  });

  console.log('\n[bank import — financial.bank_reconciliation.match]');
  await testPermissionRpc({
    fnName: 'import_bank_statement_batch_atomic',
    payload: minimalBankPayload,
    label: 'import bank statement',
    allow: [
      [U_ADMIN, 'ADMIN membership; users.role=VIEWER'],
      [U_ACCOUNTANT, 'ACCOUNTANT membership; users.role=VIEWER'],
    ],
    deny: [
      [U_MANAGER, 'MANAGER membership; view does not imply match'],
      [U_VIEWER_WITH_ADMIN_USERS_ROLE, 'VIEWER membership despite users.role=ADMIN'],
      [U_OPERATIONS, 'OPERATIONS membership despite users.role=ADMIN'],
      [U_USER, 'USER membership despite users.role=ADMIN'],
    ],
  });

  console.log('\n[receipt posting — financial.payments.create]');
  await testPermissionRpc({
    fnName: 'post_receipt_atomic',
    payload: minimalReceiptPayload,
    label: 'post receipt',
    allow: [
      [U_ADMIN, 'ADMIN membership; users.role=VIEWER'],
      [U_ACCOUNTANT, 'ACCOUNTANT membership; users.role=VIEWER'],
    ],
    deny: [
      [U_MANAGER, 'MANAGER membership does not have payments.create'],
      [U_VIEWER_WITH_ADMIN_USERS_ROLE, 'VIEWER membership despite users.role=ADMIN'],
      [U_OPERATIONS, 'OPERATIONS membership despite users.role=ADMIN'],
      [U_USER, 'USER membership despite users.role=ADMIN'],
    ],
  });

  console.log('\n[receipt void internal — preserved ADMIN/MANAGER membership boundary]');
  for (const [userId, description] of [
    [U_ACCOUNTANT, 'ACCOUNTANT membership'],
    [U_VIEWER_WITH_ADMIN_USERS_ROLE, 'VIEWER membership despite users.role=ADMIN'],
    [U_OPERATIONS, 'OPERATIONS membership despite users.role=ADMIN'],
    [U_USER, 'USER membership despite users.role=ADMIN'],
  ]) {
    await expectDenied('execute_receipt_void_internal', minimalVoidPayload, userId, COMPANY_A, description, 'execute receipt void internal');
  }
  for (const [userId, companyId, description] of invalidAuthorityCases) {
    await expectDenied('execute_receipt_void_internal', minimalVoidPayload, userId, companyId, description, 'execute receipt void internal');
  }
  for (const [userId, description] of [
    [U_ADMIN, 'ADMIN membership; users.role=VIEWER'],
    [U_MANAGER, 'MANAGER membership; users.role=VIEWER'],
  ]) {
    await expectPassesAuthorityGate('execute_receipt_void_internal', minimalVoidPayload, userId, COMPANY_A, description, 'execute receipt void internal');
  }

  const failed = results.filter((r) => r.status === 'fail');
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.log(`FAILED: ${failed.map((f) => f.id).join(', ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Sensitive RPC authorization matrix crashed:', error);
  process.exit(1);
});
