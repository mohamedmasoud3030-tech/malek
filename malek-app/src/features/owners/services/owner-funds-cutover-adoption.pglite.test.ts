/**
 * G6 closure — governed historical adoption of owner funds (cutover baseline).
 *
 * Real PostgreSQL (PGlite replay of the full migration chain). Every assertion
 * here exercises the DEPLOYED function bodies
 * `create_owner_funds_cutover_atomic` / `approve_owner_funds_cutover_atomic`,
 * not a re-implementation. Rows are forged ONLY to create GL evidence the guard
 * is supposed to detect; the guards themselves are never bypassed.
 *
 * The staleness guard (`OWNER_FUNDS_CUTOVER_STALE_REVIEW_REQUIRED`) had NO test
 * coverage anywhere in the repository before this file.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../../../p1/replay-bootstrap';
import {
  parseOwnerFundsCutoverEvidence,
  parseOwnerFundsCutoverMutation,
} from './owner-funds-cutover-service';

const COMPANY = 'c4000000-0000-4000-8000-000000000001';
const OTHER_COMPANY = 'c4000000-0000-4000-8000-000000000002';
const MAKER = 'c4000000-0000-4000-8000-000000000011';
const CHECKER = 'c4000000-0000-4000-8000-000000000012';
const LOW = 'c4000000-0000-4000-8000-000000000013';
const OTHER_MAKER = 'c4000000-0000-4000-8000-000000000021';
const OTHER_CHECKER = 'c4000000-0000-4000-8000-000000000022';
const CUTOVER_DATE = '2020-01-31';

let db: PGlite;
let companyReviewId = '';
let otherReviewId = '';

async function rpc(name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query<{ value: string }>(
    `select public.${name}($1::jsonb)::text as value`,
    [JSON.stringify(payload)],
  );
  return JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>;
}

async function scalar(sql: string, params: unknown[] = []): Promise<string> {
  const { rows } = await db.query<{ value: string }>(sql, params);
  return String(rows[0]?.value ?? '');
}

async function glBalance(accountNo: string): Promise<string> {
  return scalar(`select public.wp05_gl_balance($1::uuid, $2, $3::date)::text as value`, [
    COMPANY,
    accountNo,
    CUTOVER_DATE,
  ]);
}

async function glLineCount(accountNo: string): Promise<string> {
  return scalar(`select public.wp05_gl_line_count($1::uuid, $2, $3::date)::text as value`, [
    COMPANY,
    accountNo,
    CUTOVER_DATE,
  ]);
}

async function ensurePeriod(company: string, start: string, end: string): Promise<string> {
  const existing = await scalar(
    `select id::text as value from public.accounting_periods
      where company_id = $1::uuid and start_date = $2::date and end_date = $3::date`,
    [company, start, end],
  );
  if (existing) return existing;
  const created = await rpc('create_accounting_period', {
    name: start.slice(0, 7),
    start_date: start,
    end_date: end,
    status: 'OPEN',
  });
  return String(created.id);
}

async function approvedS08Review(
  company: string,
  lineage: string,
  checker: string,
  start = '2020-01-01',
  end: string = CUTOVER_DATE,
): Promise<string> {
  const created = await rpc('s08_create_frozen_review', {
    accounting_period_id: await ensurePeriod(company, start, end),
    dataset_lineage: lineage,
    analysis_version: 'g6-v1',
    evidence_reference: `${lineage} cutover evidence`,
  });
  await db.query(`select public.s08_analyze_frozen_review($1::uuid, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb)`, [
    String(created.id),
  ]);
  const previous = await db.query<{ identity: string }>(
    `select current_setting('request.jwt.claims', true) as identity`,
  );
  void previous;
  await assumeIdentity(db, checker, company);
  await db.query(`select public.s08_approve_frozen_review($1::uuid, $2)`, [
    String(created.id),
    `${lineage} approved`,
  ]);
  return String(created.id);
}

/** Forges a real POSTED GL movement on account 2000 so a guard has evidence to detect. */
async function forgeOwnerFundsMovement(company: string, actor: string, amount: string) {
  const periodId = await ensurePeriod(company, '2020-01-01', CUTOVER_DATE);
  const ownerAccount = await scalar(
    `select id::text as value from public.accounts where company_id = $1::uuid and no = '2000'`,
    [company],
  );
  const cashAccount = await scalar(
    `select id::text as value from public.accounts
       where company_id = $1::uuid and no <> '2000' order by no limit 1`,
    [company],
  );
  if (!ownerAccount || !cashAccount) {
    throw new Error('G6 probe requires provisioned accounts 2000 and one counterpart account.');
  }
  const batchId = await scalar(`select gen_random_uuid()::text as value`);
  await db.query(
    `insert into public.journal_batches
       (id, company_id, status, source_type, source_id, event_id, effective_date,
        accounting_period_id, posted_at, posted_by, description, late_posting, created_by)
     values ($1::uuid, $2::uuid, 'POSTED', 'G6_PROBE', 'g6-probe', 'g6-probe-event', $3::date,
             $4::uuid, now(), $5::uuid, 'G6 staleness probe', false, $5::uuid)`,
    [batchId, company, CUTOVER_DATE, periodId, actor],
  );
  await db.query(
    `insert into public.journal_lines (id, batch_id, company_id, account_id, credit, debit, line_description)
     values ($1, $2::uuid, $3::uuid, $4, $5::numeric, 0, 'G6 probe credit 2000'),
            ($6, $2::uuid, $3::uuid, $7, 0, $5::numeric, 'G6 probe debit cash')`,
    [
      `${batchId}-l1`,
      batchId,
      company,
      ownerAccount,
      amount,
      `${batchId}-l2`,
      cashAccount,
    ],
  );
}

beforeAll(async () => {
  const replay = await createFullReplayedDatabase({ writeEvidence: false });
  expect(replay.failed).toEqual([]);
  db = replay.db;

  await db.exec(`
    insert into public.companies (id, name, slug) values
      ('${COMPANY}', 'G6 Co', 'g6-co'),
      ('${OTHER_COMPANY}', 'G6 Other Co', 'g6-other-co');

    insert into auth.users (id, email, raw_app_meta_data) values
      ('${MAKER}', 'g6-maker@test.local', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${CHECKER}', 'g6-checker@test.local', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${LOW}', 'g6-low@test.local', '{"company_id":"${COMPANY}"}'::jsonb),
      ('${OTHER_MAKER}', 'g6-other-maker@test.local', '{"company_id":"${OTHER_COMPANY}"}'::jsonb),
      ('${OTHER_CHECKER}', 'g6-other-checker@test.local', '{"company_id":"${OTHER_COMPANY}"}'::jsonb);

    insert into public.users (id, email, name, role, status, is_active) values
      ('${MAKER}', 'g6-maker@test.local', 'G6 Maker', 'ADMIN', 'ACTIVE', true),
      ('${CHECKER}', 'g6-checker@test.local', 'G6 Checker', 'ACCOUNTANT', 'ACTIVE', true),
      ('${LOW}', 'g6-low@test.local', 'G6 Low', 'USER', 'ACTIVE', true),
      ('${OTHER_MAKER}', 'g6-other-maker@test.local', 'G6 Other Maker', 'ADMIN', 'ACTIVE', true),
      ('${OTHER_CHECKER}', 'g6-other-checker@test.local', 'G6 Other Checker', 'ACCOUNTANT', 'ACTIVE', true);

    insert into public.company_members (company_id, user_id, role) values
      ('${COMPANY}', '${MAKER}', 'ADMIN'),
      ('${COMPANY}', '${CHECKER}', 'ACCOUNTANT'),
      ('${COMPANY}', '${LOW}', 'USER'),
      ('${OTHER_COMPANY}', '${OTHER_MAKER}', 'ADMIN'),
      ('${OTHER_COMPANY}', '${OTHER_CHECKER}', 'ACCOUNTANT');
  `);

  await assumeIdentity(db, MAKER, COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [COMPANY]);
  companyReviewId = await approvedS08Review(COMPANY, 'g6-company-lineage', CHECKER);

  await assumeIdentity(db, OTHER_MAKER, OTHER_COMPANY);
  await db.query('select public.provision_company_chart_of_accounts($1::uuid)', [OTHER_COMPANY]);
  otherReviewId = await approvedS08Review(OTHER_COMPANY, 'g6-other-lineage', OTHER_CHECKER);
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('owner funds cutover — role and input guards', () => {
  it('refuses draft creation for a user who is neither manager nor accountant', async () => {
    await assumeIdentity(db, LOW, COMPANY);
    await expect(
      rpc('create_owner_funds_cutover_atomic', {
        cutover_date: CUTOVER_DATE,
        s08_review_id: companyReviewId,
        reason: 'low role attempt',
        request_id: 'g6-low-create',
      }),
    ).rejects.toThrow(/OWNER_FUNDS_CUTOVER_ROLE_REQUIRED/);
    await assumeIdentity(db, MAKER, COMPANY);
  });

  it('refuses approval for a user who is neither manager nor accountant', async () => {
    await assumeIdentity(db, LOW, COMPANY);
    await expect(
      rpc('approve_owner_funds_cutover_atomic', { request_id: 'g6-low-approve' }),
    ).rejects.toThrow(/OWNER_FUNDS_CUTOVER_APPROVER_ROLE_REQUIRED/);
    await assumeIdentity(db, MAKER, COMPANY);
  });

  it('rejects a client-supplied company scope and missing governed inputs', async () => {
    await expect(
      rpc('create_owner_funds_cutover_atomic', {
        company_id: COMPANY,
        cutover_date: CUTOVER_DATE,
        s08_review_id: companyReviewId,
        reason: 'client scope attempt',
        request_id: 'g6-scope-attempt',
      }),
    ).rejects.toThrow(/OWNER_FUNDS_CUTOVER_COMPANY_SERVER_DERIVED/);

    await expect(
      rpc('create_owner_funds_cutover_atomic', {
        cutover_date: CUTOVER_DATE,
        s08_review_id: companyReviewId,
        request_id: 'g6-missing-reason',
      }),
    ).rejects.toThrow(/OWNER_FUNDS_CUTOVER_INPUT_REQUIRED/);
  });

  it('refuses adoption without an APPROVED S08 review for the same company', async () => {
    await assumeIdentity(db, MAKER, COMPANY);
    const pending = await rpc('s08_create_frozen_review', {
      accounting_period_id: await ensurePeriod(COMPANY, '2020-02-01', '2020-02-29'),
      dataset_lineage: 'g6-unapproved-lineage',
      analysis_version: 'g6-v1',
      evidence_reference: 'not approved yet',
    });
    await expect(
      rpc('create_owner_funds_cutover_atomic', {
        cutover_date: CUTOVER_DATE,
        s08_review_id: String(pending.id),
        reason: 'unapproved review attempt',
        request_id: 'g6-unapproved-review',
      }),
    ).rejects.toThrow(/OWNER_FUNDS_CUTOVER_S08_APPROVAL_REQUIRED/);

    // A foreign company's APPROVED review must not authorize adoption either.
    await assumeIdentity(db, OTHER_MAKER, OTHER_COMPANY);
    const foreignReview = await approvedS08Review(
      OTHER_COMPANY,
      'g6-foreign-lineage',
      OTHER_CHECKER,
      '2020-04-01',
      '2020-04-30',
    );
    await assumeIdentity(db, MAKER, COMPANY);
    await expect(
      rpc('create_owner_funds_cutover_atomic', {
        cutover_date: CUTOVER_DATE,
        s08_review_id: foreignReview,
        reason: 'foreign review attempt',
        request_id: 'g6-foreign-review',
      }),
    ).rejects.toThrow(/OWNER_FUNDS_CUTOVER_S08_APPROVAL_REQUIRED/);
  });
});

describe('owner funds cutover — derived baseline and maker/checker', () => {
  it('derives the baseline from GL 2000 instead of accepting a client amount', async () => {
    const draft = await rpc('create_owner_funds_cutover_atomic', {
      cutover_date: CUTOVER_DATE,
      s08_review_id: companyReviewId,
      reason: 'G6 governed adoption baseline',
      request_id: 'g6-create-001',
    });
    expect(draft.success).toBe(true);
    expect(draft.idempotent).toBe(false);
    expect(draft.status).toBe('DRAFT');
    expect(Number(draft.opening_balance)).toBe(Number(await glBalance('2000')));
    expect(Number(draft.opening_balance)).toBe(0);

    const row = await scalar(
      `select jsonb_build_object(
          'cutover_date', cutover_date,
          'opening_balance', opening_balance,
          'gl_line_count', gl_line_count,
          'source_fingerprint', source_fingerprint,
          's08_review_id', s08_review_id,
          'status', status,
          'reason', reason,
          'created_by', created_by,
          'approved_by', approved_by,
          'approved_at', approved_at)::text as value
         from public.owner_funds_event_cutovers where company_id = $1::uuid`,
      [COMPANY],
    );
    const persisted = JSON.parse(row) as Record<string, unknown>;
    expect(String(persisted.gl_line_count)).toBe(await glLineCount('2000'));
    expect(Number(persisted.opening_balance)).toBe(Number(await glBalance('2000')));

    // The client-side parser accepts the real deployed row shape.
    const parsed = parseOwnerFundsCutoverEvidence(persisted);
    expect(parsed.status).toBe('DRAFT');
    expect(parsed.openingBalanceOmr).toBe(0);
    expect(parsed.glLineCount).toBe(0);

    // The fingerprint is the documented sha256 over the derived tuple.
    const expectedFingerprint = await scalar(
      `select encode(sha256(convert_to(jsonb_build_object(
          'company_id', $1::uuid,
          'cutover_date', $2::date,
          'opening_balance', public.wp05_round_omr(public.wp05_gl_balance($1::uuid, '2000', $2::date)),
          'gl_line_count', public.wp05_gl_line_count($1::uuid, '2000', $2::date),
          's08_review_id', $3::uuid)::text, 'UTF8')), 'hex') as value`,
      [COMPANY, CUTOVER_DATE, companyReviewId],
    );
    expect(String(persisted.source_fingerprint)).toBe(expectedFingerprint);

    const idempotencyRows = await scalar(
      `select count(*)::text as value from public.financial_operation_idempotency
        where operation_name = $1 and request_id = 'g6-create-001'`,
      [`create_owner_funds_cutover:${COMPANY}`],
    );
    expect(idempotencyRows).toBe('1');
  });

  it('is idempotent on re-create and keeps exactly one baseline row', async () => {
    const again = await rpc('create_owner_funds_cutover_atomic', {
      cutover_date: CUTOVER_DATE,
      s08_review_id: companyReviewId,
      reason: 'duplicate create attempt',
      request_id: 'g6-create-002',
    });
    const parsedAgain = parseOwnerFundsCutoverMutation(again);
    expect(parsedAgain.idempotent).toBe(true);
    expect(parsedAgain.status).toBe('DRAFT');
    expect(
      await scalar(
        `select count(*)::text as value from public.owner_funds_event_cutovers where company_id = $1::uuid`,
        [COMPANY],
      ),
    ).toBe('1');
  });

  it('blocks the maker from approving their own draft', async () => {
    await expect(
      rpc('approve_owner_funds_cutover_atomic', { request_id: 'g6-maker-approve-attempt' }),
    ).rejects.toThrow(/OWNER_FUNDS_CUTOVER_MAKER_CHECKER_REQUIRED/);
  });

  it('lets a different authorized user approve, then stays idempotent', async () => {
    await assumeIdentity(db, CHECKER, COMPANY);
    const approved = await rpc('approve_owner_funds_cutover_atomic', { request_id: 'g6-approve-001' });
    expect(approved.status).toBe('APPROVED');
    expect(approved.idempotent).toBe(false);

    const approvedRow = await scalar(
      `select jsonb_build_object(
          'cutover_date', cutover_date, 'opening_balance', opening_balance, 'gl_line_count', gl_line_count,
          'source_fingerprint', source_fingerprint, 's08_review_id', s08_review_id, 'status', status,
          'reason', reason, 'created_by', created_by, 'approved_by', approved_by, 'approved_at', approved_at)::text
         as value from public.owner_funds_event_cutovers where company_id = $1::uuid`,
      [COMPANY],
    );
    const parsed = parseOwnerFundsCutoverEvidence(JSON.parse(approvedRow));
    expect(parsed.status).toBe('APPROVED');
    expect(parsed.approvedBy).toBe(CHECKER);
    expect(parsed.openingBalanceOmr).toBe(0);

    const replay = await rpc('approve_owner_funds_cutover_atomic', { request_id: 'g6-approve-001' });
    expect(replay.idempotent).toBe(true);

    await expect(
      rpc('approve_owner_funds_cutover_atomic', { request_id: 'g6-approve-002' }),
    ).rejects.toThrow(/OWNER_FUNDS_CUTOVER_ALREADY_APPROVED/);
    await assumeIdentity(db, MAKER, COMPANY);
  });

  it('rejects tampering with a persisted baseline (append-only)', async () => {
    await expect(
      db.query(
        `update public.owner_funds_event_cutovers set opening_balance = 999.999 where company_id = $1::uuid`,
        [COMPANY],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(`delete from public.owner_funds_event_cutovers where company_id = $1::uuid`, [COMPANY]),
    ).rejects.toThrow();
    expect(
      await scalar(
        `select opening_balance::text as value from public.owner_funds_event_cutovers where company_id = $1::uuid`,
        [COMPANY],
      ),
    ).toBe('0.000');
  });
});

describe('owner funds cutover — staleness and company isolation', () => {
  it('fails closed when GL 2000 changed after the draft baseline was derived', async () => {
    await assumeIdentity(db, OTHER_MAKER, OTHER_COMPANY);
    const draft = await rpc('create_owner_funds_cutover_atomic', {
      cutover_date: CUTOVER_DATE,
      s08_review_id: otherReviewId,
      reason: 'G6 staleness baseline',
      request_id: 'g6-other-create-001',
    });
    expect(draft.status).toBe('DRAFT');
    expect(Number(draft.opening_balance)).toBe(0);

    await forgeOwnerFundsMovement(OTHER_COMPANY, OTHER_MAKER, '250.000');

    const drifted = await scalar(
      `select public.wp05_gl_balance($1::uuid, '2000', $2::date)::text as value`,
      [OTHER_COMPANY, CUTOVER_DATE],
    );
    expect(Number(drifted)).toBe(250);

    await assumeIdentity(db, OTHER_CHECKER, OTHER_COMPANY);
    await expect(
      rpc('approve_owner_funds_cutover_atomic', { request_id: 'g6-other-approve-stale' }),
    ).rejects.toThrow(/OWNER_FUNDS_CUTOVER_STALE_REVIEW_REQUIRED/);

    // Nothing was adopted: the row is still a draft with the old fingerprint.
    const state = await scalar(
      `select jsonb_build_object('status', status, 'opening_balance', opening_balance,
                                 'gl_line_count', gl_line_count)::text as value
         from public.owner_funds_event_cutovers where company_id = $1::uuid`,
      [OTHER_COMPANY],
    );
    const parsed = JSON.parse(state) as Record<string, unknown>;
    expect(parsed.status).toBe('DRAFT');
    expect(Number(parsed.opening_balance)).toBe(0);
    expect(Number(parsed.gl_line_count)).toBe(0);
  });

  it('cannot launder a drifted baseline: re-create is idempotent and adopts nothing', async () => {
    await assumeIdentity(db, OTHER_MAKER, OTHER_COMPANY);
    const freshReview = await approvedS08Review(
      OTHER_COMPANY,
      'g6-fresh-lineage',
      OTHER_CHECKER,
      '2020-03-01',
      '2020-03-31',
    );
    await assumeIdentity(db, OTHER_MAKER, OTHER_COMPANY);
    const again = await rpc('create_owner_funds_cutover_atomic', {
      cutover_date: CUTOVER_DATE,
      s08_review_id: freshReview,
      reason: 'attempt to re-baseline over a drifted draft',
      request_id: 'g6-fresh-create-001',
    });
    // Exactly one baseline per company: the RPC returns the EXISTING row,
    // so a drifted draft cannot be overwritten from the application.
    const parsedAgain = parseOwnerFundsCutoverMutation(again);
    expect(parsedAgain.idempotent).toBe(true);
    expect(parsedAgain.status).toBe('DRAFT');
    expect(
      await scalar(
        `select count(*)::text as value from public.owner_funds_event_cutovers where company_id = $1::uuid`,
        [OTHER_COMPANY],
      ),
    ).toBe('1');
    const stored = await scalar(
      `select jsonb_build_object('gl_line_count', gl_line_count, 'opening_balance', opening_balance,
                                 's08_review_id', s08_review_id)::text as value
         from public.owner_funds_event_cutovers where company_id = $1::uuid`,
      [OTHER_COMPANY],
    );
    const row = JSON.parse(stored) as Record<string, unknown>;
    // Stored evidence still reflects the ORIGINAL derivation, never the drifted GL.
    expect(Number(row.gl_line_count)).toBe(0);
    expect(Number(row.opening_balance)).toBe(0);
    expect(String(row.s08_review_id)).toBe(otherReviewId);
  });

  const otherState = async () =>
    scalar(
      `select jsonb_build_object('status', status, 'opening_balance', opening_balance,
                                 'gl_line_count', gl_line_count, 'approved_by', approved_by)::text as value
         from public.owner_funds_event_cutovers where company_id = $1::uuid`,
      [OTHER_COMPANY],
    );

  it('scopes approval to the caller company and leaves another company untouched', async () => {
    const otherBefore = await otherState();
    await assumeIdentity(db, MAKER, COMPANY);
    // COMPANY's own baseline is already approved: the guard fires on COMPANY's row,
    // proving the function never falls through to another company's baseline.
    await expect(
      rpc('approve_owner_funds_cutover_atomic', { request_id: 'g6-cross-company-approve' }),
    ).rejects.toThrow(/OWNER_FUNDS_CUTOVER_ALREADY_APPROVED/);
    expect(await otherState()).toBe(otherBefore);
    expect(
      await scalar(
        `select status as value from public.owner_funds_event_cutovers where company_id = $1::uuid`,
        [COMPANY],
      ),
    ).toBe('APPROVED');
    await assumeIdentity(db, OTHER_MAKER, OTHER_COMPANY);
  });
});
