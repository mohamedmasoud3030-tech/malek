#!/usr/bin/env node
// MALEK Database Guardian — strict governance scan (Phase 6).
//
// The original Guardian draft treated authentication, company scoping and even
// a generic RAISE EXCEPTION as recognizable authorization. That is unsafe:
// those checks prove identity/scope/input validity, not capability.
//
// DG-GOV-008 below therefore requires an actual effective-permission resolver
// call for authenticated SECURITY DEFINER mutation/control RPCs unless the
// function is explicitly classified by the governance contract as a canonical
// resolver/helper or service-only internal boundary.

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

function signature(row) {
  return `${row.function_name}(${row.args})`;
}

function hasEffectivePermissionResolver(definition) {
  return /\bcurrent_user_has_effective_app_permission\s*\(/i.test(definition);
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
  if (/^(approve|pay|execute|void|import|generate|resolve|recalculate|decide|grant|revoke|create|update|delete|apply|post|process)_/i.test(name)) return true;
  const src = compact(row.definition);
  return /\b(insert\s+into|update\s+public\.|delete\s+from\s+public\.)/i.test(src);
}

async function inspect(db) {
  return db.query(`
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args,
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
    order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
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

    // Canonical authority foundation must itself be membership based. This is
    // definition-level defense against a future regression back to users.role.
    const activeRole = bySignature.get('active_company_role(p_company_id uuid)')
      ?? rows.find((row) => row.function_name === 'active_company_role');
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
    }

    // Known service/internal helpers must not be directly callable by browser
    // roles. Effective privilege catches both explicit and inherited PUBLIC ACLs.
    for (const expectedSignature of contract.serviceOnlySecurityDefiners) {
      const row = bySignature.get(expectedSignature);
      if (!row) {
        add('DG-GOV-002', 'HIGH', `Service-only SECURITY DEFINER missing: ${expectedSignature}`);
        continue;
      }
      if (row.anon_execute || row.authenticated_execute || !row.service_execute) {
        add(
          'DG-GOV-002',
          'CRITICAL',
          `Service-only boundary has unsafe EXECUTE ACL: ${expectedSignature}`,
          `anon=${row.anon_execute} authenticated=${row.authenticated_execute} service_role=${row.service_execute}`,
        );
      }
    }

    // Contracted browser-sensitive RPCs must contain BOTH the actual permission
    // resolver call and their exact governed permission token. Role helpers,
    // company scoping and auth.uid() are insufficient substitutes.
    for (const [expectedSignature, permission] of Object.entries(contract.browserSensitiveRpcPermissions)) {
      const row = bySignature.get(expectedSignature);
      if (!row) {
        add('DG-GOV-006', 'HIGH', `Governed browser RPC missing: ${expectedSignature}`);
        continue;
      }
      if (!row.authenticated_execute || row.anon_execute) {
        add(
          'DG-GOV-006',
          'HIGH',
          `Governed browser RPC has unexpected EXECUTE ACL: ${expectedSignature}`,
          `anon=${row.anon_execute} authenticated=${row.authenticated_execute}`,
        );
      }
      if (!hasEffectivePermissionResolver(row.definition) || !row.definition.includes(permission)) {
        add(
          'DG-GOV-006',
          'HIGH',
          `RPC ${expectedSignature} does not enforce governed permission ${permission} through the effective resolver`,
          row.definition,
        );
      }
    }

    // No effective SECURITY DEFINER authorization may fall back to public.users.role.
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

    const serviceOnly = new Set(contract.serviceOnlySecurityDefiners);
    const allowedHelpers = new Set(contract.allowedNonPermissionAuthenticatedSecurityDefiners);
    const contracted = new Set(Object.keys(contract.browserSensitiveRpcPermissions));

    // DG-GOV-008 — strict rule.
    // Only authenticated-callable, SECURITY DEFINER control/mutation RPCs are
    // considered. Being authenticated, having a company id, checking input, or
    // raising an exception never satisfies authorization. If the function is
    // not explicitly classified, it must call the effective permission resolver.
    for (const row of rows) {
      if (row.schema_name !== 'public' || !row.authenticated_execute || !looksSensitiveControlRpc(row)) continue;
      const sig = signature(row);
      if (serviceOnly.has(sig) || allowedHelpers.has(sig) || contracted.has(sig)) continue;
      if (!hasEffectivePermissionResolver(row.definition)) {
        add(
          'DG-GOV-008',
          'HIGH',
          `Authenticated SECURITY DEFINER control RPC lacks effective permission resolver: ${sig}`,
          'DG-GOV-008 does not accept auth.uid(), require_company_id(), RAISE EXCEPTION, or company scoping as authorization evidence.',
        );
      }
    }

    // Trigger helpers should normally not be browser RPCs. Surface any elevated
    // trigger function that still exposes authenticated EXECUTE unless it has an
    // intentional allowlist classification.
    for (const row of rows) {
      if (Number(row.trigger_count) < 1 || !row.authenticated_execute) continue;
      const sig = signature(row);
      if (allowedHelpers.has(sig) || contracted.has(sig)) continue;
      add('DG-GOV-009', 'HIGH', `SECURITY DEFINER trigger helper is directly executable by authenticated: ${sig}`);
    }

    printAndExit(files.length, rows.length);
  } finally {
    await db.close();
  }
}

function printAndExit(migrationCount, scanned = 0) {
  const blocking = findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');
  console.log(`Database Guardian governance: migrations=${migrationCount} security_definers=${scanned}`);
  if (!findings.length) {
    console.log('GUARDIAN GOVERNANCE: PASS — no findings.');
    process.exitCode = 0;
    return;
  }
  for (const f of findings) {
    console.log(`\n[${f.severity}] ${f.id} ${f.title}`);
    if (f.evidence) console.log(String(f.evidence).slice(0, 1800));
  }
  console.log(`\nGUARDIAN GOVERNANCE: ${blocking.length ? 'FAIL' : 'PASS'} — ${blocking.length} blocking finding(s), ${findings.length} total.`);
  process.exitCode = blocking.length ? 1 : 0;
}

main().catch((error) => {
  console.error('GUARDIAN GOVERNANCE CRASH:', error);
  process.exit(2);
});
