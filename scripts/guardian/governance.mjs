#!/usr/bin/env node
// MALEK Database Guardian — strict governance scan (Phase 6).
//
// DG-GOV-008 deliberately does NOT accept authentication, company scoping,
// input validation, or a generic RAISE EXCEPTION as authorization evidence.
// A browser-executable SECURITY DEFINER control/mutation RPC must call a
// canonical database role/permission resolver (or be explicitly classified as
// a canonical helper). public.users.role and browser/JWT role metadata are never
// operational authority sources.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase, replay, listMigrations } from '../db0/lib/replay.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(await readFile(join(HERE, 'governance-contract.json'), 'utf8'));
const findings = [];

function add(id, severity, title, evidence = '') {
  findings.push({ id, severity, title, evidence });
}

function compact(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

// pg_get_function_identity_arguments() includes argument names when functions
// declare them, while governance-contract.json intentionally stores stable
// type-only signatures. Use oidvectortypes() and normalize spacing so a harmless
// parameter rename can never create a false missing-function finding.
function normalizeSignature(value) {
  return String(value ?? '')
    .replace(/\s*,\s*/g, ',')
    .replace(/\(\s*/g, '(')
    .replace(/\s*\)/g, ')')
    .trim();
}

function signature(row) {
  return normalizeSignature(`${row.function_name}(${row.arg_types})`);
}

function normalizedSet(values) {
  return new Set(values.map(normalizeSignature));
}

function normalizedEntries(object) {
  return new Map(Object.entries(object).map(([key, value]) => [normalizeSignature(key), value]));
}

function hasEffectivePermissionResolver(definition) {
  return /\bcurrent_user_has_effective_app_permission\s*\(/i.test(definition);
}

function hasCanonicalAuthorityResolver(definition) {
  const src = String(definition ?? '');
  return contract.dgGov008.acceptedResolverCalls.some((token) => src.includes(token));
}

function hasRawUsersRoleAuthorization(definition) {
  const src = compact(definition);
  return (
    /from\s+public\.users\s+(?:as\s+)?([a-z_][a-z0-9_]*)[\s\S]*?\1\.role(?:::text)?\s*(?:=|<>|in\s*\(|=\s*any)/i.test(src) ||
    /join\s+public\.users\s+(?:as\s+)?([a-z_][a-z0-9_]*)[\s\S]*?\1\.role(?:::text)?\s*(?:=|<>|in\s*\(|=\s*any)/i.test(src)
  );
}

function looksSensitiveControlRpc(row) {
  const name = row.function_name;
  if (/(_atomic|_at_once)$/i.test(name)) return true;
  if (/^(approve|pay|execute|void|import|generate|resolve|recalculate|decide|grant|revoke|create|update|delete|apply|post|process|request)_/i.test(name)) return true;
  return /\b(insert\s+into|update\s+public\.|delete\s+from\s+public\.)/i.test(compact(row.definition));
}

async function inspect(db) {
  return db.query(`
    select
      n.nspname as schema_name,
      p.proname as function_name,
      oidvectortypes(p.proargtypes) as arg_types,
      p.prosecdef as security_definer,
      pg_get_functiondef(p.oid) as definition,
      has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
      has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute,
      (select count(*)::integer from pg_trigger t where not t.tgisinternal and t.tgfoid=p.oid) as trigger_count
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where p.prosecdef
      and n.nspname in ('public','app_private')
    order by n.nspname, p.proname, oidvectortypes(p.proargtypes)
  `);
}

async function main() {
  const db = await createDatabase();
  try {
    const files = await listMigrations();
    const replayResult = await replay(db, { files, stopOnError: true });
    if (replayResult.failures.length) {
      for (const f of replayResult.failures) {
        add('DG-MIG-001', 'CRITICAL', `Migration replay failed: ${f.file}`, String(f.error));
      }
      printAndExit(files.length);
      return;
    }

    const rows = (await inspect(db)).rows;
    const bySignature = new Map(rows.map((row) => [signature(row), row]));
    const serviceOrInternalOnly = normalizedSet(contract.serviceOrInternalOnlyFunctions);
    const adminManagerSensitive = normalizedSet(contract.adminManagerSensitiveFunctions);
    const permissionGoverned = normalizedEntries(contract.permissionGovernedSensitiveRpcs);
    const allowedHelpers = normalizedSet(contract.allowedNonPermissionAuthenticatedSecurityDefiners);

    // DG-GOV-001 — canonical authority foundation itself.
    const activeRole = bySignature.get(normalizeSignature('active_company_role(uuid)'));
    if (!activeRole) {
      add('DG-GOV-001', 'CRITICAL', 'active_company_role(uuid) is missing');
    } else {
      const def = compact(activeRole.definition);
      if (!/company_members/i.test(def) || !/cm\.role/i.test(def)) {
        add('DG-GOV-001', 'CRITICAL', 'active_company_role does not derive role from company_members.role', activeRole.definition);
      }
      if (/public\.users[\s\S]*?\.role/i.test(def)) {
        add('DG-GOV-001', 'CRITICAL', 'active_company_role reads users.role', activeRole.definition);
      }
      for (const marker of ['is_active', 'deleted_at', "status::text = 'ACTIVE'"]) {
        if (!def.includes(marker)) add('DG-GOV-001', 'HIGH', `active_company_role is missing identity/activity marker: ${marker}`, activeRole.definition);
      }
    }

    // DG-GOV-002 — service/internal boundaries: no browser EXECUTE. Some are
    // owner-internal and intentionally have no service_role grant, so the rule
    // does not manufacture a service grant merely to satisfy the scanner.
    for (const expectedSignature of serviceOrInternalOnly) {
      const row = bySignature.get(expectedSignature);
      if (!row) {
        add('DG-GOV-002', 'HIGH', `Service/internal SECURITY DEFINER missing: ${expectedSignature}`);
        continue;
      }
      if (row.anon_execute || row.authenticated_execute) {
        add(
          'DG-GOV-002',
          'CRITICAL',
          `Service/internal boundary is browser-executable: ${expectedSignature}`,
          `anon=${row.anon_execute} authenticated=${row.authenticated_execute} service_role=${row.service_execute}`,
        );
      }
    }

    // DG-GOV-003 — sensitive functions whose historical contract is active
    // ADMIN/MANAGER must use the canonical membership-backed helper and never
    // public.users.role. This preserves semantics while changing authority source.
    for (const expectedSignature of adminManagerSensitive) {
      const row = bySignature.get(expectedSignature);
      if (!row) {
        add('DG-GOV-003', 'HIGH', `ADMIN/MANAGER sensitive function missing: ${expectedSignature}`);
        continue;
      }
      if (!/\bis_admin_or_manager\s*\(\s*\)/i.test(row.definition)) {
        add('DG-GOV-003', 'HIGH', `Sensitive function does not use canonical ADMIN/MANAGER resolver: ${expectedSignature}`, row.definition);
      }
      if (hasRawUsersRoleAuthorization(row.definition)) {
        add('DG-GOV-003', 'CRITICAL', `Sensitive function still uses users.role authority: ${expectedSignature}`, row.definition);
      }
    }

    // DG-GOV-006 — explicitly permission-governed sensitive RPCs require both
    // the effective resolver and their exact permission token.
    for (const [expectedSignature, permission] of permissionGoverned.entries()) {
      const row = bySignature.get(expectedSignature);
      if (!row) {
        add('DG-GOV-006', 'HIGH', `Governed permission RPC missing: ${expectedSignature}`);
        continue;
      }
      if (!hasEffectivePermissionResolver(row.definition) || !row.definition.includes(permission)) {
        add(
          'DG-GOV-006',
          'HIGH',
          `RPC ${expectedSignature} does not enforce ${permission} through the effective permission resolver`,
          row.definition,
        );
      }
    }

    // DG-GOV-007 — no effective SECURITY DEFINER authorization may fall back
    // to public.users.role.
    for (const row of rows) {
      if (hasRawUsersRoleAuthorization(row.definition)) {
        add(
          'DG-GOV-007',
          'HIGH',
          `SECURITY DEFINER ${row.schema_name}.${signature(row)} uses public.users.role in an authorization decision`,
          row.definition,
        );
      }
    }

    // DG-GOV-008 — strict authority proof. Authentication, company scoping,
    // RAISE EXCEPTION and validation are deliberately absent from the accepted
    // signal list.
    for (const row of rows) {
      if (row.schema_name !== 'public' || !row.authenticated_execute || !looksSensitiveControlRpc(row)) continue;
      const sig = signature(row);
      if (allowedHelpers.has(sig)) continue;
      if (!hasCanonicalAuthorityResolver(row.definition)) {
        add(
          'DG-GOV-008',
          'HIGH',
          `Authenticated SECURITY DEFINER control RPC lacks canonical authority resolver: ${sig}`,
          'Accepted proof is a canonical database role/permission resolver call. auth.uid(), require_company_id(), company scoping, input validation and RAISE EXCEPTION do not count.',
        );
      }
    }

    // DG-GOV-009 — elevated trigger functions should not be browser RPCs.
    for (const row of rows) {
      if (Number(row.trigger_count) < 1 || !row.authenticated_execute) continue;
      const sig = signature(row);
      if (allowedHelpers.has(sig)) continue;
      add('DG-GOV-009', 'HIGH', `SECURITY DEFINER trigger helper is directly executable by authenticated: ${sig}`);
    }

    // DG-GOV-010 — reject the exact phantom-wrapper defect found in PR #1543.
    const phantomNames = [
      'preview_bank_statement_batch_internal',
      'import_bank_statement_batch_internal',
      'post_receipt_atomic_internal',
    ];
    for (const target of [
      normalizeSignature('preview_bank_statement_batch_atomic(jsonb)'),
      normalizeSignature('import_bank_statement_batch_atomic(jsonb)'),
      normalizeSignature('post_receipt_atomic(jsonb)'),
    ]) {
      const row = bySignature.get(target);
      if (!row) continue;
      for (const phantom of phantomNames) {
        if (row.definition.includes(phantom)) {
          add('DG-GOV-010', 'CRITICAL', `${target} calls forbidden phantom wrapper ${phantom}`, row.definition);
        }
      }
    }

    printAndExit(files.length, rows.length);
  } finally {
    // Do not db.close() before exiting. PGlite.close() calls
    // Emscripten _emscripten_force_exit(0) and would hide a FAIL status.
  }
}

function printAndExit(migrationCount, scanned = 0) {
  const blocking = findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');
  console.log(`Database Guardian governance: migrations=${migrationCount} security_definers=${scanned}`);
  if (!findings.length) {
    console.log('GUARDIAN GOVERNANCE: PASS — no findings.');
    // process.exit — not process.exitCode. PGlite.close() force-exits 0.
    process.exit(0);
  }
  for (const f of findings) {
    console.log(`\n[${f.severity}] ${f.id} ${f.title}`);
    if (f.evidence) console.log(String(f.evidence).slice(0, 1800));
  }
  console.log(`\nGUARDIAN GOVERNANCE: ${blocking.length ? 'FAIL' : 'PASS'} — ${blocking.length} blocking finding(s), ${findings.length} total.`);
  process.exit(blocking.length ? 1 : 0);
}

main().catch((error) => {
  console.error('GUARDIAN GOVERNANCE CRASH:', error);
  process.exit(2);
});
