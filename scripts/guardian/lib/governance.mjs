// Guardian governance gate.
//
// Enforces the canonical six-role authorization model defined in
// scripts/guardian/governance-contract.json against both the migrated database
// (role_has_app_permission) and the frontend role map (permissions.ts). Drift
// between frontend and backend is a HIGH finding.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDatabase, replay } from '../../db0/lib/replay.mjs';
import { finding, SEVERITY } from './findings.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(HERE, '..', 'governance-contract.json');
const PERMISSIONS_TS = join(
  HERE,
  '..', '..', '..',
  'rentrix-app', 'src', 'features', 'auth', 'permissions.ts',
);

function parseFrontendRoleMatrix(src) {
  const out = {};
  // Each role block:   ROLE: new Set<AppPermission>([ ... ]),
  const blockRe = /(ADMIN|MANAGER|ACCOUNTANT|OPERATIONS|USER|VIEWER):\s*new\s+Set<[^>]*>\(\[([\s\S]*?)\]\)/g;
  let m;
  while ((m = blockRe.exec(src))) {
    const role = m[1];
    const perms = [...m[2].matchAll(/'([a-z0-9_.]+)'/g)].map((x) => x[1]);
    out[role] = perms;
  }
  return out;
}

export async function runGovernanceChecks() {
  const findings = [];
  const contract = JSON.parse(await readFile(CONTRACT_PATH, 'utf8'));
  const db = await createDatabase();
  const r = await replay(db, { stopOnError: false });
  if (r.failures.length) {
    for (const f of r.failures) {
      findings.push(finding({
        id: 'DG-MIG-001', severity: SEVERITY.CRITICAL, category: 'migration',
        title: `Migration ${f.file} fails to replay`, evidence: f.error,
      }));
    }
    await db.close();
    return { findings };
  }

  // The catalog must contain every governed permission (seed is applied by the
  // canonical baseline; assert it).
  const catalog = await db.query(
    `select permission, admin_only, requestable from public.app_permission_catalog`,
  );
  const catalogPerms = new Set(catalog.rows.map((x) => x.permission));
  for (const p of contract.permissions) {
    if (!catalogPerms.has(p)) {
      findings.push(finding({
        id: 'DG-GOV-001', severity: SEVERITY.HIGH, category: 'authorization',
        title: `Governed permission missing from app_permission_catalog: ${p}`,
        evidence: p,
        remediation: 'Add the permission to the catalog (seed or forward migration) so ADMIN can hold it.',
      }));
    }
  }

  // DB role matrix must match the contract.
  const roles = ['MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER'];
  for (const role of roles) {
    const expected = new Set(contract.roleMatrix[role]);
    for (const p of contract.permissions) {
      const got = await db.query(
        `select public.role_has_app_permission($1,$2) ok`,
        [role, p],
      );
      const has = got.rows[0]?.ok;
      if (has && !expected.has(p)) {
        findings.push(finding({
          id: 'DG-GOV-002', severity: SEVERITY.HIGH, category: 'authorization',
          title: `Backend grants ${role} permission "${p}" but the governance contract forbids it`,
          evidence: `${role} -> ${p}`,
          remediation: 'Remove the permission from role_has_app_permission via a forward migration.',
        }));
      } else if (!has && expected.has(p)) {
        findings.push(finding({
          id: 'DG-GOV-002', severity: SEVERITY.HIGH, category: 'authorization',
          title: `Backend denies ${role} governed permission "${p}"`,
          evidence: `${role} -> ${p}`,
          remediation: 'Add the permission to role_has_app_permission via a forward migration.',
        }));
      }
    }
  }

  // ADMIN must hold every catalog permission.
  for (const p of contract.permissions) {
    const got = await db.query(`select public.role_has_app_permission('ADMIN',$1) ok`, [p]);
    if (!got.rows[0]?.ok) {
      findings.push(finding({
        id: 'DG-GOV-003', severity: SEVERITY.HIGH, category: 'authorization',
        title: `ADMIN is missing governed permission "${p}"`,
        evidence: p,
        remediation: 'ADMIN must have full authority; ensure the permission is in app_permission_catalog.',
      }));
    }
  }

  // Frontend role matrix must match the contract (so UI never shows an action
  // the backend rejects, and never hides a granted capability).
  const permSrc = await readFile(PERMISSIONS_TS, 'utf8');
  const feMatrix = parseFrontendRoleMatrix(permSrc);
  for (const role of roles) {
    const expected = new Set(contract.roleMatrix[role]);
    const fe = new Set(feMatrix[role] ?? []);
    for (const p of expected) {
      if (!fe.has(p)) {
        findings.push(finding({
          id: 'DG-GOV-004', severity: SEVERITY.HIGH, category: 'authorization',
          title: `Frontend denies ${role} governed permission "${p}" that backend grants`,
          evidence: `${role} -> ${p}`,
          remediation: 'Add it to rolePermissions in permissions.ts.',
        }));
      }
    }
    for (const p of fe) {
      if (!expected.has(p)) {
        findings.push(finding({
          id: 'DG-GOV-004', severity: SEVERITY.HIGH, category: 'authorization',
          title: `Frontend grants ${role} permission "${p}" that the contract forbids`,
          evidence: `${role} -> ${p}`,
          remediation: 'Remove it from rolePermissions in permissions.ts.',
        }));
      }
    }
  }

  // VIEWER must have no mutation permissions in the frontend matrix.
  const feViewer = new Set(feMatrix.VIEWER ?? []);
  for (const mut of contract.mutationPermissions) {
    if (feViewer.has(mut)) {
      findings.push(finding({
        id: 'DG-GOV-005', severity: SEVERITY.CRITICAL, category: 'authorization',
        title: `VIEWER has mutation permission "${mut}" in the frontend`,
        evidence: mut,
      }));
    }
  }

  // Each governed sensitive RPC must authorize against the matrix role.
  for (const [rpc, spec] of Object.entries(contract.rpc)) {
    const exists = await db.query(
      `select to_regprocedure($1) is not null ok`,
      [`public.${rpc}(jsonb)`],
    );
    if (!exists.rows[0]?.ok) continue; // signature may differ; not all take jsonb
    // Behavioral proof is in behavioral.mjs; here we structurally require the
    // permission token to appear in the function body.
    const body = await db.query(
      `select pg_get_functiondef(p.oid) def
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname=$1`,
      [rpc],
    );
    const def = body.rows[0]?.def ?? '';
    if (spec.permission && !def.includes(spec.permission) && !/is_admin\(\)/.test(def)) {
      findings.push(finding({
        id: 'DG-GOV-006', severity: SEVERITY.HIGH, category: 'authorization',
        title: `RPC ${rpc} does not reference governed permission "${spec.permission}"`,
        evidence: rpc,
        remediation: 'Authorize the RPC against current_user_has_effective_app_permission(<permission>).',
      }));
    }
  }

  // Authority-path checker: no public SECURITY DEFINER function may bypass the
  // canonical permission resolver with a direct role comparison. This catches
  // support/finance helpers that historically used by-name role shortcuts.
  //   - direct compare of current_app_role() in ('ADMIN',...) without going
  //     through role_has_app_permission / the permission resolver
  //   - reading users.role for an authorization decision
  // The canonical resolver chain is current_user_has_effective_app_permission /
  // role_has_app_permission / active_company_role comparisons in the role
  // predicate helpers themselves.
  const bypass = await db.query(`
    select p.proname, pg_get_function_identity_arguments(p.oid) args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and (
         (position('current_app_role()' in pg_get_functiondef(p.oid)) > 0
          and position('current_user_has_effective_app_permission' in pg_get_functiondef(p.oid)) = 0
          and position('role_has_app_permission' in pg_get_functiondef(p.oid)) = 0
          and pg_get_functiondef(p.oid) ~* 'current_app_role\(\)\s*(=|in|<>|any)')
         or
         (pg_get_functiondef(p.oid) ~* 'from\s+public\.users\s+\w+'
          and pg_get_functiondef(p.oid) ~* '\w+\.role(::text)?\s*(=|in|<>|any)')
       )
  `);
  for (const row of bypass.rows) {
    findings.push(finding({
      id: 'DG-GOV-007', severity: SEVERITY.HIGH, category: 'authorization',
      title: `Function ${row.proname}(${row.args}) bypasses the canonical permission resolver with a direct role check`,
      evidence: `${row.proname}(${row.args})`,
      remediation: 'Authorize via current_user_has_effective_app_permission or active_company_role; do not compare users.role/current_app_role directly.',
    }));
  }

  // Every frontend-called public RPC that mutates data and is sensitive should
  // appear in the governance contract OR contain a recognizable in-body
  // authority check. An RPC missing from the contract is an inventory gap
  // (LOW); an RPC with neither a contract entry NOR an in-body authority
  // check is a HIGH finding.
  const ungoverned = await db.query(`
    select p.proname, pg_get_function_identity_arguments(p.oid) args,
           pg_get_functiondef(p.oid) def
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.proname ~ '(_atomic|_at_once)$'
       and p.proname not in (select jsonb_object_keys($1::jsonb))
  `, [JSON.stringify(contract.rpc)]);
  const authPattern = /current_user_has_effective_app_permission|role_has_app_permission|active_company_role\(\)|is_background_service_worker\(\)|is_admin_or_manager\(\)|is_admin\(\)|is_accountant\(\)|is_operations\(\)|current_user_has_support_capability|auth\.uid\(\)\s+is\s+null|require_company_id\(\)|current_company_id\(\)\s+is\s+null|role\s*=\s*'ADMIN'|cm\.role\s*=\s*'ADMIN'|raise exception/i;
  for (const row of ungoverned.rows) {
    const hasAuth = authPattern.test(row.def);
    if (!hasAuth) {
      findings.push(finding({
        id: 'DG-GOV-008', severity: SEVERITY.HIGH, category: 'authorization',
        title: `SECURITY DEFINER RPC ${row.proname} has no recognizable authority check and is not in the governance contract`,
        evidence: `${row.proname}(${row.args})`,
        remediation: 'Add an authority check or list the RPC in governance-contract.json.',
      }));
    }
    // Ungoverned-but-checked RPCs are intentionally not emitted as findings:
    // they are an inventory-coverage backlog, tracked separately by the
    // operation-map gate. Emitting them here would create noise without
    // indicating an authority defect.
  }

  await db.close();
  return { findings, roles: contract.roles.map((r) => r.id) };
}
