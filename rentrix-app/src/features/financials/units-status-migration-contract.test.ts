import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../../../supabase/migrations/20250101000001_core_schema.sql', import.meta.url),
  'utf8',
);
const functions = readFileSync(
  new URL('../../../../supabase/migrations/20250101000003_functions_triggers_and_rpcs.sql', import.meta.url),
  'utf8',
);

describe('units status baseline contract', () => {
  it('stores only the canonical active unit status values', () => {
    expect(migration).toContain("status text not null default 'available' check (status in ('available', 'occupied', 'maintenance', 'reserved'))");
  });

  it('keeps unit status derived from contracts and maintenance activity', () => {
    expect(functions).toContain('update_unit_status_from_activity');
    expect(functions).toContain('update_unit_status_after_contract_change');
    expect(functions).toContain('update_unit_status_after_maintenance_change');
  });
});
