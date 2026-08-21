// Guardian inventory gate.
//
// Replays migrations into an ephemeral PostgreSQL (reusing the db0 engine) and
// produces the full canonical inventory plus contract-rule findings.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDatabase, replay, listMigrations, ROOT } from '../../db0/lib/replay.mjs';
import { introspect, columnTypeSignature } from '../../db0/lib/introspect.mjs';
import { finding, SEVERITY } from './findings.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(HERE, '..', 'contract.json');

export async function loadContract() {
  return JSON.parse(await readFile(CONTRACT_PATH, 'utf8'));
}

function tableColumns(schema, table) {
  return schema.columns.filter((c) => c.table_name === table);
}

function hasColumn(schema, table, column) {
  return schema.columns.some((c) => c.table_name === table && c.column_name === column);
}

function constraintOf(schema, table, predicate) {
  return schema.constraints.find((c) => c.table_name === table && predicate(c));
}

function indexesOn(schema, table, column) {
  return schema.indexes.filter(
    (i) => i.table_name === table && new RegExp(`\\b${column}\\b`).test(i.definition),
  );
}

export async function runInventoryChecks({ db, schema } = {}) {
  const findings = [];
  const ownDb = !db;
  const files = await listMigrations();
  if (ownDb) {
    db = await createDatabase();
    const r = await replay(db, { files, stopOnError: false });
    if (r.failures.length) {
      for (const f of r.failures) {
        findings.push(finding({
          id: 'DG-MIG-001',
          severity: SEVERITY.CRITICAL,
          category: 'migration',
          title: `Migration ${f.file} fails to replay from clean database`,
          evidence: f.error,
          remediation: 'Fix the migration; never edit merged migrations — add a new forward migration.',
        }));
      }
    }
    schema = await introspect(db);
  }

  const contract = await loadContract();

  // 1. Inventory completeness -------------------------------------------------
  const inventory = {
    tables: schema.tables.length,
    columns: schema.columns.length,
    constraints: schema.constraints.length,
    foreignKeys: schema.foreign_keys.length,
    indexes: schema.indexes.length,
    views: schema.views.length,
    triggers: schema.triggers.length,
    functions: schema.functions.length,
    policies: schema.policies.length,
    enums: schema.enums.length,
    securityDefiner: schema.functions.filter((f) => f.security_definer).length,
  };

  // 2. Money columns must be NUMERIC, never float ----------------------------
  const forbidden = new Set(contract.money.forbiddenTypes);
  const moneyTables = new Set(contract.money.tables);
  for (const col of schema.columns) {
    if (forbidden.has(col.udt_name) || forbidden.has(col.data_type)) {
      // only flag money-semantic columns on financial tables
      if (moneyTables.has(col.table_name) && /amount|balance|total|rate|price|fee|tax|deposit|rent|cost/i.test(col.column_name)) {
        findings.push(finding({
          id: 'DG-FIN-001',
          severity: SEVERITY.CRITICAL,
          category: 'financial',
          title: `${col.table_name}.${col.column_name} uses floating point ${col.udt_name || col.data_type} for money`,
          evidence: `${col.table_name}.${col.column_name} :: ${col.data_type}`,
          remediation: 'Use numeric(18,3) for OMR money; float cannot represent decimal currency exactly.',
        }));
      }
    }
  }

  // 3. Every financial table must have company_id + RLS (excluding exempt) ---
  const exempt = new Set(contract.tenantIsolation.exemptTables);
  const tableNames = new Set(schema.tables.map((t) => t.name));
  for (const t of contract.money.tables) {
    if (!tableNames.has(t)) continue;
    if (exempt.has(t)) continue;
    if (!hasColumn(schema, t, 'company_id')) {
      findings.push(finding({
        id: 'DG-ISO-001',
        severity: SEVERITY.CRITICAL,
        category: 'rls',
        title: `Financial table ${t} has no company_id column`,
        evidence: t,
        remediation: 'Add company_id uuid not null references companies(id); all tenant data must be company-scoped.',
      }));
    }
    const tbl = schema.tables.find((x) => x.name === t);
    if (tbl && !tbl.rls_enabled) {
      findings.push(finding({
        id: 'DG-ISO-002',
        severity: SEVERITY.CRITICAL,
        category: 'rls',
        title: `Financial table ${t} has RLS disabled`,
        evidence: t,
        remediation: 'alter table ... enable row security; and add company-scoped policies.',
      }));
    }
  }

  // 4. Protected GL/subledger tables must forbid browser direct writes -------
  const protectedSet = new Set(contract.protectedFinancialTables);
  for (const t of contract.protectedFinancialTables) {
    if (!tableNames.has(t)) continue;
    const policies = schema.policies.filter((p) => p.tablename === t);
    const hasPermissiveWrite = policies.some(
      (p) => p.permissive === 'PERMISSIVE'
        && /(^|[{,\s])(authenticated|public)([},\s]|$)/i.test(p.roles ?? '')
        && (p.cmd === 'ALL' || p.cmd === 'INSERT' || p.cmd === 'UPDATE' || p.cmd === 'DELETE')
        && !/false/i.test(p.qual ?? '') && !/false/i.test(p.with_check ?? ''),
    );
    if (hasPermissiveWrite) {
      findings.push(finding({
        id: 'DG-FIN-002',
        severity: SEVERITY.HIGH,
        category: 'financial',
        title: `Protected financial table ${t} has a permissive browser write policy`,
        evidence: policies.filter((p) => p.permissive === 'PERMISSIVE').map((p) => p.name).join(', '),
        remediation: 'Writes to protected financial tables must go through SECURITY DEFINER RPCs, not direct browser DML.',
      }));
    }
  }

  // 5. Document number uniqueness -------------------------------------------
  for (const [table, column] of Object.entries(contract.documentNumbering)) {
    if (!tableNames.has(table)) continue;
    const unique = schema.constraints.some(
      (c) => c.table_name === table && c.type === 'u' && new RegExp(`\\b${column}\\b`).test(c.definition),
    ) || indexesOn(schema, table, column).some((i) => /unique/i.test(i.definition));
    if (!unique) {
      findings.push(finding({
        id: 'DG-FIN-003',
        severity: SEVERITY.HIGH,
        category: 'financial',
        title: `Document number ${table}.${column} has no unique constraint`,
        evidence: `${table}.${column}`,
        remediation: 'Add a unique (company_id, no) constraint to prevent duplicate document numbers.',
      }));
    }
  }

  // 6. Append-only / soft-delete: protected rows must not be hard-deletable --
  for (const t of contract.appendOnlyTables) {
    if (!tableNames.has(t)) continue;
    // A trigger guard is the canonical mechanism. Flag tables with no delete
    // trigger and no ON DELETE rule preventing deletion.
    const triggers = schema.triggers.filter((tr) => tr.table_name === t && /delete|immutab|guard|prevent/i.test(tr.definition));
    if (!triggers.length && !hasColumn(schema, t, 'deleted_at')) {
      findings.push(finding({
        id: 'DG-FIN-004',
        severity: SEVERITY.MEDIUM,
        category: 'financial',
        title: `Append-only table ${t} has no delete guard or soft-delete column`,
        evidence: t,
        remediation: 'Add a BEFORE DELETE trigger that raises, or a deleted_at column with an update-only policy.',
      }));
    }
  }

  // 7. SECURITY DEFINER functions must pin search_path -----------------------
  for (const fn of schema.functions) {
    if (!fn.security_definer) continue;
    if (!/search_path/.test(fn.config ?? '')) {
      findings.push(finding({
        id: 'DG-SEC-001',
        severity: SEVERITY.HIGH,
        category: 'security',
        title: `SECURITY DEFINER function ${fn.name}(${fn.args}) does not pin search_path`,
        evidence: `config=${fn.config || '(none)'}`,
        remediation: 'ALTER FUNCTION ... SET search_path = public, pg_temp;',
      }));
    }
  }

  // 8. company_id must be FK-anchored ----------------------------------------
  for (const t of schema.tables) {
    if (exempt.has(t.name)) continue;
    const cols = tableColumns(schema, t.name);
    if (!cols.some((c) => c.column_name === 'company_id')) continue;
    const fk = schema.foreign_keys.find(
      (f) => f.table_name === t.name && /company_id/.test(f.definition) && f.references_table === 'companies',
    );
    if (!fk) {
      findings.push(finding({
        id: 'DG-INT-001',
        severity: SEVERITY.MEDIUM,
        category: 'data',
        title: `${t.name}.company_id is not anchored by a foreign key to companies`,
        evidence: t.name,
        remediation: 'Add foreign key (company_id) references companies(id).',
      }));
    }
  }

  if (ownDb) await db.close();
  return { findings, inventory, schema, contract };
}
