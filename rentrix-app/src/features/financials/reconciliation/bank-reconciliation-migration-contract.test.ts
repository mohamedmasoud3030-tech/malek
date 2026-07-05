import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260705000005_bank_reconciliation_foundation.sql');

describe('bank reconciliation migration contract', () => {
  it('creates reconciliation tables with RLS and non-destructive grants', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    for (const tableName of ['bank_accounts', 'bank_statement_imports', 'bank_statement_lines', 'bank_reconciliation_matches']) {
      expect(sql).toContain(`create table if not exists public.${tableName}`);
      expect(sql).toContain(`alter table public.${tableName} enable row level security;`);
      expect(sql).toContain(`grant select, insert, update on public.${tableName} to authenticated;`);
      expect(sql).toContain(`revoke delete on public.${tableName} from authenticated;`);
    }

    expect(sql).toContain("status in ('unmatched', 'matched', 'ignored')");
    expect(sql).toContain("matched_entity_type in ('payment', 'receipt', 'expense', 'manual_adjustment')");
  });
});
