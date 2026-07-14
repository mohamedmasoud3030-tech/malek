import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260715000002_purge_production_qa_seed_data.sql',
  ),
  'utf8',
).toLowerCase();

describe('production QA purge identifier compatibility', () => {
  it('normalizes deterministic identifiers before cross-layout comparisons', () => {
    expect(migration).toContain('property_id::text = v_qa_property_id');
    expect(migration).toContain('tenant_id::text = v_qa_tenant_id');
    expect(migration).toContain('invoice_id::text = v_qa_invoice_id');
    expect(migration).toContain('contract_id::text = v_qa_contract_id');
    expect(migration).toContain('owner_id::text = v_qa_owner_id');
  });

  it('keeps the deterministic QA markers and relationship guards', () => {
    expect(migration).toContain('test-qa-prop-001');
    expect(migration).toContain('test-qa-ref-1');
    expect(migration).toContain('test-qa-payment-001');
    expect(migration).toContain('اختبار جاهزية');
    expect(migration).toContain(
      'qa cleanup guard failed: qa-linked rows exist but qa contract graph was not uniquely resolved',
    );
  });

  it('retains narrow deletion behavior and avoids executable truncate statements', () => {
    expect(migration).not.toMatch(/^\s*truncate\b/im);
    expect(migration).toContain('delete from public.financial_operation_idempotency');
    expect(migration).toContain('delete from public.contract_balances');
    expect(migration).toContain('delete from public.properties');
    expect(migration).toContain('delete from public.owners');
  });
});
