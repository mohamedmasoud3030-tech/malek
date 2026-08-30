import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '../../../p1/replay-bootstrap';

const COMPANY_A = 'f7200000-0000-4000-8000-000000000001';
const COMPANY_B = 'f7200000-0000-4000-8000-000000000002';
const ADMIN_A = 'f7200000-0000-4000-8000-000000000101';
const MANAGER_A = 'f7200000-0000-4000-8000-000000000102';
const ACCOUNTANT_A = 'f7200000-0000-4000-8000-000000000103';
const OPERATIONS_A = 'f7200000-0000-4000-8000-000000000104';
const VIEWER_A = 'f7200000-0000-4000-8000-000000000105';
const USER_A = 'f7200000-0000-4000-8000-000000000106';
const BANK_A = 'f7200000-0000-4000-8000-000000000201';
const BANK_B = 'f7200000-0000-4000-8000-000000000202';
const FOREIGN_LINE = 'f7200000-0000-4000-8000-000000000301';

let db: PGlite;

async function assume(userId: string, companyId = COMPANY_A) {
  const claims = JSON.stringify({
    sub: userId,
    role: 'authenticated',
    app_metadata: { company_id: companyId },
  });
  await db.query(`select set_config('request.jwt.claims', '${claims}', false)`);
}

async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  await assume(userId);
  await db.query('set role authenticated');
  try {
    return await fn();
  } finally {
    await db.query('reset role');
  }
}

function createSql(description: string, date: string, bankId = BANK_A) {
  return `
    select public.create_bank_statement_line_governed(
      jsonb_build_object(
        'bank_account_id', '${bankId}',
        'transaction_date', '${date}',
        'description', '${description}',
        'amount', 10.000
      )
    )
  `;
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY_A}', 'Bank permission A', 'bank-permission-a'),
      ('${COMPANY_B}', 'Bank permission B', 'bank-permission-b');

    insert into auth.users (id, email) values
      ('${ADMIN_A}', 'admin.bank.permission@test.local'),
      ('${MANAGER_A}', 'manager.bank.permission@test.local'),
      ('${ACCOUNTANT_A}', 'accountant.bank.permission@test.local'),
      ('${OPERATIONS_A}', 'operations.bank.permission@test.local'),
      ('${VIEWER_A}', 'viewer.bank.permission@test.local'),
      ('${USER_A}', 'user.bank.permission@test.local');

    insert into public.users (id, email, name, role, status, is_active) values
      ('${ADMIN_A}', 'admin.bank.permission@test.local', 'Admin', 'ADMIN', 'ACTIVE', true),
      ('${MANAGER_A}', 'manager.bank.permission@test.local', 'Manager', 'MANAGER', 'ACTIVE', true),
      ('${ACCOUNTANT_A}', 'accountant.bank.permission@test.local', 'Accountant', 'ACCOUNTANT', 'ACTIVE', true),
      ('${OPERATIONS_A}', 'operations.bank.permission@test.local', 'Operations', 'OPERATIONS', 'ACTIVE', true),
      ('${VIEWER_A}', 'viewer.bank.permission@test.local', 'Viewer', 'VIEWER', 'ACTIVE', true),
      ('${USER_A}', 'user.bank.permission@test.local', 'User', 'USER', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role, is_active) values
      ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN', true),
      ('${COMPANY_A}', '${MANAGER_A}', 'MANAGER', true),
      ('${COMPANY_A}', '${ACCOUNTANT_A}', 'ACCOUNTANT', true),
      ('${COMPANY_A}', '${OPERATIONS_A}', 'OPERATIONS', true),
      ('${COMPANY_A}', '${VIEWER_A}', 'VIEWER', true),
      ('${COMPANY_A}', '${USER_A}', 'USER', true);

    insert into public.bank_accounts (id, company_id, account_name, account_code) values
      ('${BANK_A}', '${COMPANY_A}', 'Bank A', 'PERM-A'),
      ('${BANK_B}', '${COMPANY_B}', 'Bank B', 'PERM-B');

    insert into public.bank_statement_lines
      (id, company_id, bank_account_id, transaction_date, description, amount, status)
    values
      ('${FOREIGN_LINE}', '${COMPANY_B}', '${BANK_B}', '2026-08-29', 'foreign', 10.000, 'unmatched');
  `);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('bank statement governed writes — effective permission matrix', () => {
  it('allows ADMIN, MANAGER and ACCOUNTANT role defaults', async () => {
    await expect(asUser(ADMIN_A, () => db.query(createSql('admin default', '2026-08-30')))).resolves.toBeTruthy();
    await expect(asUser(MANAGER_A, () => db.query(createSql('manager default', '2026-08-31')))).resolves.toBeTruthy();
    await expect(asUser(ACCOUNTANT_A, () => db.query(createSql('accountant default', '2026-09-01')))).resolves.toBeTruthy();
  });

  it('allows ACCOUNTANT to ignore an unmatched line', async () => {
    const created = await asUser(ACCOUNTANT_A, async () => {
      const { rows } = await db.query<{ id: string }>(`
        select (public.create_bank_statement_line_governed(
          jsonb_build_object(
            'bank_account_id', '${BANK_A}',
            'transaction_date', '2026-09-02',
            'description', 'accountant ignore',
            'amount', 11.000
          )
        ))::jsonb->>'id' as id
      `);
      return rows[0].id;
    });

    const status = await asUser(ACCOUNTANT_A, async () => {
      const { rows } = await db.query<{ status: string }>(`
        select (public.ignore_bank_statement_line_governed('${created}'))::jsonb->>'status' as status
      `);
      return rows[0].status;
    });
    expect(status).toBe('ignored');
  });

  it('denies OPERATIONS, VIEWER and USER by default', async () => {
    for (const [userId, suffix] of [
      [OPERATIONS_A, 'operations'],
      [VIEWER_A, 'viewer'],
      [USER_A, 'user'],
    ] as const) {
      await expect(asUser(userId, () => db.query(createSql(`${suffix} denied`, `2026-09-${suffix === 'operations' ? '03' : suffix === 'viewer' ? '04' : '05'}`))))
        .rejects.toThrow(/financial\.bank_reconciliation\.match/i);
    }
  });

  it('honors exact owner overrides before role defaults', async () => {
    await db.exec(`
      insert into public.user_permission_overrides(company_id,user_id,permission,allowed,set_by,reason,set_at)
      values
        ('${COMPANY_A}','${ACCOUNTANT_A}','financial.bank_reconciliation.match',false,'${ADMIN_A}','test deny',now()),
        ('${COMPANY_A}','${OPERATIONS_A}','financial.bank_reconciliation.match',true,'${ADMIN_A}','test allow',now())
      on conflict(company_id,user_id,permission) do update set
        allowed=excluded.allowed,set_by=excluded.set_by,reason=excluded.reason,set_at=excluded.set_at;
    `);

    await expect(asUser(ACCOUNTANT_A, () => db.query(createSql('accountant override deny', '2026-09-06'))))
      .rejects.toThrow(/financial\.bank_reconciliation\.match/i);

    await expect(asUser(OPERATIONS_A, () => db.query(createSql('operations override allow', '2026-09-07'))))
      .resolves.toBeTruthy();
  });

  it('keeps company isolation even when the permission is allowed', async () => {
    await expect(asUser(MANAGER_A, () => db.query(createSql('foreign bank', '2026-09-08', BANK_B))))
      .rejects.toThrow(/active company/i);

    await expect(asUser(MANAGER_A, () => db.query(`select public.ignore_bank_statement_line_governed('${FOREIGN_LINE}')`)))
      .rejects.toThrow(/not found/i);
  });
});
