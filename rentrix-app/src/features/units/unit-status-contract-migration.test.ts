import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationPath = fileURLToPath(
  new URL('../../../../supabase/migrations/20260718163626_pin_normalize_unit_status_contract_search_path.sql', import.meta.url),
);
const normalized = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');

describe('unit status compatibility migration', () => {
  it('captures the live trigger function instead of assuming it already exists', () => {
    expect(normalized).toContain('create or replace function public.normalize_unit_status_contract()');
    expect(normalized).toContain('set search_path = public, pg_temp');
    expect(normalized).toContain("when 'rented' then 'occupied'");
    expect(normalized).toContain('create trigger units_normalize_status_contract');
    expect(normalized).toContain('before insert or update of status on public.units');
  });
});
