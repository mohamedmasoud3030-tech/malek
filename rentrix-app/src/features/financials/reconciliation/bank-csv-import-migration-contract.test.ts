import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260805000001_bank_csv_import_hardening.sql');

describe('bank csv import hardening migration contract', () => {
  it('extends imports and lines with fingerprint, batch summary, and atomic RPC with security guards', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    // New columns
    expect(sql).toContain('file_name');
    expect(sql).toContain('file_fingerprint');
    expect(sql).toContain('total_rows');
    expect(sql).toContain('accepted_rows');
    expect(sql).toContain('duplicate_rows');
    expect(sql).toContain('possible_duplicate_rows');
    expect(sql).toContain('error_summary');
    expect(sql).toContain('fingerprint');
    expect(sql).toContain('balance');
    expect(sql).toContain('currency');

    // Idempotency unique index
    expect(sql).toContain('ux_bank_imports_company_fingerprint');
    expect(sql).toContain('ux_bank_lines_company_fingerprint');

    // RPC exists with SECURITY DEFINER and pinned search_path
    expect(sql.toLowerCase()).toContain('create or replace function public.import_bank_statement_batch_atomic');
    expect(sql.toLowerCase()).toContain('security definer');
    expect(sql.toLowerCase()).toContain('set search_path = public, pg_temp');
    expect(sql).toContain('is_app_user()');
    expect(sql).toContain('is_admin_or_manager()');
    expect(sql).toContain('current_company_id()');

    // Grants - case insensitive check
    expect(sql.toLowerCase()).toContain('revoke all on function public.import_bank_statement_batch_atomic(jsonb) from public, anon');
    expect(sql.toLowerCase()).toContain('grant execute on function public.import_bank_statement_batch_atomic(jsonb) to authenticated, service_role');

    // No accounting postings
    expect(sql).not.toContain('journal_entries');
    expect(sql).not.toContain('journal_batches');

    // Company isolation check
    expect(sql).toContain('company_id = v_company_id');
    expect(sql).toContain('Bank account not found or not in your company');

    // Reference generation preserved (existing trigger)
    // Ensure we don't use MAX(...) + 1
    expect(sql).not.toMatch(/MAX\s*\(.*\)\s*\+\s*1/i);
  });
});
