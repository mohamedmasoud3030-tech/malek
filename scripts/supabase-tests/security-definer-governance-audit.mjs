#!/usr/bin/env node
// Governance stabilization Phase 4/5 executable audit.
//
// Replays the complete migration chain into disposable PGlite, then inspects
// the effective SECURITY DEFINER definitions and deployed EXECUTE grants.
// Old historical migration text may contain retired users.role checks; only the
// effective pg_proc definitions after all forward migrations are authoritative.

import { createDatabase, replay, listMigrations } from '../db0/lib/replay.mjs';

const results = [];

function record(id, title, pass, detail = '') {
  results.push({ id, title, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} ${id}  ${title}`);
  if (!pass && detail) console.log(`       ${detail}`);
}

async function functionInfo(db, signature) {
  const res = await db.query(
    `select
       p.oid::text as oid,
       n.nspname as schema_name,
       p.proname as function_name,
       p.prosecdef as security_definer,
       pg_get_functiondef(p.oid) as definition,
       coalesce(p.proconfig, array[]::text[]) as config
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where p.oid = to_regprocedure($1)`,
    [signature],
  );
  if (res.rows.length !== 1) throw new Error(`Function not found: ${signature}`);
  return res.rows[0];
}

async function hasExecute(db, role, signature) {
  const res = await db.query(
    `select has_function_privilege($1, $2, 'EXECUTE') as allowed`,
    [role, signature],
  );
  return Boolean(res.rows[0].allowed);
}

function hasCanonicalManagerGate(definition) {
  return /\bis_admin_or_manager\s*\(\s*\)/i.test(definition);
}

function hasPermissionGate(definition, permission) {
  return /\bcurrent_user_has_effective_app_permission\s*\(/i.test(definition)
    && definition.includes(permission);
}

function hasRawUsersRoleAuthority(definition) {
  const compact = definition.replace(/\s+/g, ' ');
  const roleIn = /from public\.users (?:as )?([a-z_][a-z0-9_]*)\b.{0,1200}?\1\.role(?:::text)?\s+in\s*\(\s*'ADMIN'\s*,\s*'MANAGER'/i;
  const roleCoalesce = /from public\.users (?:as )?([a-z_][a-z0-9_]*)\b.{0,1200}?upper\s*\(\s*coalesce\s*\(\s*\1\.role(?:::text)?/i;
  return roleIn.test(compact) || roleCoalesce.test(compact);
}

async function main() {
  const files = await listMigrations();
  const db = await createDatabase();
  const replayResult = await replay(db, { files, stopOnError: true });
  if (replayResult.failures.length > 0) {
    console.error('Migration replay failed before governance audit:', replayResult.failures);
    process.exit(1);
  }
  console.log(`SECURITY DEFINER governance audit: ${files.length} migrations replayed cleanly.\n`);

  // These functions historically required ADMIN/MANAGER. Governance
  // stabilization changes the authority source to company_members.role but
  // intentionally does not widen that semantic boundary to every role that may
  // happen to hold a related permission token.
  console.log('[canonical membership ADMIN/MANAGER gates]');
  const managerGateTargets = [
    ['SD-01', 'public.preview_bank_statement_batch_atomic(jsonb)'],
    ['SD-02', 'public.import_bank_statement_batch_atomic(jsonb)'],
    ['SD-03', 'public.post_receipt_atomic(jsonb)'],
    ['SD-04', 'public.execute_receipt_void_internal(jsonb)'],
    ['SD-05', 'public.approve_receipt_void_atomic(jsonb)'],
    ['SD-06', 'public.recalculate_all_balances()'],
    ['SD-07', 'public.resolve_maintenance_with_expense(text,numeric,text)'],
    ['SD-08', 'public.run_scheduled_automation_rules()'],
  ];
  for (const [id, signature] of managerGateTargets) {
    const info = await functionInfo(db, signature);
    record(
      id,
      `${signature} uses canonical membership ADMIN/MANAGER gate and no users.role authority`,
      info.security_definer && hasCanonicalManagerGate(info.definition) && !hasRawUsersRoleAuthority(info.definition),
      info.definition.slice(0, 700),
    );
  }

  console.log('\n[permission-governed sensitive RPC examples]');
  const permissionTargets = [
    ['SD-09A', 'public.record_invoice_payment_atomic(jsonb)', 'financial.payments.create'],
    ['SD-09B', 'public.process_bank_reconciliation_match_atomic(jsonb)', 'financial.bank_reconciliation.match'],
  ];
  for (const [id, signature, permission] of permissionTargets) {
    const info = await functionInfo(db, signature);
    record(
      id,
      `${signature} enforces ${permission} through the effective permission resolver`,
      info.security_definer && hasPermissionGate(info.definition, permission) && !hasRawUsersRoleAuthority(info.definition),
      info.definition.slice(0, 700),
    );
  }

  console.log('\n[effective permission resolver]');
  const effectivePermission = await functionInfo(db, 'public.current_user_has_effective_app_permission(text)');
  record(
    'SD-10',
    'effective permission resolver validates active app identity before role or explicit grants',
    effectivePermission.security_definer &&
      /is_app_user\s*\(\s*\)/i.test(effectivePermission.definition) &&
      effectivePermission.definition.indexOf('is_app_user') < effectivePermission.definition.indexOf('user_permission_grants'),
    effectivePermission.definition,
  );
  record(
    'SD-11',
    'effective permission resolver rejects unknown permission identifiers before ADMIN shortcut',
    effectivePermission.definition.includes('app_permission_catalog') &&
      effectivePermission.definition.indexOf('app_permission_catalog') < effectivePermission.definition.indexOf('is_admin'),
    effectivePermission.definition,
  );

  console.log('\n[request_permission boundary and routing]');
  const requestPermission = await functionInfo(db, 'public.request_permission(text,text,text)');
  record(
    'SD-12',
    'request_permission requires an active app identity before SECURITY DEFINER writes',
    /auth\.uid\s*\(\s*\)\s+is\s+null\s+or\s+not\s+coalesce\s*\(\s*public\.is_app_user\s*\(\s*\)/i.test(requestPermission.definition),
    requestPermission.definition.slice(0, 800),
  );
  record(
    'SD-13',
    'request_permission routes admin/manager notifications by company_members.role',
    !requestPermission.definition.includes('u.role::text') &&
      requestPermission.definition.includes('cm.role::text') &&
      /cm\.role::text\s+in\s*\(\s*'ADMIN'\s*,\s*'MANAGER'\s*\)/i.test(requestPermission.definition),
    requestPermission.definition.slice(0, 900),
  );

  console.log('\n[support capability resolver]');
  const supportCapability = await functionInfo(db, 'public.current_user_has_support_capability(text)');
  record(
    'SD-14',
    'support capability has no named role bypass and uses effective permission resolver',
    supportCapability.definition.includes('current_user_has_effective_app_permission') &&
      !/current_app_role\s*\(\s*\)\s*(?:=|in)/i.test(supportCapability.definition),
    supportCapability.definition,
  );

  console.log('\n[global effective SECURITY DEFINER scan]');
  const securityDefiners = await db.query(`
    select n.nspname as schema_name, p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args,
           pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and n.nspname in ('public','app_private')
    order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
  `);
  const rawRoleOffenders = securityDefiners.rows.filter((row) => hasRawUsersRoleAuthority(row.definition));
  record(
    'SD-15',
    'no effective SECURITY DEFINER uses public.users.role as ADMIN/MANAGER authority',
    rawRoleOffenders.length === 0,
    rawRoleOffenders.map((row) => `${row.schema_name}.${row.function_name}(${row.args})`).join(', '),
  );

  console.log('\n[deployed EXECUTE boundaries]');
  const grantCases = [
    ['SD-16', 'authenticated', 'public.post_receipt_atomic(jsonb)', false],
    ['SD-17', 'authenticated', 'public.execute_receipt_void_internal(jsonb)', false],
    ['SD-18', 'authenticated', 'public.preview_bank_statement_batch_atomic(jsonb)', true],
    ['SD-19', 'authenticated', 'public.import_bank_statement_batch_atomic(jsonb)', true],
    ['SD-20', 'authenticated', 'public.approve_receipt_void_atomic(jsonb)', true],
    ['SD-21', 'authenticated', 'public.recalculate_all_balances()', true],
    ['SD-22', 'authenticated', 'public.resolve_maintenance_with_expense(text,numeric,text)', true],
    ['SD-23', 'authenticated', 'public.run_scheduled_automation_rules()', true],
    ['SD-24', 'authenticated', 'public.request_permission(text,text,text)', true],
    ['SD-25', 'authenticated', 'public.current_user_has_support_capability(text)', true],
  ];
  for (const [id, role, signature, expected] of grantCases) {
    const actual = await hasExecute(db, role, signature);
    record(id, `${role} EXECUTE ${signature} = ${expected}`, actual === expected, `actual=${actual}`);
  }

  const failed = results.filter((result) => !result.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.log(`FAILED: ${failed.map((result) => result.id).join(', ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('SECURITY DEFINER governance audit crashed:', error);
  process.exit(1);
});
