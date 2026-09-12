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

// Pre-existing violations grandfathered at the exact historical Git blob.
// These five migrations predate this gate and were proven to fail it on the
// canonical baseline (commit 5a53be6b): raw INSERTs into transactional tables
// (governed data migrations that predate the ALLOW_GOVERNED_DATA_MIGRATION
// marker convention) and permanent objects whose names use sprint/version
// language (wp05_*/s08_*). Historical migrations are immutable under the
// rollback-hygiene guard, so the exemptions cannot be remediated by editing
// them; pinning the exact blob keeps the exemption fail-closed — any byte
// change voids it (flagged below) and the file is re-checked normally.
const grandfatheredPreexistingViolationBlobs = new Map([
  ['20260909000002_deposit_receipt_command_integrity.sql', 'a282ef85346461e11a49fdc3506015040d27f705'],
  ['20260909000004_historical_reconciliation_lineage.sql', '8500d0d2905dfea4c2da11d9fab50ab166fb29dd'],
  ['20260909000009_reconciliation_entry_authority.sql', '359bb4fa5facf9ab913f9e069122501f410d892e'],
  ['20260909000010_expense_history_diagnostic_lineage.sql', '3094c1421378877f84bf0b8922f3267b36a5b017'],
  ['20260909000012_owner_expense_allocation_source.sql', '7204b80aa7477d2de9e3e9a8f771c78bcff1a787'],
]);

function gitBlobSha(content) {
  const header = `blob ${Buffer.byteLength(content, 'utf8')}\0`;
  return createHash('sha1').update(header).update(content).digest('hex');
}

const files = (await readdir(migrationsDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^\d{14}_.+\.sql$/.test(entry.name))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

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

  const grandfatherBlob = grandfatheredPreexistingViolationBlobs.get(file);
  if (grandfatherBlob !== undefined) {
    if (gitBlobSha(sql) === grandfatherBlob) {
      continue; // exact historical content — pre-existing at baseline, exempt
    }
    problems.push(`${file}: grandfathered pre-existing-violations exemption is void — the file no longer matches the pinned historical blob; it is re-checked below`);
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
