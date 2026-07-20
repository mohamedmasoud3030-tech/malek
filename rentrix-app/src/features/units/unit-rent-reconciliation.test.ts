import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  import.meta.dirname,
  '../../../../supabase/migrations/20260720162500_reconcile_unit_legacy_rent.sql',
);
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

describe('unit legacy rent reconciliation migration', () => {
  it('restores only zero canonical rents from positive legacy defaults', () => {
    expect(sql).toContain('set rent_amount = rent_default');
    expect(sql).toContain('coalesce(rent_amount, 0) = 0');
    expect(sql).toContain('coalesce(rent_default, 0) > 0');
  });

  it('is replay-safe when the legacy column does not exist', () => {
    expect(sql).toContain("column_name = 'rent_amount'");
    expect(sql).toContain("column_name = 'rent_default'");
    expect(sql).toContain('if not (v_has_rent_amount and v_has_rent_default)');
  });

  it('keeps canonical and legacy rent fields synchronized after recovery', () => {
    expect(sql).toContain('sync_unit_rent_fields');
    expect(sql).toContain('before insert or update of rent_amount, rent_default');
    expect(sql).toContain('new.rent_default := new.rent_amount');
    expect(sql).toContain('new.rent_amount := new.rent_default');
    expect(sql).toContain('rent_amount is distinct from rent_default');
  });
});
