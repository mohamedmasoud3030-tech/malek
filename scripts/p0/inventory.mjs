#!/usr/bin/env node
/**
 * P0 — Automated, re-runnable inventory of the database surface vs frontend usage.
 *
 * Scans supabase/migrations/**.sql (chronological) to build the effective object
 * registry (latest definition wins; explicit DROPs remove), then cross-references
 * rentrix-app/src for table reads (`.from('<t>')`) and RPC calls (`rpc('<f>')`,
 * including casted `supabase.rpc as ...('<f>')` call sites).
 *
 * Outputs:
 *   evidence/p0/inventory.json — machine-readable registry
 *   evidence/p0/inventory.md   — human-readable summary
 *
 * Re-run:  node scripts/p0/inventory.mjs
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migDir = join(repoRoot, 'supabase', 'migrations');
const srcDir = join(repoRoot, 'rentrix-app', 'src');
const outDir = join(repoRoot, 'evidence', 'p0');

const migFiles = readdirSync(migDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const tables = new Map(); // name -> { createdIn, drops: [], rlsEnabled, policies: Set }
const views = new Map();
const functions = new Map(); // name -> { latestFile, signature, body, grants:Set, revokes:Set }
const grantRe = /grant\s+execute\s+on\s+function\s+(?:public\.)?([a-z_0-9]+)\s*\(([^)]*)\)\s+to\s+([a-z_,\s]+?);/gi;
const revokeRe = /revoke\s+(?:all|execute)\s+on\s+function\s+(?:public\.)?([a-z_0-9]+)\s*\(([^)]*)\)\s+from\s+([a-z_,\s]+?);/gi;

// Function definitions captured with balanced-dollar-quote body extraction.
const fnDefRe = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\(([^)]*)\)/gi;

function ensure(map, key, init) {
  if (!map.has(key)) map.set(key, init);
  return map.get(key);
}

for (const file of migFiles) {
  const sql = readFileSync(join(migDir, file), 'utf8');

  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:([a-z_0-9]+)\.)?"?([a-z_0-9-]+)"?\s*\(/gi)) {
    // Track public-schema tables only (storage.* / auth.* are platform-owned).
    if (m[1] && m[1].toLowerCase() !== 'public') continue;
    ensure(tables, m[2].toLowerCase(), { createdIn: file, rlsEnabled: false, policies: new Set(), dropped: false });
  }
  for (const m of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z_0-9-]+)"?/gi)) {
    const t = ensure(tables, m[1].toLowerCase(), { createdIn: null, rlsEnabled: false, policies: new Set(), dropped: false });
    t.dropped = file;
  }
  for (const m of sql.matchAll(/alter\s+table\s+(?:(?:only)\s+)?(?:([a-z_0-9]+)\.)?"?([a-z_0-9-]+)"?\s+enable\s+row\s+level\s+security/gi)) {
    if (m[1] && m[1].toLowerCase() !== 'public') continue;
    ensure(tables, m[2].toLowerCase(), { createdIn: null, rlsEnabled: false, policies: new Set(), dropped: false }).rlsEnabled = true;
  }
  for (const m of sql.matchAll(/create\s+policy\s+"?([a-z_0-9\s-]+?)"?\s+on\s+(?:([a-z_0-9]+)\.)?"?([a-z_0-9-]+)"?/gi)) {
    if (m[2] && m[2].toLowerCase() !== 'public') continue;
    ensure(tables, m[3].toLowerCase(), { createdIn: null, rlsEnabled: false, policies: new Set(), dropped: false }).policies.add(m[1].trim());
  }
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?"?([a-z_0-9]+)"?/gi)) {
    views.set(m[1].toLowerCase(), file);
  }
  for (const m of sql.matchAll(fnDefRe)) {
    const name = m[1].toLowerCase();
    const rec = ensure(functions, name, { latestFile: null, signature: '', defFile: null, grants: new Set(), revokes: new Set() });
    rec.latestFile = file;
    rec.signature = m[2].replace(/\s+/g, ' ').trim();
  }
  for (const m of sql.matchAll(/drop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_0-9]+)\s*\(([^)]*)\)/gi)) {
    // Stale-overload cleanup: definition of a *different* signature is dropped.
    // Keep the function registered but track the drop event.
    const rec = functions.get(m[1].toLowerCase());
    if (rec) (rec.droppedSigs ??= []).push(`${file}:(${m[2].replace(/\s+/g, ' ').trim()})`);
  }
  for (const m of sql.matchAll(grantRe)) {
    const rec = ensure(functions, m[1].toLowerCase(), { latestFile: null, signature: '', grants: new Set(), revokes: new Set() });
    m[3].split(',').map((s) => s.trim().toLowerCase()).forEach((g) => rec.grants.add(g));
  }
  for (const m of sql.matchAll(revokeRe)) {
    const rec = ensure(functions, m[1].toLowerCase(), { latestFile: null, signature: '', grants: new Set(), revokes: new Set() });
    m[3].split(',').map((s) => s.trim().toLowerCase()).forEach((g) => rec.revokes.add(g));
  }
}

// ---- Frontend usage scan ----------------------------------------------------
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) acc.push(p);
  }
  return acc;
}

const usedTables = new Set();
const usedRpcs = new Set();
const fromRe = /\.from\(\s*'([a-z_0-9-]+)'/g;
const rpcRe = /(?:rpc|supabase\.rpc)\s*(?:\([^)]*\))?\s*\(\s*'([a-z_0-9]+)'/g;
for (const file of walk(srcDir)) {
  const txt = readFileSync(file, 'utf8');
  for (const m of txt.matchAll(fromRe)) usedTables.add(m[1].toLowerCase());
  for (const m of txt.matchAll(rpcRe)) usedRpcs.add(m[1].toLowerCase());
  // Second pass: indirect dispatch `(supabase.rpc as unknown as Rpc)('name', …)`
  // and helper-mediated calls — any quoted identifier matching a known DB
  // function inside a file that references `.rpc` counts as a call site.
  if (/\.rpc/.test(txt)) {
    for (const m of txt.matchAll(/'([a-z_0-9]+)'/g)) {
      const candidate = m[1].toLowerCase();
      if (functions.has(candidate)) usedRpcs.add(candidate);
    }
  }
}

// ---- Classification ---------------------------------------------------------
const classifyFn = (name) => {
  if (name.startsWith('rpt_')) return 'report-read';
  if (name.endsWith('_atomic')) return 'financial-write';
  if (/^(sync_|update_.*from|touch_|set_.*updated_at|audit_journal|prevent_|enforce_|validate_|assert_|normalize_|recalculate_|refresh_|resolve_unit|check_)/.test(name)) return 'trigger-or-internal';
  return 'helper-or-other';
};

// Server-owned tables: legitimately never referenced by the frontend because
// they are maintained by triggers/RPCs (ledger, projections, auth, platform).
const SERVER_OWNED = new Set([
  'accounts', 'journal_entries', 'financial_operation_idempotency', 'receipt_allocations',
  'contract_balances', 'owner_balances', 'tenant_balances', 'account_balances',
  'receipts', 'users', 'companies', 'bank_reconciliation_matches',
]);

const tableRows = [...tables.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, t]) => ({
  name,
  createdIn: t.createdIn,
  dropped: t.dropped || null,
  rlsEnabled: t.rlsEnabled,
  policies: t.policies.size,
  referencedByFrontend: usedTables.has(name),
  classification: usedTables.has(name) ? 'live' : SERVER_OWNED.has(name) ? 'server-owned' : 'attic-candidate',
}));

const fnRows = [...functions.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, f]) => ({
  name,
  kind: classifyFn(name),
  latestDefinition: f.latestFile,
  signature: f.signature,
  grants: [...f.grants].sort(),
  revokes: [...f.revokes].sort(),
  calledByFrontend: usedRpcs.has(name),
  droppedSignatures: f.droppedSigs ?? [],
}));

const summary = {
  generatedAt: new Date().toISOString(),
  migrationsScanned: migFiles.length,
  tables: {
    total: tableRows.length,
    referencedByFrontend: tableRows.filter((t) => t.referencedByFrontend).length,
    serverOwned: tableRows.filter((t) => t.classification === 'server-owned').map((t) => t.name),
    atticCandidates: tableRows.filter((t) => t.classification === 'attic-candidate' && !t.dropped).map((t) => t.name),
  },
  functions: {
    total: fnRows.length,
    calledByFrontend: fnRows.filter((f) => f.calledByFrontend).length,
    byKind: fnRows.reduce((acc, f) => ({ ...acc, [f.kind]: (acc[f.kind] ?? 0) + 1 }), {}),
    deadReportRpcs: fnRows.filter((f) => f.kind === 'report-read' && !f.calledByFrontend).map((f) => f.name),
  },
  views: [...views.keys()].sort(),
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'inventory.json'), JSON.stringify({ summary, tables: tableRows, functions: fnRows }, null, 2));

const md = [
  '# P0 — جرد آلي لسطح قاعدة البيانات × استخدام الواجهة',
  `أُنشئ: ${summary.generatedAt} · الهجرات المفحوصة: ${summary.migrationsScanned}`,
  '',
  `## الخلاصة`,
  `- الجداول: **${summary.tables.total}** (تستخدمها الواجهة: **${summary.tables.referencedByFrontend}**)`,
  `- الدوال: **${summary.functions.total}** (تستدعيها الواجهة: **${summary.functions.calledByFrontend}**)`,
  `- حسب النوع: ${Object.entries(summary.functions.byKind).map(([k, v]) => `${k}=${v}`).join(' · ')}`,
  `- دوال تقارير لا تستدعيها الواجهة: ${summary.functions.deadReportRpcs.map((n) => '`' + n + '`').join(', ') || '—'}`,
  '',
  '## جداول خادمية (تُدار بالمحفزات/RPCs — لا تقرأها الواجهة وهذا متوقع)',
  ...summary.tables.serverOwned.map((n) => `- \`${n}\``),
  '',
  '## جداول «علية» مرشّحة للتجميد التوثيقي (لا يقرأها Frontend ولا منطق خادمي معروف)',
  ...summary.tables.atticCandidates.map((n) => `- \`${n}\``),
  '',
  '> إعادة التشغيل: `node scripts/p0/inventory.mjs`',
].join('\n');
writeFileSync(join(outDir, 'inventory.md'), md);

console.log(JSON.stringify(summary, null, 2));
