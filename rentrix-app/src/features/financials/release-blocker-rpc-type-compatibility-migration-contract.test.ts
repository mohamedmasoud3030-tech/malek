import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260716000004_finalize_release_blocker_rpc_type_compatibility.sql',
  ),
  'utf8',
).toLowerCase();

describe('release-blocker RPC identifier compatibility', () => {
  it('keeps the browser-facing contract RPC signature stable', () => {
    expect(migration).toContain(
      'public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text)',
    );
    expect(migration).toContain('v_property_id public.contracts.property_id%type');
    expect(migration).toContain('v_tenant_id public.contracts.tenant_id%type');
    expect(migration).toContain('v_contract_id public.contracts.id%type');
  });

  it('normalizes contract validation comparisons across uuid and text layouts', () => {
    expect(migration).toContain('person_record.id::text = v_tenant_id::text');
    expect(migration).toContain('property_record.id::text = v_property_id::text');
    expect(migration).toContain('unit_record.property_id::text = v_property_id::text');
    expect(migration).toContain('agreement_record.property_id::text = v_property_id::text');
  });

  it('normalizes payment invoice and contract lookups without changing the JSON facade', () => {
    expect(migration).toContain('public.record_invoice_payment_atomic(payload jsonb)');
    expect(migration).toContain('invoice_record.id::text = v_invoice_id::text');
    expect(migration).toContain("contract_record.id::text = (v_invoice->>'contract_id')");
  });

  it('keeps both privileged RPCs search-path pinned and non-anonymous', () => {
    expect(migration.match(/security definer/g)?.length).toBe(2);
    expect(migration.match(/set search_path to 'public', 'pg_temp'/g)?.length).toBe(2);
    expect(migration).toContain('from public, anon');
  });
});
