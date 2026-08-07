/**
 * S02 — Bank CSV import contract + document-reference trigger resilience
 * (isolated PGlite replay, Docker-free).
 *
 * Replays the full migration chain through the two S02 corrective migrations
 * and proves, against real PostgreSQL semantics (RLS roles, SECURITY DEFINER
 * RPCs, triggers), that:
 *
 *   1. public.assign_document_reference() works on bank_statement_imports
 *      (whose row shape has imported_at, NOT created_at) — the historical
 *      42703 `record "new" has no field "created_at"` failure is closed, and
 *      created_at tables (expenses) keep their exact prior behavior.
 *   2. public.import_bank_statement_batch_atomic keeps the deterministic
 *      22023 error contract (zero amount surfaces "Amount must be non-zero at
 *      row %", not the swallowed "Invalid amount ..." variant).
 *   3. Batch + lines are one atomic transaction: any line failure aborts the
 *      whole import — nothing is written (no silent partial success).
 *   4. Idempotent retry by (company_id, file_fingerprint) returns the
 *      existing import; company B isolation holds; cross-company bank
 *      accounts are rejected with 42501.
 *   5. OMR 3-decimal precision is stored, not silently rounded to 2dp.
 *
 * Mirrors the CI pgTAP suites (supabase/tests/bank_csv_import_fail_closed.sql
 * and supabase/tests/document_reference_trigger_regression.sql) so the same
 * contract is locally reproducible without Docker.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase, repoRoot } from '../../../p1/replay-bootstrap';

const COMPANY_A = '00000000-0000-4000-8000-0000000000a1';
const COMPANY_B = '00000000-0000-4000-8000-0000000000b1';
const USER_A = '00000000-0000-0000-0000-00000000a001';
const USER_B = '00000000-0000-0000-0000-00000000b001';
const BANK_A = '00000000-0000-0000-0000-00000000a401';
const BANK_B = '00000000-0000-0000-0000-00000000b401';

const DOC_REF_MIGRATION = '20260805110000_s02_document_reference_trigger_resilience.sql';
const IMPORT_MIGRATION = '20260805120000_s02_bank_csv_import_atomic_contract.sql';
const SERVER_GUARDS_MIGRATION = '20260807160000_s02_bank_csv_import_server_guards.sql';

const stripComments = (t: string) =>
  t.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');

const docRefSql = stripComments(
  readFileSync(join(repoRoot, 'supabase', 'migrations', DOC_REF_MIGRATION), 'utf8').toLowerCase(),
);
const importSql = stripComments(
  readFileSync(join(repoRoot, 'supabase', 'migrations', IMPORT_MIGRATION), 'utf8').toLowerCase(),
);
const serverGuardsSql = stripComments(
  readFileSync(join(repoRoot, 'supabase', 'migrations', SERVER_GUARDS_MIGRATION), 'utf8').toLowerCase(),
);

let db: PGlite;

async function assumeUser(userId: string, companyId: string) {
  const claims = JSON.stringify({
    sub: userId,
    role: 'authenticated',
    app_metadata: { user_role: 'ADMIN', company_id: companyId },
  });
  await db.exec(`select set_config('request.jwt.claims', '${claims}', false);`);
  await db.exec('set role authenticated;');
}

async function resetRole() {
  await db.exec('reset role;');
  await db.exec(`select set_config('request.jwt.claims', '{}', false);`);
}

async function callImport(payload: Record<string, unknown>) {
  const { rows } = await db.query(
    `select public.import_bank_statement_batch_atomic($1::jsonb) as result`,
    [JSON.stringify(payload)],
  );
  return (rows[0] as { result: Record<string, unknown> }).result;
}

async function callImportExpectError(payload: Record<string, unknown>) {
  try {
    await callImport(payload);
  } catch (error) {
    const record = error as Record<string, unknown>;
    return {
      message: String(record?.message ?? error),
      // PGlite surfaces the SQLSTATE on the error fields when available.
      code: typeof record?.code === 'string' ? record.code : '',
    };
  }
  throw new Error('expected import to fail, but it succeeded');
}

beforeAll(async () => {
  const replayed = await createFullReplayedDatabase({});
  db = replayed.db;
  const relevantFailures = replayed.failed.filter((f) =>
    f.file.includes('20260805110000') ||
    f.file.includes('20260805120000') ||
    f.file.includes('20260807160000'),
  );
  expect(relevantFailures, `replay errors: ${JSON.stringify(relevantFailures)}`).toEqual([]);

  await db.query(
    `insert into public.companies (id, name, slug) values
       ($1, 'CSV Company A', 'csv-company-a'),
       ($2, 'CSV Company B', 'csv-company-b')
     on conflict (id) do nothing`,
    [COMPANY_A, COMPANY_B],
  );
  await db.query(
    `insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, '{}'::jsonb), ($3, $4, '{}'::jsonb)
     on conflict (id) do nothing`,
    [USER_A, 'csv-a@test.invalid', USER_B, 'csv-b@test.invalid'],
  );
  await db.query(
    `insert into public.users (id, email, name, role, status, is_active) values
       ($1, 'csv-a@test.invalid', 'CSV A Admin', 'ADMIN', 'ACTIVE', true),
       ($2, 'csv-b@test.invalid', 'CSV B Admin', 'ADMIN', 'ACTIVE', true)
     on conflict (id) do update set role = excluded.role, status = excluded.status, is_active = excluded.is_active`,
    [USER_A, USER_B],
  );
  await db.query(
    `insert into public.company_members (company_id, user_id, role) values
       ($1, $3, 'ADMIN'), ($2, $4, 'ADMIN')
     on conflict (company_id, user_id) do update set role = excluded.role`,
    [COMPANY_A, COMPANY_B, USER_A, USER_B],
  );
  await db.query(
    `insert into public.bank_accounts (id, account_name, currency, company_id) values
       ($1, 'CSV A Bank', 'OMR', $2), ($3, 'CSV B Bank', 'OMR', $4)`,
    [BANK_A, COMPANY_A, BANK_B, COMPANY_B],
  );
});

describe('migration source contracts', () => {
  it('document-reference migration derives optional fields via to_jsonb(NEW)', () => {
    expect(docRefSql).toContain('create or replace function public.assign_document_reference()');
    expect(docRefSql).toContain('to_jsonb(new)');
    expect(docRefSql).toContain("v_row ->> 'created_at'");
    expect(docRefSql).toContain("v_row ->> 'imported_at'");
    expect(docRefSql).toContain('security definer');
    expect(docRefSql).toContain('set search_path = public');
  });

  it('import migration keeps the deterministic zero-amount contract and atomic lines', () => {
    expect(importSql).toContain('create or replace function public.import_bank_statement_batch_atomic(payload jsonb)');
    expect(importSql).toContain('amount must be non-zero at row %');
    // The zero guard must sit OUTSIDE the nested cast handler.
    const zeroGuard = importSql.indexOf('amount must be non-zero at row %');
    const castHandler = importSql.indexOf('invalid amount at row %');
    expect(zeroGuard).toBeGreaterThan(castHandler);
    // No silent line-insert swallow anywhere in the corrected function.
    expect(importSql).not.toContain('exception when others then\n        continue;');
    // OMR 3-decimal storage.
    expect(importSql).toContain('alter column amount type numeric(14,3)');
    expect(importSql).toContain('alter column balance type numeric(14,3)');
    // Grants and search_path preserved.
    expect(importSql).toContain('set search_path = public, pg_temp');
    expect(importSql).toContain(
      'revoke all on function public.import_bank_statement_batch_atomic(jsonb) from public, anon',
    );
    expect(importSql).toContain(
      'grant execute on function public.import_bank_statement_batch_atomic(jsonb) to authenticated, service_role',
    );
    // No accounting postings.
    expect(importSql).not.toContain('journal_entries');
    expect(importSql).not.toContain('journal_batches');
  });

  it('server guard migration enforces limits, OMR-only rows, and ambiguous debit/credit rejection', () => {
    expect(serverGuardsSql).toContain('create or replace function public.import_bank_statement_batch_atomic(payload jsonb)');
    expect(serverGuardsSql).toContain('v_max_file_size integer := 5 * 1024 * 1024');
    expect(serverGuardsSql).toContain('v_max_rows integer := 5000');
    expect(serverGuardsSql).toContain('file_size is required.');
    expect(serverGuardsSql).toContain('row count exceeds % row limit.');
    expect(serverGuardsSql).toContain('rows must not contain both debit and credit at row %');
    expect(serverGuardsSql).toContain('unsupported currency at row %: %');
    expect(serverGuardsSql).toContain('amount must have at most 3 decimals at row %');
    expect(serverGuardsSql).toContain('balance must have at most 3 decimals at row %');
    expect(serverGuardsSql).not.toContain("coalesce(v_row->>'description','حركة مستوردة')");
    expect((serverGuardsSql.match(/if v_description = '' then v_description := 'حركة مستوردة'; end if;/g) ?? []).length).toBe(2);
    expect(serverGuardsSql).toContain('set search_path = public, pg_temp');
    expect(serverGuardsSql).not.toContain('journal_entries');
    expect(serverGuardsSql).not.toContain('journal_batches');
  });

  it('both migrations have manual-rollback files referencing their forward migration', () => {
    const pairs: Array<[string, string]> = [
      ['20260805_rollback_s02_document_reference_trigger_resilience.sql', DOC_REF_MIGRATION],
      ['20260805_rollback_s02_bank_csv_import_atomic_contract.sql', IMPORT_MIGRATION],
      ['20260807_rollback_s02_bank_csv_import_server_guards.sql', SERVER_GUARDS_MIGRATION],
    ];
    for (const [rollback, forward] of pairs) {
      const sql = readFileSync(join(repoRoot, 'supabase', 'rollback', rollback), 'utf8');
      expect(sql, `${rollback} lacks manual-only warning`).toMatch(/manual rollback — not auto-applied/i);
      expect(sql, `${rollback} lacks forward reference`).toContain(`Rollback for: ${forward}`);
    }
  });
});

describe('assign_document_reference trigger resilience', () => {
  it('assigns a BNK reference on bank_statement_imports (no created_at column)', async () => {
    const { rows } = await db.query(
      `insert into public.bank_statement_imports (company_id, bank_account_id, statement_name)
       values ($1, $2, 'manual-check.csv')
       returning id, reference`,
      [COMPANY_A, BANK_A],
    );
    const row = rows[0] as { id: string; reference: string | null };
    expect(row.reference).toMatch(/^BNK-\d{4}-\d{6}$/);
  });

  it('keeps created_at behavior on a created_at table (expenses, no regression)', async () => {
    await db.query(
      `insert into public.properties (id, title, name, type, address, company_id)
       values ('1a000000-0000-4000-8000-00000000000a', 'عقار ألف', 'عقار ألف', 'سكني', 'مسقط', $1)
       on conflict (id) do nothing`,
      [COMPANY_A],
    );
    const { rows } = await db.query(
      `insert into public.expenses (company_id, property_id, category, amount, expense_date)
       values ($1, '1a000000-0000-4000-8000-00000000000a', 'صيانة', 10, '2026-01-05')
       returning reference`,
      [COMPANY_A],
    );
    expect((rows[0] as { reference: string | null }).reference).toMatch(/^EXP-\d{4}-\d{6}$/);
  });
});

describe('import_bank_statement_batch_atomic — deterministic contract (behavioral)', () => {
  it('rejects zero amount with the canonical message and writes nothing', async () => {
    await assumeUser(USER_A, COMPANY_A);
    const error = await callImportExpectError({
      bank_account_id: BANK_A,
      file_fingerprint: 'fp-zero-replay',
      file_size: 1,
      rows: [{ transaction_date: '2026-07-01', amount: '0' }],
    });
    expect(error.message).toContain('Amount must be non-zero at row 1');
    expect(error.message).not.toContain('Invalid amount at row 1');
    if (error.code) expect(error.code).toBe('22023');
    await resetRole();

    const { rows } = await db.query(
      `select count(*)::int as n from public.bank_statement_imports where company_id = $1 and file_fingerprint = 'fp-zero-replay'`,
      [COMPANY_A],
    );
    expect((rows[0] as { n: number }).n).toBe(0);
  });

  it('rejects missing fingerprint, empty rows, invalid date and cross-company accounts', async () => {
    await assumeUser(USER_A, COMPANY_A);

    expect(
      (
        await callImportExpectError({
          bank_account_id: BANK_A,
          rows: [{ transaction_date: '2026-07-01', amount: '10.000' }],
        })
      ).message,
    ).toContain('file_fingerprint is required.');

    expect(
      (
        await callImportExpectError({
          bank_account_id: BANK_A,
          file_fingerprint: 'fp-empty-replay',
          file_size: 1,
          rows: [],
        })
      ).message,
    ).toContain('No rows to import.');

    expect(
      (
        await callImportExpectError({
          bank_account_id: BANK_A,
          file_fingerprint: 'fp-date-replay',
          file_size: 1,
          rows: [{ transaction_date: 'not-a-date', amount: '10.000' }],
        })
      ).message,
    ).toContain('Invalid transaction_date at row 1: not-a-date');

    const cross = await callImportExpectError({
      bank_account_id: BANK_B,
      file_fingerprint: 'fp-x-replay',
      file_size: 1,
      rows: [{ transaction_date: '2026-07-01', amount: '10.000' }],
    });
    expect(cross.message).toContain('Bank account not found or not in your company.');
    if (cross.code) expect(cross.code).toBe('42501');

    await resetRole();
  });

  it('server-side guards reject unsafe import payloads before writing anything', async () => {
    await assumeUser(USER_A, COMPANY_A);

    expect(
      (
        await callImportExpectError({
          bank_account_id: BANK_A,
          file_fingerprint: 'fp-no-size-replay',
          rows: [{ transaction_date: '2026-07-01', amount: '10.000' }],
        })
      ).message,
    ).toContain('file_size is required.');

    expect(
      (
        await callImportExpectError({
          bank_account_id: BANK_A,
          file_fingerprint: 'fp-too-large-replay',
          file_size: 5 * 1024 * 1024 + 1,
          rows: [{ transaction_date: '2026-07-01', amount: '10.000' }],
        })
      ).message,
    ).toContain('file_size exceeds 5242880 byte limit.');

    expect(
      (
        await callImportExpectError({
          bank_account_id: BANK_A,
          file_fingerprint: 'fp-too-many-replay',
          file_size: 5000,
          rows: Array.from({ length: 5001 }, () => ({ transaction_date: '2026-07-01', amount: '10.000' })),
        })
      ).message,
    ).toContain('Row count exceeds 5000 row limit.');

    expect(
      (
        await callImportExpectError({
          bank_account_id: BANK_A,
          file_fingerprint: 'fp-debit-credit-replay',
          file_size: 1,
          rows: [{ transaction_date: '2026-07-01', amount: '10.000', debit: '10.000', credit: '10.000' }],
        })
      ).message,
    ).toContain('Rows must not contain both debit and credit at row 1');

    expect(
      (
        await callImportExpectError({
          bank_account_id: BANK_A,
          file_fingerprint: 'fp-usd-replay',
          file_size: 1,
          rows: [{ transaction_date: '2026-07-01', amount: '10.000', currency: 'USD' }],
        })
      ).message,
    ).toContain('Unsupported currency at row 1: USD');

    expect(
      (
        await callImportExpectError({
          bank_account_id: BANK_A,
          file_fingerprint: 'fp-scale-replay',
          file_size: 1,
          rows: [{ transaction_date: '2026-07-01', amount: '10.0001' }],
        })
      ).message,
    ).toContain('Amount must have at most 3 decimals at row 1');

    await resetRole();

    const { rows } = await db.query(
      `select count(*)::int as n
       from public.bank_statement_imports
       where company_id = $1
         and file_fingerprint like any(array['fp-no-size-replay','fp-too-large-replay','fp-too-many-replay','fp-debit-credit-replay','fp-usd-replay','fp-scale-replay'])`,
      [COMPANY_A],
    );
    expect((rows[0] as { n: number }).n).toBe(0);
  });

  it('imports a valid batch atomically with a document reference, then idempotent retry returns it', async () => {
    await assumeUser(USER_A, COMPANY_A);

    const first = await callImport({
      bank_account_id: BANK_A,
      file_name: 'stmt.csv',
      file_fingerprint: 'fp-valid-replay',
      file_size: 12,
      rows: [
        { transaction_date: '2026-07-01', amount: '100.500', description: 'Rent A', reference: 'REF1' },
        { transaction_date: '2026-07-02', amount: '200.000', description: 'Fee A', reference: 'REF2' },
      ],
    });
    expect(first.total_rows).toBe(2);
    expect(first.accepted_rows).toBe(2);
    expect(first.is_duplicate_file).toBe(false);

    // The inserted batch row proves end-to-end that the reference trigger no
    // longer kills imports (original 42703 kill in the isolated replay).
    const { rows: importRows } = await db.query(
      `select reference from public.bank_statement_imports where id = $1`,
      [first.id],
    );
    expect((importRows[0] as { reference: string | null }).reference).toMatch(/^BNK-\d{4}-\d{6}$/);

    const retry = await callImport({
      bank_account_id: BANK_A,
      file_name: 'stmt.csv',
      file_fingerprint: 'fp-valid-replay',
      file_size: 12,
      rows: [
        { transaction_date: '2026-07-01', amount: '100.500', description: 'Rent A', reference: 'REF1' },
        { transaction_date: '2026-07-02', amount: '200.000', description: 'Fee A', reference: 'REF2' },
      ],
    });
    expect(retry.id).toBe(first.id);
    expect(retry.is_duplicate_file).toBe(true);

    await resetRole();

    const { rows: counts } = await db.query(
      `select
         (select count(*)::int from public.bank_statement_imports where company_id = $1 and file_fingerprint = 'fp-valid-replay' and deleted_at is null) as imports,
         (select count(*)::int from public.bank_statement_lines where company_id = $1) as lines`,
      [COMPANY_A],
    );
    expect((counts[0] as { imports: number; lines: number }).imports).toBe(1);
    expect((counts[0] as { imports: number; lines: number }).lines).toBe(2);
  });

  it('collapses 3dp-equivalent rows into one accepted line and counts the duplicate', async () => {
    await assumeUser(USER_A, COMPANY_A);

    const result = await callImport({
      bank_account_id: BANK_A,
      file_name: '3dp.csv',
      file_fingerprint: 'fp-3dp-replay',
      file_size: 8,
      rows: [
        { transaction_date: '2026-08-01', amount: '100.5', description: 'Three dp', reference: 'R3' },
        { transaction_date: '2026-08-01', amount: '100.500', description: 'Three dp', reference: 'R3' },
      ],
    });
    expect(result.duplicate_rows).toBe(1);
    expect(result.accepted_rows).toBe(1);

    await resetRole();
  });

  it('stores OMR 3-decimal precision without rounding to 2dp', async () => {
    await assumeUser(USER_B, COMPANY_B);
    await callImport({
      bank_account_id: BANK_B,
      file_name: 'b.csv',
      file_fingerprint: 'fp-b-replay',
      file_size: 9,
      rows: [{ transaction_date: '2026-07-10', amount: '50.555', description: 'B line', reference: 'BR1' }],
    });
    await resetRole();

    const { rows } = await db.query(
      `select amount::text as amount from public.bank_statement_lines where company_id = $1`,
      [COMPANY_B],
    );
    expect((rows[0] as { amount: string }).amount).toBe('50.555');
  });

  it('canonicalizes blank descriptions identically for duplicate classification and insertion', async () => {
    await assumeUser(USER_A, COMPANY_A);

    const first = await callImport({
      bank_account_id: BANK_A,
      file_name: 'blank-description-a.csv',
      file_fingerprint: 'fp-blank-description-a',
      file_size: 11,
      rows: [
        { transaction_date: '2026-09-01', amount: '11.000', description: '', reference: ' REF-BLANK ' },
        { transaction_date: '2026-09-02', amount: '12.000', description: '   ', reference: ' REF-SPACE ' },
      ],
    });
    expect(first.accepted_rows).toBe(2);
    expect(first.duplicate_rows).toBe(0);

    await resetRole();

    const { rows: storedRows } = await db.query<{
      transaction_date: string;
      amount: string;
      description: string;
      reference: string;
      currency: string;
      fingerprint: string;
    }>(
      `select transaction_date::text, amount::text, description, reference, currency, fingerprint
       from public.bank_statement_lines
       where company_id = $1
         and transaction_date in ('2026-09-01', '2026-09-02')
       order by transaction_date`,
      [COMPANY_A],
    );

    expect(storedRows).toHaveLength(2);
    for (const row of storedRows) {
      expect(row.description).toBe('حركة مستوردة');
      const expected = await db.query<{ fingerprint: string }>(
        `select md5($1 || '|' || $2 || '|' || $3 || '|' || to_char($4::numeric, 'FM9999999999990.000') || '|' || $5 || '|' || $6 || '|' || lower($7)) as fingerprint`,
        [COMPANY_A, BANK_A, row.transaction_date, row.amount, row.currency, row.reference, row.description],
      );
      expect(row.fingerprint).toBe(expected.rows[0]?.fingerprint);
    }
    expect(storedRows.map((row) => row.reference)).toEqual(['ref-blank', 'ref-space']);

    await assumeUser(USER_A, COMPANY_A);
    const second = await callImport({
      bank_account_id: BANK_A,
      file_name: 'blank-description-b.csv',
      file_fingerprint: 'fp-blank-description-b',
      file_size: 11,
      rows: [
        { transaction_date: '2026-09-01', amount: '11.000', description: '', reference: ' REF-BLANK ' },
        { transaction_date: '2026-09-02', amount: '12.000', description: '   ', reference: ' REF-SPACE ' },
      ],
    });
    expect(second.accepted_rows).toBe(0);
    expect(second.duplicate_rows).toBe(2);
    await resetRole();

    const { rows: counts } = await db.query<{ lines: number; accepted_b: number; duplicate_b: number }>(
      `select
         (select count(*)::int from public.bank_statement_lines where company_id = $1 and transaction_date in ('2026-09-01', '2026-09-02')) as lines,
         (select accepted_rows from public.bank_statement_imports where company_id = $1 and file_fingerprint = 'fp-blank-description-b') as accepted_b,
         (select duplicate_rows from public.bank_statement_imports where company_id = $1 and file_fingerprint = 'fp-blank-description-b') as duplicate_b`,
      [COMPANY_A],
    );
    expect(counts[0]).toEqual({ lines: 2, accepted_b: 0, duplicate_b: 2 });
  });

  it('aborts the whole batch when a line write fails (no silent partial success)', async () => {
    await assumeUser(USER_A, COMPANY_A);

    // Invalid balance string is rejected by the server-side guards; the batch must not survive.
    const error = await callImportExpectError({
      bank_account_id: BANK_A,
      file_name: 'bad-balance.csv',
      file_fingerprint: 'fp-atomic-replay',
      file_size: 10,
      rows: [{ transaction_date: '2026-07-20', amount: '10.000', description: 'bad balance', balance: 'not-a-number' }],
    });
    expect(error.message.length).toBeGreaterThan(0);

    await resetRole();

    const { rows } = await db.query(
      `select
         (select count(*)::int from public.bank_statement_imports where company_id = $1 and file_fingerprint = 'fp-atomic-replay') as imports,
         (select count(*)::int from public.bank_statement_lines where company_id = $1 and import_id in
           (select id from public.bank_statement_imports where company_id = $1 and file_fingerprint = 'fp-atomic-replay')) as lines`,
      [COMPANY_A],
    );
    expect((rows[0] as { imports: number; lines: number }).imports).toBe(0);
    expect((rows[0] as { imports: number; lines: number }).lines).toBe(0);
  });

  it('keeps company B lines invisible to company A under the RLS boundary', async () => {
    await assumeUser(USER_A, COMPANY_A);
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.bank_statement_lines where company_id = $1`,
      [COMPANY_B],
    );
    expect(rows[0]?.n ?? 0).toBe(0);
    await resetRole();
  });
});
