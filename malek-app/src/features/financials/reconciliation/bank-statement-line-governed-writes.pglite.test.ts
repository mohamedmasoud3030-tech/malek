import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFullReplayedDatabase } from '../../../p1/replay-bootstrap';

const COMPANY_A = 'f7100000-0000-4000-8000-000000000001';
const COMPANY_B = 'f7100000-0000-4000-8000-000000000002';
const MANAGER_A = 'f7100000-0000-4000-8000-000000000101';
const VIEWER_A = 'f7100000-0000-4000-8000-000000000102';
const BANK_A = 'f7100000-0000-4000-8000-000000000201';
const BANK_B = 'f7100000-0000-4000-8000-000000000202';
const MATCHED_LINE = 'f7100000-0000-4000-8000-000000000301';
const OTHER_COMPANY_LINE = 'f7100000-0000-4000-8000-000000000302';
const MATCHED_RECEIPT = 'f7100000-0000-4000-8000-000000000401';

let db: PGlite;

async function assume(userId: string, companyId: string, role = 'authenticated') {
  const claims = JSON.stringify({
    sub: userId,
    role,
    app_metadata: { company_id: companyId },
  });
  await db.query(`select set_config('request.jwt.claims', '${claims}', false)`);
}

async function asManagerA<T>(fn: () => Promise<T>): Promise<T> {
  await assume(MANAGER_A, COMPANY_A);
  await db.query('set role authenticated');
  try {
    return await fn();
  } finally {
    await db.query('reset role');
  }
}

async function asViewerA<T>(fn: () => Promise<T>): Promise<T> {
  await assume(VIEWER_A, COMPANY_A);
  await db.query('set role authenticated');
  try {
    return await fn();
  } finally {
    await db.query('reset role');
  }
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY_A}', 'ضبط حركات البنك أ', 'bank-line-gov-a'),
      ('${COMPANY_B}', 'ضبط حركات البنك ب', 'bank-line-gov-b');

    insert into auth.users (id, email)
    values
      ('${MANAGER_A}', 'manager.bankline@test.local'),
      ('${VIEWER_A}', 'viewer.bankline@test.local');

    insert into public.users (id, email, name, role, status, is_active) values
      ('${MANAGER_A}', 'manager.bankline@test.local', 'Bank Line Manager', 'MANAGER', 'ACTIVE', true),
      ('${VIEWER_A}', 'viewer.bankline@test.local', 'Bank Line Viewer', 'VIEWER', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role, is_active) values
      ('${COMPANY_A}', '${MANAGER_A}', 'MANAGER', true),
      ('${COMPANY_A}', '${VIEWER_A}', 'VIEWER', true);

    insert into public.bank_accounts (id, company_id, account_name, account_code) values
      ('${BANK_A}', '${COMPANY_A}', 'Main Bank A', 'BLK-A'),
      ('${BANK_B}', '${COMPANY_B}', 'Main Bank B', 'BLK-B');

    insert into public.bank_statement_lines
      (id, company_id, bank_account_id, transaction_date, description, amount, status)
    values
      ('${MATCHED_LINE}', '${COMPANY_A}', '${BANK_A}', '2026-08-20', 'already matched', 75.000, 'matched'),
      ('${OTHER_COMPANY_LINE}', '${COMPANY_B}', '${BANK_B}', '2026-08-20', 'foreign company line', 10.000, 'unmatched');

    -- A real POSTED receipt in company A, so the economic-identity guard
    -- accepts the seeded match on MATCHED_LINE.
    insert into public.receipts (id, company_id, amount, date_time, status, deleted_at)
    values ('${MATCHED_RECEIPT}', '${COMPANY_A}', 75.000, '2026-08-20T10:00:00Z', 'POSTED', null);

    insert into public.bank_reconciliation_matches
      (company_id, statement_line_id, matched_entity_type, matched_entity_id, matched_amount)
    values
      ('${COMPANY_A}', '${MATCHED_LINE}', 'receipt', '${MATCHED_RECEIPT}', 75.000);
  `);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('governed bank statement line browser writes', () => {
  it('still denies the historical direct table write for browser clients (why the governed RPC exists)', async () => {
    await asManagerA(async () => {
      await expect(
        db.query(`
          insert into public.bank_statement_lines
            (company_id, bank_account_id, transaction_date, description, amount, status)
          values
            ('${COMPANY_A}', '${BANK_A}', '2026-08-21', 'direct write', 30.000, 'unmatched')
        `),
      ).rejects.toThrow(/permission denied for table bank_statement_lines/i);
    });
  });

  it('creates a manual line through the governed RPC as MANAGER with status unmatched and a fingerprint', async () => {
    const result = await asManagerA(async () => {
      const { rows } = await db.query<{ line: { status: string; company_id: string; fingerprint: string } }>(`
        select (public.create_bank_statement_line_governed(
          jsonb_build_object(
            'bank_account_id', '${BANK_A}',
            'transaction_date', '2026-08-21',
            'description', 'manual line one',
            'amount', 42.500
          )
        ))::jsonb as line
      `);
      return rows[0];
    });

    expect(result.line.status).toBe('unmatched');
    expect(result.line.company_id).toBe(COMPANY_A);
    expect(result.line.fingerprint).toBeTruthy();
  });

  it('derives the company from the caller context, not the payload', async () => {
    await asManagerA(async () => {
      await expect(
        db.query(`
          select public.create_bank_statement_line_governed(
            jsonb_build_object(
              'bank_account_id', '${BANK_A}',
              'transaction_date', '2026-08-21',
              'description', 'spoofed company',
              'amount', 10.000,
              'company_id', '${COMPANY_B}'
            )
          )
        `),
      ).rejects.toThrow(/BANK_LINE_COMPANY_IS_SERVER_OWNED/i);
    });
  });

  it('rejects a bank account that belongs to another company', async () => {
    await asManagerA(async () => {
      await expect(
        db.query(`
          select public.create_bank_statement_line_governed(
            jsonb_build_object(
              'bank_account_id', '${BANK_B}',
              'transaction_date', '2026-08-21',
              'description', 'cross company',
              'amount', 10.000
            )
          )
        `),
      ).rejects.toThrow(/Bank account was not found in the active company/i);
    });
  });

  it('rejects VIEWER role and invalid amounts', async () => {
    await asViewerA(async () => {
      await expect(
        db.query(`
          select public.create_bank_statement_line_governed(
            jsonb_build_object(
              'bank_account_id', '${BANK_A}',
              'transaction_date', '2026-08-21',
              'description', 'viewer attempt',
              'amount', 10.000
            )
          )
        `),
      ).rejects.toThrow(/ADMIN or MANAGER/i);
    });

    await asManagerA(async () => {
      await expect(
        db.query(`
          select public.create_bank_statement_line_governed(
            jsonb_build_object(
              'bank_account_id', '${BANK_A}',
              'transaction_date', '2026-08-21',
              'description', 'zero amount',
              'amount', 0
            )
          )
        `),
      ).rejects.toThrow(/amount must be non-zero/i);

      await expect(
        db.query(`
          select public.create_bank_statement_line_governed(
            jsonb_build_object(
              'bank_account_id', '${BANK_A}',
              'transaction_date', '2026-08-21',
              'description', 'too precise',
              'amount', 10.1234
            )
          )
        `),
      ).rejects.toThrow(/3-decimal/i);
    });
  });

  it('blocks exact duplicates through the canonical fingerprint', async () => {
    const payload = `
      jsonb_build_object(
        'bank_account_id', '${BANK_A}',
        'transaction_date', '2026-08-22',
        'description', 'duplicate me',
        'amount', 12.000
      )
    `;
    await asManagerA(async () => {
      await expect(db.query(`select public.create_bank_statement_line_governed(${payload})`)).resolves.toBeTruthy();
      await expect(db.query(`select public.create_bank_statement_line_governed(${payload})`)).rejects.toThrow(
        /BANK_LINE_DUPLICATE_FINGERPRINT/i,
      );
    });
  });

  it('ignores an unmatched line as MANAGER and reports the row', async () => {
    const created = await asManagerA(async () => {
      const { rows } = await db.query<{ id: string }>(`
        select (public.create_bank_statement_line_governed(
          jsonb_build_object(
            'bank_account_id', '${BANK_A}',
            'transaction_date', '2026-08-23',
            'description', 'to be ignored',
            'amount', 5.000
          )
        ))::jsonb->>'id' as id
      `);
      return rows[0].id;
    });

    const ignored = await asManagerA(async () => {
      const { rows } = await db.query<{ status: string }>(`
        select (public.ignore_bank_statement_line_governed('${created}'))::jsonb->>'status' as status
      `);
      return rows[0].status;
    });
    expect(ignored).toBe('ignored');

    await asManagerA(async () => {
      await expect(
        db.query(`select public.ignore_bank_statement_line_governed('${created}')`),
      ).rejects.toThrow(/already ignored/i);
    });
  });

  it('refuses to ignore a MATCHED line so a reconciliation match can never be orphaned', async () => {
    await asManagerA(async () => {
      await expect(
        db.query(`select public.ignore_bank_statement_line_governed('${MATCHED_LINE}')`),
      ).rejects.toThrow(/BANK_LINE_MATCHED_CANNOT_BE_IGNORED/i);
    });

    // The match and the matched status are both intact.
    const state = await db.query<{ status: string; matches: string }>(
      `select l.status,
              (select count(*)::text from public.bank_reconciliation_matches m where m.statement_line_id = l.id) as matches
         from public.bank_statement_lines l where l.id = '${MATCHED_LINE}'`,
    );
    expect(state.rows[0].status).toBe('matched');
    expect(state.rows[0].matches).toBe('1');
  });

  it('rejects VIEWER role and cross-company line ids on ignore', async () => {
    await asViewerA(async () => {
      await expect(
        db.query(`select public.ignore_bank_statement_line_governed('${OTHER_COMPANY_LINE}')`),
      ).rejects.toThrow(/ADMIN or MANAGER/i);
    });

    await asManagerA(async () => {
      await expect(
        db.query(`select public.ignore_bank_statement_line_governed('${OTHER_COMPANY_LINE}')`),
      ).rejects.toThrow(/not found/i);
    });
  });

  it('is not executable by anon', async () => {
    const { rows } = await db.query<{ anon_create: boolean; anon_ignore: boolean }>(`
      select
        has_function_privilege('anon', 'public.create_bank_statement_line_governed(jsonb)', 'EXECUTE') as anon_create,
        has_function_privilege('anon', 'public.ignore_bank_statement_line_governed(uuid)', 'EXECUTE') as anon_ignore
    `);
    expect(rows[0].anon_create).toBe(false);
    expect(rows[0].anon_ignore).toBe(false);
  });
});
