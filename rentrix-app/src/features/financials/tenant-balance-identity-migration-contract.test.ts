import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const migration = readFileSync(
  `${repoRoot}supabase/migrations/20260712020000_fix_tenant_balances_people_fk.sql`,
  'utf8',
).toLowerCase();

describe('tenant balance canonical identity migration', () => {
  it('fails safely when a tenant balance has no matching person', () => {
    expect(migration).toContain('left join public.people p');
    expect(migration).toContain('where p.id is null');
    expect(migration).toContain('manual reconciliation required');
  });

  it('replaces the legacy tenants foreign key with people and preserves history', () => {
    expect(migration).toContain('drop constraint if exists tenant_balances_tenant_fk');
    expect(migration).toContain('add constraint tenant_balances_tenant_id_people_fkey');
    expect(migration).toContain('foreign key (tenant_id) references public.people(id) on delete restrict');
    expect(migration).not.toContain('references public.tenants(id)');
  });

  it('keeps tenant balance lookups indexed', () => {
    expect(migration).toContain('create index if not exists idx_tenant_balances_tenant_id');
  });
});
