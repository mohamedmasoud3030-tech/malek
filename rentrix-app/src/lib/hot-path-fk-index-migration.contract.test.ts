import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/20260831000000_hot_path_fk_covering_indexes.sql',
);

describe('hot-path FK covering index migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('is additive index-only (no destructive DDL)', () => {
    expect(sql).toMatch(/create index if not exists/i);
    expect(sql).not.toMatch(/\bdrop table\b/i);
    expect(sql).not.toMatch(/\bdrop column\b/i);
    expect(sql).not.toMatch(/\balter table\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/\bdelete from\b/i);
  });

  it('covers tenant list filters and relationship reverse lookups', () => {
    for (const name of [
      'properties_company_id_idx',
      'units_company_id_idx',
      'people_company_id_idx',
      'owners_company_id_idx',
      'receipt_allocations_receipt_id_idx',
      'owner_settlement_payment_links_settlement_company_idx',
      'owner_settlement_expense_links_settlement_company_idx',
      'maintenance_records_expense_id_idx',
      'deposit_transactions_reversal_of_id_idx',
    ]) {
      expect(sql, name).toContain(name);
    }
  });
});
