// Contract test for public.create_maintenance_atomic.
//
// Locks the rules the RPC must enforce. If a future migration relaxes any
// of these, the test fails and the regression is caught in CI rather than
// at the customer site.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSource = readFileSync(
  resolve(__dirname, '../../../../supabase/migrations/20260731190947_create_maintenance_atomic_rpc.sql'),
  'utf8',
);

describe('create_maintenance_atomic RPC contract', () => {
  it('is a SECURITY DEFINER function that pins search_path', () => {
    expect(migrationSource).toMatch(/create or replace function public\.create_maintenance_atomic/i);
    expect(migrationSource).toMatch(/security definer/i);
    expect(migrationSource).toMatch(/set search_path to 'public', 'pg_temp'/i);
  });

  it('rejects anonymous callers', () => {
    expect(migrationSource).toMatch(/if auth\.uid\(\) is null then/i);
  });

  it('derives company_id from the trusted current_company_id() helper, never from the payload', () => {
    expect(migrationSource).not.toMatch(/p_company_id/);
    expect(migrationSource).toMatch(/v_company_id := public\.current_company_id\(\);/i);
  });

  it('rejects empty titles after btrim', () => {
    expect(migrationSource).toMatch(/btrim\(coalesce\(p_title, ''\)\)/i);
    expect(migrationSource).toMatch(/if v_title = '' then/i);
  });

  it('validates priority against the canonical enum', () => {
    expect(migrationSource).toMatch(/if v_priority not in \('low', 'medium', 'high', 'urgent'\) then/i);
  });

  it('verifies the property belongs to the active company and is not archived', () => {
    expect(migrationSource).toMatch(/from public\.properties\s+where id = p_property_id\s+and company_id = v_company_id\s+and deleted_at is null/i);
  });

  it('verifies the unit, when provided, belongs to the same property and company', () => {
    expect(migrationSource).toMatch(/from public\.units\s+where id = p_unit_id\s+and property_id = v_property\.id\s+and company_id = v_company_id\s+and deleted_at is null/i);
  });

  it('implements idempotency by request_id within the same company', () => {
    expect(migrationSource).toMatch(/where request_id = p_request_id\s+and company_id = v_company_id\s+and deleted_at is null/i);
    expect(migrationSource).toMatch(/'idempotent', true/i);
  });

  it('appends a matching audit_log entry on every successful insert', () => {
    expect(migrationSource).toMatch(/insert into public\.audit_log/i);
    expect(migrationSource).toMatch(/'maintenance_record', v_record\.id/i);
  });

  it('grants execution to authenticated and service_role only', () => {
    expect(migrationSource).toMatch(/grant execute on function public\.create_maintenance_atomic[\s\S]*?to authenticated/i);
    expect(migrationSource).toMatch(/grant execute on function public\.create_maintenance_atomic[\s\S]*?to service_role/i);
    expect(migrationSource).toMatch(/revoke all on function public\.create_maintenance_atomic[\s\S]*?from public/i);
  });

  it('tightens RLS so raw INSERTs without a matching company_id are rejected', () => {
    expect(migrationSource).toMatch(/drop policy if exists manager_write_maintenance_records/i);
    expect(migrationSource).toMatch(/create policy manager_write_maintenance_records[\s\S]*?company_id = public\.current_company_id\(\)/i);
  });
});
