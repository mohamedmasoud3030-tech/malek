import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, assumeIdentity } from '../../../p1/replay-bootstrap';

const COMPANY = 'f6200000-0000-4000-8000-000000000001';
const USER = 'f6200000-0000-4000-8000-000000000002';
const BANK = 'f6200000-0000-4000-8000-000000000003';

let db: PGlite;

function payload(fingerprint: string, rows: Array<Record<string, unknown>>, fileName = 'statement.csv') {
  return JSON.stringify({
    bank_account_id: BANK,
    file_name: fileName,
    file_fingerprint: fingerprint,
    file_size: 128,
    rows,
  }).replace(/'/g, "''");
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug)
    values ('${COMPANY}', 'Bank Import Co', 'bank-import-co');
    insert into auth.users (id, email, raw_app_meta_data)
    values ('${USER}', 'importer@bank.test', '{"company_id":"${COMPANY}"}'::jsonb);
    insert into public.users (id, email, name, role, status, is_active)
    values ('${USER}', 'importer@bank.test', 'Importer', 'ADMIN', 'ACTIVE', true);
    insert into public.company_members (company_id, user_id, role)
    values ('${COMPANY}', '${USER}', 'ADMIN');
    insert into public.company_settings (id, singleton_key, company_name, currency, vat_enabled, vat_rate, company_id)
    values (gen_random_uuid(), true, 'Bank Import Co', 'OMR', false, 0, '${COMPANY}');
    insert into public.bank_accounts (id, company_id, account_name, account_code)
    values ('${BANK}', '${COMPANY}', 'Main Bank', 'BANK-IMPORT');
  `);
  await assumeIdentity(db, USER, COMPANY);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('bank CSV import authoritative transaction', () => {
  it('rolls back the import header when a validated line insert fails', async () => {
    await db.exec(`
      create or replace function public.__test_fail_bank_line_insert()
      returns trigger
      language plpgsql
      as $$
      begin
        if new.description = 'boom-after-preview' then
          raise exception 'TEST_BANK_LINE_INSERT_FAILURE' using errcode = '23514';
        end if;
        return new;
      end;
      $$;
      drop trigger if exists __test_fail_bank_line_insert on public.bank_statement_lines;
      create trigger __test_fail_bank_line_insert
      before insert on public.bank_statement_lines
      for each row execute function public.__test_fail_bank_line_insert();
    `);

    await expect(
      db.query(`select public.import_bank_statement_batch_atomic('${payload('rollback-fp-1', [
        { transaction_date: '2026-08-18', amount: 11.125, description: 'boom-after-preview', reference: 'rb1', currency: 'OMR' },
      ])}'::jsonb)`),
    ).rejects.toThrow(/TEST_BANK_LINE_INSERT_FAILURE/);

    const imports = await db.query(`select count(*)::int as count from public.bank_statement_imports where company_id='${COMPANY}' and file_fingerprint='rollback-fp-1'`);
    const lines = await db.query(`select count(*)::int as count from public.bank_statement_lines where company_id='${COMPANY}' and description='boom-after-preview'`);
    expect(imports.rows[0]).toMatchObject({ count: 0 });
    expect(lines.rows[0]).toMatchObject({ count: 0 });

    await db.exec('drop trigger if exists __test_fail_bank_line_insert on public.bank_statement_lines; drop function if exists public.__test_fail_bank_line_insert();');
  });

  it('prevents duplicate file imports without writing duplicate lines', async () => {
    const request = payload('duplicate-fp-1', [
      { transaction_date: '2026-08-19', amount: 50.001, description: 'first import line', reference: 'dup1', currency: 'OMR' },
    ], 'duplicate.csv');

    const first = await db.query(`select public.import_bank_statement_batch_atomic('${request}'::jsonb) as result`);
    expect(first.rows).toHaveLength(1);

    const second = await db.query<{ result: { is_duplicate_file: boolean; write_attempted: boolean } }>(
      `select public.import_bank_statement_batch_atomic('${request}'::jsonb) as result`,
    );
    expect(second.rows[0]?.result).toMatchObject({ is_duplicate_file: true, write_attempted: false });

    const imports = await db.query(`select count(*)::int as count from public.bank_statement_imports where company_id='${COMPANY}' and file_fingerprint='duplicate-fp-1'`);
    const lines = await db.query(`select count(*)::int as count from public.bank_statement_lines where company_id='${COMPANY}' and description='first import line'`);
    expect(imports.rows[0]).toMatchObject({ count: 1 });
    expect(lines.rows[0]).toMatchObject({ count: 1 });
  });
});
