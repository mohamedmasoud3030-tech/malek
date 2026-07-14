import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const coreSchema = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20250101000001_core_schema.sql'),
  'utf8',
).toLowerCase();
const capturedTenantBalances = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260705000002_baseline_capture_untracked_tables_batch_a.sql',
  ),
  'utf8',
).toLowerCase();
const migration = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260712020000_fix_tenant_balances_people_fk.sql',
  ),
  'utf8',
).toLowerCase();

describe('tenant balance canonical identity migration', () => {
  it('documents the clean-replay mismatch that the migration must reconcile', () => {
    expect(coreSchema).toContain('create table public.people (');
    expect(coreSchema).toContain('id uuid primary key default gen_random_uuid()');
    expect(capturedTenantBalances).toContain('create table if not exists public.tenant_balances (');
    expect(capturedTenantBalances).toContain('tenant_id text not null primary key');
  });

  it('derives and validates both supported identifier layouts', () => {
    expect(migration).toContain("v_people_id_type not in ('uuid', 'text')");
    expect(migration).toContain("v_tenant_id_type not in ('uuid', 'text')");
    expect(migration).toContain('unsupported public.people(id) type %');
    expect(migration).toContain('unsupported public.tenant_balances(tenant_id) type %');
  });

  it('fails safely when a tenant balance has no matching person', () => {
    expect(migration).toContain('left join public.people as person');
    expect(migration).toContain('where person.id is null');
    expect(migration).toContain('manual reconciliation required');
  });

  it('normalizes tenant_id to the canonical people identifier type before adding the foreign key', () => {
    expect(migration).toContain("v_tenant_id_type = 'text' and v_people_id_type = 'uuid'");
    expect(migration).toContain(
      'alter table public.tenant_balances alter column tenant_id type uuid using tenant_id::uuid',
    );
    expect(migration).toContain("v_tenant_id_type = 'uuid' and v_people_id_type = 'text'");
    expect(migration).toContain(
      'alter table public.tenant_balances alter column tenant_id type text using tenant_id::text',
    );
    expect(migration).toContain('v_resulting_tenant_id_type <> v_people_id_type');
  });

  it('replaces the legacy tenant constraint with people and preserves history', () => {
    expect(migration).toContain('drop constraint if exists tenant_balances_tenant_fk');
    expect(migration).toContain(
      'drop constraint if exists tenant_balances_tenant_id_people_fkey',
    );
    expect(migration).toContain('add constraint tenant_balances_tenant_id_people_fkey');
    expect(migration).toContain(
      'foreign key (tenant_id) references public.people(id) on delete restrict',
    );
    expect(migration).not.toContain('foreign key (tenant_id) references public.tenants(id)');
  });

  it('keeps tenant balance lookups indexed', () => {
    expect(migration).toContain('create index if not exists idx_tenant_balances_tenant_id');
  });
});
