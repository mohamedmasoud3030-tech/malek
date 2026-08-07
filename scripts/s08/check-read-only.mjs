#!/usr/bin/env node
// Static proof that S08 analysis objects contain no forbidden financial writes
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const REPO_ROOT = resolve(import.meta.dirname, '../..');
const MIGRATION = resolve(REPO_ROOT, 'supabase/migrations/20260807020000_s08_read_only_historical_analysis.sql');
const content = readFileSync(MIGRATION, 'utf8');

// Forbidden DML against financial tables (case-insensitive)
// Allow DDL (CREATE VIEW/FUNCTION) but forbid INSERT/UPDATE/DELETE/TRUNCATE on financial tables
const forbiddenPatterns = [
  /INSERT\s+INTO\s+public\.(journal_batches|journal_lines|journal_entries|journal_entries_archive|invoices|payments|expenses|tenant_deposits|owner_settlements|owner_settlement_payment_links|owner_settlement_expense_links|deposit_transactions)\b/i,
  /UPDATE\s+public\.(journal_batches|journal_lines|journal_entries|journal_entries_archive|invoices|payments|expenses|tenant_deposits|owner_settlements)\b/i,
  /DELETE\s+FROM\s+public\.(journal_batches|journal_lines|journal_entries|journal_entries_archive|invoices|payments|expenses|tenant_deposits|owner_settlements)\b/i,
  /\bTRUNCATE\b/i,
];
const hits = [];
for (const pat of forbiddenPatterns) {
  if (pat.test(content)) hits.push(String(pat));
}
if (hits.length) {
  console.error('READ-ONLY CHECK FAILED: forbidden patterns found:', hits);
  process.exit(1);
}
console.log('READ-ONLY STATIC PROOF PASSED: no forbidden financial writes in S08 migration.');
