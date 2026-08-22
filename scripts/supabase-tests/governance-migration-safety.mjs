#!/usr/bin/env node
// Governance stabilization Phase 8 — migration safety.
//
// Proves BOTH supported application paths on disposable PGlite:
//   A. clean replay from an empty database through the complete current chain;
//   B. incremental replay: build the pre-governance main state first, then apply
//      every governance-stabilization forward migration in order.
//
// The test also rejects duplicate 14-digit migration versions (Supabase records
// versions, not filenames) and compares effective definitions/ACLs of the
// security-critical functions between the two paths.

import { createDatabase, replay, listMigrations } from '../db0/lib/replay.mjs';

const GOVERNANCE_START = '20260901000012_';
const EXPECTED_FORWARD_VERSIONS = [
  '20260901000012',
  '20260901000013',
  '20260901000014',
  '20260901000015',
];

const TARGET_FUNCTIONS = [
  'active_company_role',
  'current_app_role',
  'is_admin',
  'is_admin_or_manager',
  'is_accountant',
  'is_operations',
  'is_viewer',
  'is_app_user',
  'custom_access_token_hook',
  'current_user_has_effective_app_permission',
  'current_user_has_support_capability',
  'preview_bank_statement_batch_atomic',
  'import_bank_statement_batch_atomic',
  'post_receipt_atomic',
  'execute_receipt_void_internal',
  'approve_receipt_void_atomic',
  'recalculate_all_balances',
  'resolve_maintenance_with_expense',
  'run_scheduled_automation_rules',
  'request_permission',
  'next_document_reference',
  'assign_document_reference',
  'update_unit_status_from_activity',
  'recalculate_unit_statuses',
];

const results = [];

function record(id, title, pass, detail = '') {
  results.push({ id, title, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} ${id}  ${title}`);
  if (!pass && detail) console.log(`       ${detail}`);
}

function versionOf(file) {
  return file.slice(0, 14);
}

function firstFailure(result) {
  const f = result.failures[0];
  return f ? `${f.file}: ${f.error}${f.detail ? ` — ${f.detail}` : ''}` : '';
}

async function criticalFingerprint(db) {
  const functions = await db.query(
    `select
       n.nspname as schema_name,
       p.proname as function_name,
       oidvectortypes(p.proargtypes) as arg_types,
       p.prosecdef as security_definer,
       coalesce(p.proacl::text, '') as acl,
       pg_get_functiondef(p.oid) as definition
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public','app_private')
       and p.proname = any($1::text[])
     order by n.nspname, p.proname, oidvectortypes(p.proargtypes)`,
    [TARGET_FUNCTIONS],
  );

  const ledger = await db.query(
    `select version, name
       from supabase_migrations.schema_migrations
      where version >= '20260901000012'
      order by version, name`,
  );

  return JSON.stringify({ functions: functions.rows, ledger: ledger.rows });
}

async function main() {
  const files = await listMigrations();
  const versionCounts = new Map();
  for (const file of files) {
    const version = versionOf(file);
    versionCounts.set(version, (versionCounts.get(version) ?? 0) + 1);
  }
  const duplicates = [...versionCounts.entries()].filter(([, count]) => count > 1);
  record(
    'MIG-01',
    'all Supabase migration versions are unique',
    duplicates.length === 0,
    duplicates.map(([version, count]) => `${version} x${count}`).join(', '),
  );

  const baseFiles = files.filter((file) => file < GOVERNANCE_START);
  const forwardFiles = files.filter((file) => file >= GOVERNANCE_START);
  const forwardVersions = forwardFiles.map(versionOf);

  record(
    'MIG-02',
    'governance forward chain contains the expected 00012→00015 versions exactly once',
    EXPECTED_FORWARD_VERSIONS.every((v) => forwardVersions.filter((x) => x === v).length === 1),
    `forward=${forwardFiles.join(', ')}`,
  );
  record(
    'MIG-03',
    'pre-governance baseline and forward migration sets are both non-empty',
    baseFiles.length > 0 && forwardFiles.length > 0,
    `base=${baseFiles.length} forward=${forwardFiles.length}`,
  );

  const cleanDb = await createDatabase();
  const incrementalDb = await createDatabase();
  try {
    console.log('\n[clean replay]');
    const clean = await replay(cleanDb, { files, stopOnError: true });
    record('MIG-04', 'clean replay applies the complete migration chain', clean.failures.length === 0, firstFailure(clean));

    console.log('\n[incremental replay]');
    const base = await replay(incrementalDb, { files: baseFiles, stopOnError: true });
    record('MIG-05', 'pre-governance baseline replays cleanly', base.failures.length === 0, firstFailure(base));

    let forward = { applied: [], failures: [] };
    if (base.failures.length === 0) {
      forward = await replay(incrementalDb, { files: forwardFiles, stopOnError: true });
    }
    record(
      'MIG-06',
      'governance forward migrations apply incrementally on the pre-existing baseline',
      base.failures.length === 0 && forward.failures.length === 0 && forward.applied.length === forwardFiles.length,
      firstFailure(forward) || `applied=${forward.applied.length}/${forwardFiles.length}`,
    );

    if (clean.failures.length === 0 && base.failures.length === 0 && forward.failures.length === 0) {
      const cleanFingerprint = await criticalFingerprint(cleanDb);
      const incrementalFingerprint = await criticalFingerprint(incrementalDb);
      record(
        'MIG-07',
        'clean and incremental paths produce identical critical function definitions and ACLs',
        cleanFingerprint === incrementalFingerprint,
        cleanFingerprint === incrementalFingerprint ? '' : 'critical catalog fingerprints differ',
      );

      const ledger = await incrementalDb.query(
        `select version, count(*)::integer as count
           from supabase_migrations.schema_migrations
          where version >= '20260901000012'
          group by version
          order by version`,
      );
      const ledgerMap = new Map(ledger.rows.map((row) => [row.version, Number(row.count)]));
      record(
        'MIG-08',
        'incremental migration ledger records each governance version exactly once',
        EXPECTED_FORWARD_VERSIONS.every((v) => ledgerMap.get(v) === 1),
        JSON.stringify(ledger.rows),
      );
    } else {
      record('MIG-07', 'clean and incremental paths produce identical critical function definitions and ACLs', false, 'comparison skipped because replay failed');
      record('MIG-08', 'incremental migration ledger records each governance version exactly once', false, 'ledger check skipped because replay failed');
    }
  } finally {
    await cleanDb.close();
    await incrementalDb.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\nPhase 8 migration safety: ${results.length - failed.length}/${results.length} passed.`);
  if (failed.length) {
    console.log(`FAILED: ${failed.map((r) => r.id).join(', ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Governance migration safety crashed:', error);
  process.exit(1);
});
