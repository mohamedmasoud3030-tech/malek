import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../../../supabase/migrations/20260730091100_unit_archive_history_invariants.sql', import.meta.url),
  'utf8',
).toLowerCase();

describe('unit archive history migration contract', () => {
  it('guards unit soft-archive at the database boundary', () => {
    expect(migration).toContain('create trigger units_archive_guard');
    expect(migration).toContain('before update of deleted_at on public.units');
    expect(migration).toContain('unit with contract history cannot be archived');
    expect(migration).toContain('unit cannot be archived while maintenance is open');
  });

  it('counts all contract history and only live open maintenance', () => {
    expect(migration).toMatch(
      /from public\.contracts c\s+where c\.unit_id::text = new\.id::text\s+and c\.company_id = new\.company_id/,
    );
    expect(migration).toContain("and m.deleted_at is null");
    expect(migration).toContain("in ('open', 'in_progress')");
  });

  it('pins the trigger function search path and removes direct execution', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path to 'public', 'pg_temp'");
    expect(migration).toContain(
      'revoke all on function public.guard_unit_archive_history()',
    );
  });
});
