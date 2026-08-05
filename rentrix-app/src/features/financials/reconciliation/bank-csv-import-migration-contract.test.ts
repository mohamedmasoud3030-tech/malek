import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const legacyMigrationPath = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260805000001_bank_csv_import_hardening.sql');
const s02MigrationPath = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260805001000_s02_bank_csv_fail_closed_authoritative_import.sql');

describe('bank csv import hardening migration contract', () => {
  it('extends imports and lines with fingerprint, batch summary, and atomic RPC with security guards', async () => {
    const sql = `${await readFile(legacyMigrationPath, 'utf8')}\n${await readFile(s02MigrationPath, 'utf8')}`;

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

    expect(sql).toContain('ux_bank_imports_company_fingerprint');
    expect(sql).toContain('ux_bank_lines_company_fingerprint');

    expect(sql.toLowerCase()).toContain('create or replace function public.import_bank_statement_batch_atomic');
    expect(sql.toLowerCase()).toContain('security definer');
    expect(sql.toLowerCase()).toContain('set search_path = public, pg_temp');
    expect(sql).toContain('is_app_user()');
    expect(sql).toContain('is_admin_or_manager()');
    expect(sql).toContain('current_company_id()');

    expect(sql.toLowerCase()).toContain('revoke all on function public.import_bank_statement_batch_atomic(jsonb) from public, anon');
    expect(sql.toLowerCase()).toContain('grant execute on function public.import_bank_statement_batch_atomic(jsonb) to authenticated, service_role');

    expect(sql).not.toContain('journal_entries');
    expect(sql).not.toContain('journal_batches');

    expect(sql).toContain('company_id = v_company_id');
    expect(sql).toContain('Bank account not found or not in your company');
    expect(sql).not.toMatch(/MAX\s*\(.*\)\s*\+\s*1/i);
  });

  it('documents fail-closed authoritative server validation and atomic write boundary', async () => {
    const sql = await readFile(s02MigrationPath, 'utf8');

    expect(sql).toContain('Validation pass: collect every row error and compute canonical identity before any write');
    expect(sql).toContain('jsonb_array_length(v_errors) > 0');
    expect(sql).toContain('Bank CSV import rejected fail-closed');
    expect(sql).toContain('accepted_rows, rejected_rows, duplicate_rows');
    expect(sql).toContain('v_total, v_total, 0, 0');
    expect(sql).toContain('insert into public.bank_statement_imports');
    expect(sql).toContain('insert into public.bank_statement_lines');
    expect(sql).not.toContain('exception when others then\n        continue');
    expect(sql).not.toContain('on conflict (company_id, fingerprint) where fingerprint is not null and deleted_at is null do nothing');
  });

  it('has deterministic idempotency scoped by company and bank account', async () => {
    const sql = await readFile(s02MigrationPath, 'utf8');

    expect(sql).toContain('bank-import-v1|');
    expect(sql).toContain('bank-line-v1|');
    expect(sql).toContain('v_company_id::text');
    expect(sql).toContain('v_bank_account_id::text');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('is_duplicate_file');
    expect(sql.indexOf('select * into v_existing_import')).toBeLessThan(sql.indexOf('exact_duplicate_existing_line'));
    expect(sql).not.toContain('random()');
    expect(sql).not.toContain('gen_random_uuid()');
    expect(sql).not.toMatch(/now\(\).*file_fingerprint/i);
  });

  it('enforces server-side file, row, text and OMR precision limits', async () => {
    const sql = await readFile(s02MigrationPath, 'utf8');

    expect(sql).toContain('c_max_file_size integer := 5 * 1024 * 1024');
    expect(sql).toContain('c_max_rows integer := 10000');
    expect(sql).toContain('c_max_text_length integer := 512');
    expect(sql).toContain('file_size exceeds server limit');
    expect(sql).toContain('row count % exceeds server limit %');
    expect(sql).toContain('v_amount <> round(v_amount, 3)');
    expect(sql).toContain("v_currency <> 'OMR'");
    expect(sql).toContain('exact_duplicate_in_file');
    expect(sql).toContain('exact_duplicate_existing_line');
  });

  it('treats same-date/same-amount as possible duplicate, not deletion criteria', async () => {
    const sql = await readFile(s02MigrationPath, 'utf8');

    expect(sql).toContain('v_possible := v_possible + 1');
    expect(sql).toContain('and transaction_date = v_transaction_date');
    expect(sql).toContain('and amount = v_amount');
    expect(sql).toContain('and fingerprint <> v_row_fingerprint');
    expect(sql).toContain('possible_duplicate_rows');
    expect(sql).not.toContain('delete from public.bank_statement_lines');
  });
});
