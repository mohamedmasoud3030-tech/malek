import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../../../supabase/migrations/20260730091200_contract_workflow_invariants.sql', import.meta.url),
  'utf8',
).toLowerCase();

describe('contract workflow invariants migration contract', () => {
  it('protects direct contract writes at the database boundary', () => {
    expect(migration).toContain('create trigger contracts_workflow_invariants');
    expect(migration).toContain('contract property must be live, company-owned');
    expect(migration).toContain('contract unit must belong to the selected property and company');
    expect(migration).toContain('contract tenant must be a live tenant in the same company');
    expect(migration).toContain('operational contract requires a covering agreement');
  });

  it('scopes contract update lookup, write, and response to the caller company', () => {
    expect(migration).toContain('create or replace function public.update_contract_atomic');
    expect(migration).toMatch(
      /from public\.contracts\s+where id::text = p_contract_id\s+and company_id = v_company_id/,
    );
    expect(migration).toMatch(
      /where contract_record\.id::text = p_contract_id\s+and contract_record\.company_id = v_company_id\s+and contract_record\.deleted_at is null\s+returning/,
    );
    expect(migration).toContain('return v_result');
  });

  it('pins security-definer paths and removes public execution', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path to 'public', 'pg_temp'");
    expect(migration).toContain(
      'revoke all on function public.enforce_contract_workflow_invariants() from public, anon, authenticated',
    );
    expect(migration).toContain(
      'revoke all on function public.update_contract_atomic',
    );
  });
});
