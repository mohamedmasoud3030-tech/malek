// Guardian operation map.
//
// Produces a map:  frontend .rpc()/.from() call  ->  RPC  ->  tables written
// and flags business tables that have more than one write path (e.g. an RPC
// writes them AND the frontend imports them directly, or two RPCs write the
// same protected table without a clear shared engine).
//
// Multiple write paths to a protected financial table are a HIGH finding:
// they create bypass routes around invariants.

import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDatabase, replay, ROOT } from '../../db0/lib/replay.mjs';
import { finding, SEVERITY } from './findings.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = join(ROOT, 'rentrix-app', 'src');

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      await walk(p, out);
    } else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

// Find .rpc('name') and .from('table') calls in frontend source.
async function scanFrontend() {
  const files = await walk(APP_SRC);
  const rpcs = new Map();   // rpc -> [files]
  const froms = new Map();  // table -> [files]
  for (const file of files) {
    const src = await readFile(file, 'utf8');
    const rel = relative(ROOT, file);
    for (const m of src.matchAll(/\.rpc\(\s*['"`]([a-z0-9_]+)['"`]/gi)) {
      const name = m[1];
      if (!rpcs.has(name)) rpcs.set(name, []);
      rpcs.get(name).push(rel);
    }
    for (const m of src.matchAll(/\.from\(\s*['"`]([a-z0-9_]+)['"`]/gi)) {
      const name = m[1];
      if (!froms.has(name)) froms.set(name, []);
      froms.get(name).push(rel);
    }
  }
  return { rpcs, froms, filesScanned: files.length };
}

// Extract tables that a function body writes by static scan of its prosrc.
function tablesTouchedByFunction(fn) {
  // We don't have prosrc in introspection. Query it separately.
  return null;
}

export async function runOperationMap() {
  const findings = [];
  const frontend = await scanFrontend();

  const db = await createDatabase();
  await replay(db, { stopOnError: false });

  // Map: for each public function, which tables does its body INSERT/UPDATE/
  // DELETE? We scan pg_proc.prosrc for the canonical public functions.
  const funcs = await db.query(`
    select p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args,
           pg_get_functiondef(p.oid) as def
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public','app_private')
       and p.prokind = 'f'
  `);

  const writesByTable = new Map(); // table -> [{fn, via}]
  function recordWrite(table, fn) {
    if (!writesByTable.has(table)) writesByTable.set(table, []);
    writesByTable.get(table).push(fn);
  }

  for (const f of funcs.rows) {
    const body = f.def || '';
    const tables = new Set();
    for (const m of body.matchAll(/\b(?:insert\s+into|update|delete\s+from)\s+(?:only\s+)?(?:public\.)?"?([a-z_][a-z0-9_]+)"?/gi)) {
      tables.add(m[1]);
    }
    for (const t of tables) {
      recordWrite(t, `${f.name}(${f.args.split(',').map((x) => x.trim()).slice(0, 2).join(',')}${f.args.includes(',') ? '…' : ''})`);
    }
  }

  // Tables the frontend writes to directly (INSERT/UPDATE/DELETE detected by
  // presence of a .from() plus an insert/update/delete/upsert within 200 chars).
  const frontendWrites = new Map();
  for (const [table, files] of frontend.froms) {
    for (const file of files) {
      const src = await readFile(join(ROOT, file), 'utf8');
      const re = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`][^)]{0,260}?\\.(insert|update|delete|upsert)\\(`, 'is');
      if (re.test(src)) {
        if (!frontendWrites.has(table)) frontendWrites.set(table, new Set());
        frontendWrites.get(table).add(file);
      }
    }
  }

  const protectedTables = new Set([
    'journal_lines', 'journal_batches', 'receipt_allocations', 'invoice_credits',
    'deposit_transactions', 'deposit_application_claims', 'deposit_refund_events',
    'owner_funds_events', 'invoice_payment_tax_allocations', 'taxable_line_tax_snapshots',
    'fixed_monthly_daily_accruals', 'fixed_monthly_daily_accrual_reversals',
    'owner_settlement_payment_links', 'owner_settlement_expense_links',
    'bank_reconciliation_matches',
  ]);

  for (const [table, writers] of writesByTable.entries()) {
    if (!protectedTables.has(table)) continue;
    const uniqueWriters = [...new Set(writers)];
    const directFrontend = frontendWrites.get(table);
    if (directFrontend && directFrontend.size > 0) {
      findings.push(finding({
        id: 'DG-OPMAP-001',
        severity: SEVERITY.CRITICAL,
        category: 'operation-map',
        title: `Protected table ${table} is written directly by frontend AND by RPCs`,
        evidence: `frontend: ${[...directFrontend].join(', ')}; rpc writers: ${uniqueWriters.slice(0, 5).join(', ')}`,
        remediation: 'Remove direct frontend writes; route through a governed RPC that enforces invariants.',
      }));
    }
    if (uniqueWriters.length > 3) {
      findings.push(finding({
        id: 'DG-OPMAP-002',
        severity: SEVERITY.MEDIUM,
        category: 'operation-map',
        title: `Protected table ${table} has ${uniqueWriters.length} server-side write functions`,
        evidence: uniqueWriters.join('; '),
        detail: 'Many writers may indicate parallel write paths. Consolidate through one engine function.',
      }));
    }
  }

  // Frontend calls an RPC that does not exist in the migrated schema
  const existingRpcs = new Set(funcs.rows.filter((f) => !f.args.includes('OUT')).map((f) => f.name));
  for (const rpc of frontend.rpcs.keys()) {
    if (!existingRpcs.has(rpc)) {
      findings.push(finding({
        id: 'DG-OPMAP-003',
        severity: SEVERITY.HIGH,
        category: 'operation-map',
        title: `Frontend calls RPC "${rpc}" that does not exist in the migrated schema`,
        evidence: `used in: ${frontend.rpcs.get(rpc).slice(0, 3).join(', ')}`,
        remediation: 'Add the RPC or remove the stale frontend call.',
      }));
    }
  }

  await db.close();

  const map = {
    frontendRpcs: frontend.rpcs.size,
    frontendFroms: frontend.froms.size,
    filesScanned: frontend.filesScanned,
    protectedTableWriters: Object.fromEntries(
      [...writesByTable.entries()]
        .filter(([t]) => protectedTables.has(t))
        .map(([t, w]) => [t, [...new Set(w)]]),
    ),
  };

  return { findings, map };
}
