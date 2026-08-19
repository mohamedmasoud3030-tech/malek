import { readdir, readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';

const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
const historyDir = new URL('../supabase/migrations_history/', import.meta.url);
const baseline = '20260901000000_canonical_baseline.sql';

const forbiddenIdentifier = /^(?:wp\d+_|s\d+_|r\d+_|phase\d+_|stage\d+_)|(?:_impl|_base|_phase[a-z0-9_]*|_v\d+)$/i;
const objectPattern = /\bcreate\s+(?:or\s+replace\s+)?(?:materialized\s+view|function|procedure|table|view|type)\s+(?:if\s+not\s+exists\s+)?(?:(?:public|app_private)\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gim;

// Raw demo/business transaction inserts have historically bypassed accounting
// invariants. Reference/system tables are intentionally not on this list.
const transactionalTables = [
  'companies', 'company_members', 'users', 'owners', 'properties', 'units', 'people',
  'contracts', 'invoices', 'payments', 'receipts', 'receipt_allocations', 'expenses',
  'tenant_deposits', 'deposit_transactions', 'owner_settlements', 'owner_funds_events',
  'journal_batches', 'journal_lines', 'bank_statement_imports', 'bank_statement_lines',
];

const files = (await readdir(migrationsDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^\d{14}_.+\.sql$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

let historyExists = true;
try {
  await access(historyDir);
} catch {
  historyExists = false;
}

const baselineExists = files.includes(baseline);

// During the one-time canonicalization branch the historical chain is still in
// supabase/migrations so the real-Supabase builder can prove it before moving
// it to migrations_history/. Those files intentionally contain the exact debt
// this new gate is designed to prevent *after* cutover. Enforcing future-only
// rules against that forensic input would deadlock the cutover itself.
if (!historyExists && !baselineExists && files.length > 3) {
  console.log(`Pre-canonical historical bootstrap detected (${files.length} migrations). Future-only governance is deferred until the canonical builder archives this chain and installs ${baseline}.`);
  process.exit(0);
}

if (!baselineExists) {
  console.error(`Database governance gate failed: canonical baseline ${baseline} is missing from the active bootstrap.`);
  process.exit(1);
}

const problems = [];

for (const file of files) {
  if (file === baseline) continue; // the cutover snapshot contains historical object names by design.
  const sql = await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');

  for (const match of sql.matchAll(objectPattern)) {
    const name = match[1];
    if (forbiddenIdentifier.test(name)) {
      problems.push(`${file}: permanent object identifier uses sprint/version language: ${name}`);
    }
  }

  for (const table of transactionalTables) {
    const rawInsert = new RegExp(`\\binsert\\s+into\\s+(?:public\\.)?"?${table}"?\\b`, 'i');
    if (rawInsert.test(sql) && !/ALLOW_GOVERNED_DATA_MIGRATION/i.test(sql)) {
      problems.push(`${file}: raw INSERT into transactional table ${table}; use governed RPC/seed path or explicitly document a governed data migration`);
    }
  }
}

if (problems.length > 0) {
  console.error('Database governance gate failed:\n' + problems.map((p) => `- ${p}`).join('\n'));
  process.exit(1);
}

console.log(`Database governance gate passed for ${files.length} active migration file(s).`);
