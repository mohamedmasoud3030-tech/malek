import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260715000001_restore_live_shape_compatibility.sql',
  ),
  'utf8',
).toLowerCase();

describe('live-shape compatibility migration', () => {
  it('restores only columns already present in the consolidated schema', () => {
    expect(migration).toContain('alter table public.owners');
    expect(migration).toContain("add column if not exists name text not null default ''");
    expect(migration).toContain('alter table public.properties');
    expect(migration).toContain('add column if not exists owner_id uuid');
    expect(migration).toContain('references public.owners(id) on update cascade on delete set null');
    expect(migration).toContain('alter table public.invoices');
    expect(migration).toContain('add column if not exists no text');
  });

  it('does not mutate business rows or weaken security', () => {
    expect(migration).not.toMatch(/^\s*(insert|update|delete|truncate)\b/im);
    expect(migration).not.toContain('disable row level security');
    expect(migration).not.toContain('security definer');
  });
});
