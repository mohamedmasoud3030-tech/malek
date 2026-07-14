import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260715000003_purge_qa_journal_entries_residuals.sql',
  ),
  'utf8',
).toLowerCase();

describe('QA journal residual cleanup migration', () => {
  it('treats an already-clean database as a valid no-op', () => {
    expect(migration).toContain('if v_count = 0 then');
    expect(migration).toContain('qa residual journal entries are already absent');
  });

  it('fails closed on partial or broadened matches', () => {
    expect(migration).toContain('if v_count <> 2 then');
    expect(migration).toContain('expected zero or exactly 2 rows matching target criteria');
    expect(migration).toContain('pay-testqapaymen-d');
    expect(migration).toContain('pay-testqapaymen-c');
  });

  it('deletes only the two validated row ids', () => {
    expect(migration).toContain('where id in (v_debit_row.id, v_credit_row.id)');
    expect(migration).not.toMatch(/^\s*truncate\b/im);
  });
});
