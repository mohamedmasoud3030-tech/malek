import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
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

// Migration 49 was already immutable on main before this gate started enforcing
// explicit ALLOW_GOVERNED_DATA_MIGRATION markers. Its transactional INSERT
// tokens are inside the SECURITY DEFINER extend_short_stay_contract_atomic
// runtime command, not migration-time seed/backfill statements. Grandfather only
// the exact historical Git blob: any byte change or any new migration still
// goes through the normal fail-closed rule below.
const immutableGovernedRuntimeWriterBlobs = new Map([
  ['20260901000049_extend_short_stay_atomic.sql', '6187d4b1df558f3a324b0c02fd8430e3f3b18ee0'],
]);

function gitBlobSha(content) {
  const header = `blob ${Buffer.byteLength(content, 'utf8')}\0`;
  return createHash('sha1').update(header).update(content).digest('hex');
}

const files = (await readdir(migrationsDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^\d{14}_.+\.sql$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

const baselineExists = files.includes(baseline);

if (!baselineExists) {
  console.error(`Database governance gate failed: canonical baseline ${baseline} is missing from the active bootstrap.`);
  process.exit(1);
}

const problems = [];

for (const file of files) {
  if (file === baseline) continue; // the cutover snapshot contains historical object names by design.
  const sql = await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');
  const pinnedBlob = immutableGovernedRuntimeWriterBlobs.get(file);
  const isPinnedHistoricalRuntimeWriter = pinnedBlob !== undefined && gitBlobSha(sql) === pinnedBlob;

  if (pinnedBlob !== undefined && !isPinnedHistoricalRuntimeWriter) {
    problems.push(`${file}: immutable governed runtime-writer exception no longer matches the pinned historical blob`);
  }

  for (const match of sql.matchAll(objectPattern)) {
    const name = match[1];
    if (forbiddenIdentifier.test(name)) {
      problems.push(`${file}: permanent object identifier uses sprint/version language: ${name}`);
    }
  }

  for (const table of transactionalTables) {
    const rawInsert = new RegExp(`\\binsert\\s+into\\s+(?:public\\.)?"?${table}"?\\b`, 'i');
    if (
      rawInsert.test(sql)
      && !/ALLOW_GOVERNED_DATA_MIGRATION/i.test(sql)
      && !isPinnedHistoricalRuntimeWriter
    ) {
      problems.push(`${file}: raw INSERT into transactional table ${table}; use governed RPC/seed path or explicitly document a governed data migration`);
    }
  }
}

if (problems.length > 0) {
  console.error('Database governance gate failed:\n' + problems.map((p) => `- ${p}`).join('\n'));
  process.exit(1);
}

console.log(`Database governance gate passed for ${files.length} active migration file(s).`);
