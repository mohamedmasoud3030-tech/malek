/**
 * Stage 3 — Chart of Accounts tests (company-scoped, idempotent provisioning,
 * OMR 3-decimal precision, classification validation, deletion protection).
 *
 * Required scenarios 1–6 of the Stage 3 exit gate.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createStage3Database, seedCompaniesAndUsers, actAs, rpc, rpc0, ADMIN_A, COMPANY_A, COMPANY_B, REQUIRED_ACCOUNT_NUMBERS } from './stage3-harness';

let db: PGlite;

beforeAll(async () => {
  const built = await createStage3Database();
  db = built.db;
  await seedCompaniesAndUsers(db);
  await actAs(db, ADMIN_A, COMPANY_A);
});

afterAll(async () => {
  await db?.close();
});

describe('Stage 3 — chart of accounts', () => {
  it('1. two different companies can both use account 1111', async () => {
    await rpc0(db, 'ensure_company_chart_of_accounts');
    await actAs(db, ADMIN_A, COMPANY_B);
    await rpc0(db, 'ensure_company_chart_of_accounts');
    await actAs(db, ADMIN_A, COMPANY_A);

    const { rows } = await db.query(
      `select no, count(*)::int as n, count(distinct company_id)::int as companies
         from public.accounts
        where no = '1111' and company_id in ($1::uuid, $2::uuid)
        group by no`,
      [COMPANY_A, COMPANY_B],
    );
    expect(rows).toHaveLength(1);
    expect((rows[0] as { n: number; companies: number }).n).toBe(2);
    expect((rows[0] as { companies: number }).companies).toBe(2);

    // The composite unique constraint is the database-level guarantee.
    const { rows: cons } = await db.query(
      `select conname from pg_constraint where conname = 'accounts_company_no_key'`
    );
    expect(cons).toHaveLength(1);
    const { rows: global } = await db.query(
      `select conname from pg_constraint where conname = 'accounts_no_key'`
    );
    expect(global).toHaveLength(0);
  });

  it('2. one company cannot create account 1111 twice', async () => {
    await db.exec('BEGIN; SAVEPOINT sp;');
    await expect(
      db.query(
        `insert into public.accounts (id, no, name, company_id) values ('dup-1111', '1111', 'Dup', $1::uuid)`,
        [COMPANY_A],
      ),
    ).rejects.toThrow(/duplicate key/);
    await db.exec('ROLLBACK TO SAVEPOINT sp; ROLLBACK;');
  });

  it('3. required accounts are provisioned idempotently', async () => {
    // Fresh company so the provisioning counts start from zero.
    const COMPANY_C = 'c3000000-0000-4000-8000-000000000003';
    await db.query(`insert into public.companies (id, name, slug) values ($1, 'Stage3 C', 'stage3-c')`, [COMPANY_C]);
    await actAs(db, ADMIN_A, COMPANY_C);

    const first = await rpc0(db, 'ensure_company_chart_of_accounts');
    expect(first.created_count).toBe(18);
    expect(first.existing_count).toBe(0);

    const second = await rpc0(db, 'ensure_company_chart_of_accounts');
    expect(second.created_count).toBe(0);
    expect(second.existing_count).toBe(18);

    // Same deterministic ids on every run.
    const ids = (second.accounts as { account_no: string }[]).map((a) => a.account_no);
    expect(ids).toEqual(REQUIRED_ACCOUNT_NUMBERS);

    const { rows } = await db.query(
      `select no, name from public.accounts where company_id = $1::uuid order by no`,
      [COMPANY_C],
    );
    const nos = (rows as { no: string }[]).map((r) => r.no);
    for (const required of REQUIRED_ACCOUNT_NUMBERS) expect(nos).toContain(required);

    // Customized names are never overwritten by re-provisioning.
    await db.query(
      `update public.accounts set name = 'Custom Cash Name' where no = '1111' and company_id = $1::uuid`,
      [COMPANY_C],
    );
    const third = await rpc0(db, 'ensure_company_chart_of_accounts');
    expect(third.created_count).toBe(0);
    const { rows: nameRows } = await db.query(
      `select name from public.accounts where no = '1111' and company_id = $1::uuid`,
      [COMPANY_C],
    );
    expect((nameRows[0] as { name: string }).name).toBe('Custom Cash Name');

    await actAs(db, ADMIN_A, COMPANY_A);
  });

  it('4. OMR precision is three decimal places', async () => {
    const { rows } = await db.query(
      `select currency_code, precision from public.accounts
        where company_id = $1::uuid and no = '1111'`,
      [COMPANY_A],
    );
    expect(rows[0]).toMatchObject({ currency_code: 'OMR', precision: 3 });

    // OMR accounts with a different precision are rejected by the constraint.
    await db.exec('BEGIN; SAVEPOINT sp;');
    await expect(
      db.query(
        `insert into public.accounts (id, no, name, company_id, currency_code, precision)
         values ('bad-prec', '9999', 'Bad', $1::uuid, 'OMR', 2)`,
        [COMPANY_A],
      ),
    ).rejects.toThrow(/accounts_omr_precision_chk/);
    await db.exec('ROLLBACK TO SAVEPOINT sp; ROLLBACK;');
  });

  it('5. an account used by a posted journal cannot be deleted', async () => {
    const { rows: accounts } = await db.query(
      `select id::text as id from public.accounts where company_id = $1::uuid and no = '6100'`,
      [COMPANY_A],
    );
    const expenseAccountId = (accounts[0] as { id: string }).id;

    await rpc(db, 'create_accounting_period', {
      name: '2026-06', start_date: '2026-06-01', end_date: '2026-06-30',
    });

    const { rows: cashRows } = await db.query(
      `select id::text as id from public.accounts where company_id = $1::uuid and no = '1111'`,
      [COMPANY_A],
    );
    const cashAccountId = (cashRows[0] as { id: string }).id;

    await rpc(db, 'post_journal_event', {
      company_id: COMPANY_A,
      source_type: 'test', source_id: 'del-1', event_id: 'del-1',
      effective_date: '2026-06-10',
      lines: [
        { account_id: cashAccountId, debit: 42.5 },
        { account_id: expenseAccountId, credit: 42.5 },
      ],
    });

    await db.exec('BEGIN; SAVEPOINT sp;');
    await expect(
      db.query(`delete from public.accounts where id = $1`, [expenseAccountId]),
    ).rejects.toThrow(/ACCOUNT_REFERENCED_BY_JOURNAL/);
    await db.exec('ROLLBACK TO SAVEPOINT sp; ROLLBACK;');
  });

  it('6. account classification and normal-balance values are validated', async () => {
    const { rows } = await db.query(
      `select no, account_type, normal_balance from public.accounts
        where company_id = $1::uuid and no in ('1111','2000','4100','6100') order by no`,
      [COMPANY_A],
    );
    const byNo = Object.fromEntries((rows as any[]).map((r) => [r.no, r]));
    expect(byNo['1111']).toMatchObject({ account_type: 'asset', normal_balance: 'debit' });
    expect(byNo['2000']).toMatchObject({ account_type: 'liability', normal_balance: 'credit' });
    expect(byNo['4100']).toMatchObject({ account_type: 'revenue', normal_balance: 'credit' });
    expect(byNo['6100']).toMatchObject({ account_type: 'expense', normal_balance: 'debit' });

    // Invalid classifications are rejected at the database level.
    await db.exec('BEGIN; SAVEPOINT sp;');
    await expect(
      db.query(
        `insert into public.accounts (id, no, name, company_id, account_type, normal_balance)
         values ('bad-cls', '7777', 'Bad', $1::uuid, 'banana', 'sideways')`,
        [COMPANY_A],
      ),
    ).rejects.toThrow(/accounts_account_type_chk/);
    await db.exec('ROLLBACK TO SAVEPOINT sp; ROLLBACK;');
  });
});
