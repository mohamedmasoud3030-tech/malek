// Contract test for the R13 race-safe maintenance idempotency.
//
// Locks the rules the R13 forward migration must enforce so a future change
// cannot silently regress the concurrency-safe idempotency contract back to a
// SELECT-then-INSERT race.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSource = readFileSync(
  resolve(__dirname, '../../../../supabase/migrations/20260829000000_r13_financial_truth_hardening.sql'),
  'utf8',
);

describe('R13 create_maintenance_atomic idempotency contract', () => {
  it('uses INSERT ... ON CONFLICT DO NOTHING (never a SELECT-then-INSERT race)', () => {
    expect(migrationSource).toMatch(/on conflict \(company_id, request_id\)\s+where request_id is not null and deleted_at is null/i);
    expect(migrationSource).toMatch(/do nothing/i);
    // The pre-check SELECT-then-return idempotency pattern must be gone.
    expect(migrationSource).not.toMatch(/select \* into v_existing\s+from public\.maintenance_records\s+where request_id = p_request_id/i);
  });

  it('reloads the canonical existing row and returns idempotent=true on conflict', () => {
    expect(migrationSource).toMatch(/if v_record\.id is null then/i);
    expect(migrationSource).toMatch(/'idempotent', true/i);
    expect(migrationSource).toMatch(/return jsonb_build_object\('maintenance', to_jsonb\(v_record\), 'idempotent', false\)/i);
  });

  it('keeps the partial unique index as the atomic gate (never weakens it)', () => {
    expect(migrationSource).not.toMatch(/drop index[^;]*maintenance_records_company_request_id_key/i);
  });

  it('preserves SECURITY DEFINER, pinned search_path, and trusted company context', () => {
    expect(migrationSource).toMatch(/security definer/i);
    expect(migrationSource).toMatch(/set search_path = public, pg_temp/i);
    expect(migrationSource).toMatch(/v_company_id := public\.current_company_id\(\);/i);
    expect(migrationSource).not.toMatch(/p_company_id/);
  });
});
