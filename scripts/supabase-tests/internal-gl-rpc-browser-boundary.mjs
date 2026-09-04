#!/usr/bin/env node
// Internal GL posting / helper RPC browser boundary matrix.
//
// Proves at runtime, against the schema the repository actually builds:
//   1. the internal gl_* posting primitives and their internal helpers are NOT
//      executable by anon/authenticated (migration
//      20260901000056_revoke_browser_execute_internal_gl_rpcs.sql);
//   2. service_role retains EXECUTE so governed internal flows keep working;
//   3. the concrete P0 reproduction — a VIEWER member of company A posting an
//      owner-expense journal batch into company B's general ledger through
//      gl_pm_post_owner_expense — is rejected;
//   4. a governed SECURITY DEFINER wrapper that internally calls one of these
//      primitives (create_deposit_atomic -> gl_pm_post_deposit_receipt) is
//      still executable by authenticated, so the ACL revoke did not break the
//      legitimate internal delegation path.
//
// Nothing here contacts a hosted project. The database lives only in memory.

import { createDatabase, replay, listMigrations } from '../db0/lib/replay.mjs';

const COMPANY_A = 'f1000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'f1000000-0000-4000-8000-00000000000b';
const VIEWER_A = 'f2000000-0000-4000-8000-000000000001';
const MANAGER_A = 'f2000000-0000-4000-8000-000000000002';

const INTERNAL_RPC_SIGNATURES = [
  'public.gl_ml_post_sublease_receipt(jsonb)',
  'public.gl_pm_accrue_fixed_monthly_fee(jsonb)',
  'public.gl_pm_post_broker_commission_approval(jsonb)',
  'public.gl_pm_post_broker_commission_payment(jsonb)',
  'public.gl_pm_post_collection_office_is_creditor(jsonb)',
  'public.gl_pm_post_collection_owner_is_creditor(jsonb)',
  'public.gl_pm_post_deposit_receipt(jsonb)',
  'public.gl_pm_post_invoice_office_is_creditor(jsonb)',
  'public.gl_pm_post_owner_expense(jsonb)',
  'public.gl_pm_post_owner_payment(jsonb)',
  'public.gl_validate_and_normalize_lines(uuid,jsonb)',
  'public.owner_settlement_reservable_expenses(uuid,uuid,date,date,text)',
  'public.owner_settlement_reservable_payments(uuid,uuid,date,date,text)',
  'public.assert_owner_funds_event_cutover(uuid,date,uuid)',
  'public.assert_owner_settlement_links_backfillable()',
  'public.contract_evidence_assert_documents(uuid,uuid,uuid[])',
  'public.require_company_account_id(uuid,text)',
  'public.check_unit_maintenance_block(uuid)',
];

const results = [];

function record(id, title, status, detail = '') {
  results.push({ id, title, status, detail });
  const mark = status === 'pass' ? 'PASS' : 'FAIL';
  console.log(`  ${mark.padEnd(4)} ${id}  ${title}`);
  if (status === 'fail' && detail) console.log(`       ${detail}`);
}

function firstLine(error) {
  return String(error?.message ?? error).split('\n')[0].slice(0, 240);
}

function isPermissionDenied(error) {
  return /permission denied for function|42501/i.test(String(error?.message ?? error));
}

async function hasExecute(db, role, signature) {
  const res = await db.query(
    `select has_function_privilege($1, $2, 'EXECUTE') as allowed`,
    [role, signature],
  );
  return Boolean(res.rows[0]?.allowed);
}

async function asUser(db, userId, companyId, role, fn) {
  await db.exec('begin');
  try {
    const claims = JSON.stringify({
      sub: userId,
      role,
      app_metadata: { company_id: companyId },
    });
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    await db.exec(`set local role ${role}`);
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

async function seed(db) {
  await db.exec(`
    grant anon, authenticated, service_role, supabase_auth_admin to current_user;

    insert into public.companies (id, name, slug, currency, locale, is_active)
    values
      ('${COMPANY_A}', 'GL Boundary Co A', 'gl-boundary-a', 'OMR', 'ar-OM', true),
      ('${COMPANY_B}', 'GL Boundary Co B', 'gl-boundary-b', 'OMR', 'ar-OM', true)
    on conflict (id) do update set is_active = excluded.is_active;

    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data
    ) values
      ('${VIEWER_A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer.gl@boundary.test', 'not-used', now(), now(), now(), '{}'::jsonb),
      ('${MANAGER_A}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager.gl@boundary.test', 'not-used', now(), now(), now(), '{}'::jsonb)
    on conflict (id) do update set updated_at = now();

    insert into public.users (id, email, name, role, status, is_active, deleted_at)
    values
      ('${VIEWER_A}', 'viewer.gl@boundary.test', 'GL Viewer', 'VIEWER', 'ACTIVE', true, null),
      ('${MANAGER_A}', 'manager.gl@boundary.test', 'GL Manager', 'MANAGER', 'ACTIVE', true, null)
    on conflict (id) do update set status = excluded.status, is_active = excluded.is_active;

    insert into public.company_members (company_id, user_id, role, is_active, created_at)
    values
      ('${COMPANY_A}', '${VIEWER_A}', 'VIEWER', true, timestamptz '2026-01-01 00:00:00+00'),
      ('${COMPANY_A}', '${MANAGER_A}', 'MANAGER', true, timestamptz '2026-01-01 00:00:01+00')
    on conflict (company_id, user_id) do update set role = excluded.role, is_active = excluded.is_active;
  `);

  // Company B looks like any real production company: a provisioned chart of
  // accounts and an OPEN accounting period. This removes the accidental
  // business preconditions that previously masked the missing authorization.
  // The open period is derived from the CURRENT date (never hard-coded), so
  // posting-dependent scenarios stay executable on any future run date.
  await db.query(`select public.provision_company_chart_of_accounts('${COMPANY_B}')`);
  await db.query(`
    insert into public.accounting_periods (company_id, name, start_date, end_date, status)
    select '${COMPANY_B}', to_char(date_trunc('month', current_date), 'YYYY-MM'),
           date_trunc('month', current_date)::date,
           (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
           'OPEN'
  `);
  // Company A needs an open period too so the governed wrapper scenario can post.
  await db.query(`select public.provision_company_chart_of_accounts('${COMPANY_A}')`);
  await db.query(`
    insert into public.accounting_periods (company_id, name, start_date, end_date, status)
    select '${COMPANY_A}', to_char(date_trunc('month', current_date), 'YYYY-MM'),
           date_trunc('month', current_date)::date,
           (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
           'OPEN'
  `);
}

async function runBoundaryMatrix(db) {
  console.log('\n[internal GL RPC browser EXECUTE boundary]');
  let caseNo = 1;
  for (const signature of INTERNAL_RPC_SIGNATURES) {
    const anon = await hasExecute(db, 'anon', signature);
    const authenticated = await hasExecute(db, 'authenticated', signature);
    const service = await hasExecute(db, 'service_role', signature);
    record(
      `GLB-${String(caseNo++).padStart(2, '0')}`,
      `anon cannot EXECUTE ${signature}`,
      anon === false ? 'pass' : 'fail',
      `actual=${anon}`,
    );
    record(
      `GLB-${String(caseNo++).padStart(2, '0')}`,
      `authenticated cannot EXECUTE ${signature}`,
      authenticated === false ? 'pass' : 'fail',
      `actual=${authenticated}`,
    );
    record(
      `GLB-${String(caseNo++).padStart(2, '0')}`,
      `service_role can EXECUTE ${signature}`,
      service === true ? 'pass' : 'fail',
      `actual=${service}`,
    );
  }
}

async function runExploitReproduction(db) {
  console.log('\n[P0 reproduction: cross-company GL posting via gl_pm_post_owner_expense]');

  // A VIEWER member of company A attempts to post an owner-expense journal
  // batch into company B's general ledger using company B's company_id.
  const attack = await asUser(db, VIEWER_A, COMPANY_A, 'authenticated', async () => {
    const res = await db.query(
      `select public.gl_pm_post_owner_expense(jsonb_build_object(
         'company_id', $1::text,
         'expense_id', gen_random_uuid()::text,
         'amount', 50,
         'effective_date', current_date
       )) as result`,
      [COMPANY_B],
    );
    return res.rows[0]?.result ?? null;
  });
  record(
    'GLB-EXP-01',
    'VIEWER of company A cannot post a journal batch into company B through gl_pm_post_owner_expense',
    attack.ok === false && isPermissionDenied(attack.error) ? 'pass' : 'fail',
    attack.ok ? 'unexpectedly allowed' : firstLine(attack.error),
  );

  // And cannot read another company's reservable owner-settlement payments.
  const read = await asUser(db, VIEWER_A, COMPANY_A, 'authenticated', async () => {
    const res = await db.query(
      `select public.owner_settlement_reservable_payments($1::uuid, $2::uuid, date '2026-01-01', date '2026-12-31', null) as rows`,
      [COMPANY_B, VIEWER_A],
    );
    return res.rows[0]?.rows ?? null;
  });
  record(
    'GLB-EXP-02',
    'VIEWER of company A cannot read company B financial projections through owner_settlement_reservable_payments',
    read.ok === false && isPermissionDenied(read.error) ? 'pass' : 'fail',
    read.ok ? 'unexpectedly allowed' : firstLine(read.error),
  );
}

async function runGovernedWrapperStillWorks(db) {
  console.log('\n[governed SECURITY DEFINER delegation is unaffected]');

  // create_deposit_atomic is the governed browser RPC that internally calls
  // gl_pm_post_deposit_receipt. Its own EXECUTE grant must be intact.
  const authenticated = await hasExecute(db, 'authenticated', 'public.create_deposit_atomic(jsonb)');
  record(
    'GLB-WRAP-01',
    'authenticated can still EXECUTE governed wrapper public.create_deposit_atomic(jsonb)',
    authenticated === true ? 'pass' : 'fail',
    `actual=${authenticated}`,
  );

  // And the internal primitive still executes under the owner/service identity
  // used by the wrapper (definer) path.
  const internal = await asUser(db, MANAGER_A, COMPANY_A, 'service_role', async () => {
    const res = await db.query(
      `select public.gl_pm_post_deposit_receipt(jsonb_build_object(
         'company_id', $1::text,
         'deposit_id', gen_random_uuid()::text,
         'amount', 25,
         'effective_date', current_date
       )) as result`,
      [COMPANY_A],
    );
    return res.rows[0]?.result ?? null;
  });
  record(
    'GLB-WRAP-02',
    'service_role can still run gl_pm_post_deposit_receipt internally',
    internal.ok === true ? 'pass' : 'fail',
    internal.ok ? '' : firstLine(internal.error),
  );
}

async function main() {
  const files = await listMigrations();
  const db = await createDatabase();
  const replayResult = await replay(db, { files, stopOnError: true });
  if (replayResult.failures.length > 0) {
    console.error('Migration replay failed before the internal GL RPC boundary audit:');
    for (const failure of replayResult.failures) {
      console.error(`  ${failure.file}: ${firstLine(failure.error)}`);
    }
    process.exit(1);
  }
  console.log(`Internal GL RPC browser boundary matrix: ${files.length} migrations replayed cleanly.`);

  await seed(db);
  await runBoundaryMatrix(db);
  await runExploitReproduction(db);
  await runGovernedWrapperStillWorks(db);

  await db.close();

  const failed = results.filter((r) => r.status === 'fail');
  const passed = results.length - failed.length;
  console.log(`\nInternal GL RPC browser boundary  ${passed} passed  ${failed.length} failed  0 skipped`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Internal GL RPC boundary audit crashed:', error);
  process.exit(1);
});
