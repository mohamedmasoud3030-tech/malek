import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260714000003_contract_balances_triggers.sql',
  ),
  'utf8',
).toLowerCase();

describe('contract balance trigger migration identifier contract', () => {
  it('fails closed when contract balance identifier columns drift', () => {
    expect(migration).toContain('contracts.id type % differs from contract_balances.contract_id type %');
    expect(migration).toContain(
      'contracts.tenant_id type % differs from contract_balances.tenant_id type %',
    );
    expect(migration).toContain(
      'contracts.unit_id type % differs from contract_balances.unit_id type %',
    );
  });

  it('uses target-column types for trigger variables instead of fixed text casts', () => {
    expect(migration).toContain(
      'v_contract_id public.contract_balances.contract_id%type',
    );
    expect(migration).toContain(
      'v_tenant_id public.contract_balances.tenant_id%type',
    );
    expect(migration).toContain('v_unit_id public.contract_balances.unit_id%type');
    expect(migration).not.toContain('c.unit_id::text');
    expect(migration).not.toContain('contract_record.unit_id::text');
  });

  it('backfills identifiers without narrowing either supported layout', () => {
    expect(migration).toContain('contract_record.id,');
    expect(migration).toContain('contract_record.tenant_id,');
    expect(migration).toContain('contract_record.unit_id,');
    expect(migration).toContain('on conflict (contract_id) do update set');
  });

  it('keeps trigger helpers private and search-path pinned', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = public, pg_temp');
    expect(migration).toContain(
      'revoke all on function public.update_contract_balance_from_invoice() from public, anon, authenticated',
    );
    expect(migration).toContain(
      'revoke all on function public.update_contract_balance_from_allocation() from public, anon, authenticated',
    );
  });
});
