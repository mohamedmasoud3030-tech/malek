/**
 * G5 — post-close accounting correction (S09) and PRESERVATION OF THE ORIGINAL
 * SOURCE.
 *
 * Real PostgreSQL (PGlite replay of the full migration chain). Every assertion
 * exercises the DEPLOYED `s09_create_correction_draft` /
 * `s09_validate_correction` / `s09_apply_correction` bodies, and feeds the
 * unmodified server jsonb through the client parsers, so any drift between the
 * RPC contract and the service fails here.
 *
 * The central claim under test: a correction NEVER rewrites the original
 * posting. The original journal batch keeps its lines and its amount; the
 * correction posts a SEPARATE balanced batch, and both remain visible.
 */
import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { repoRoot, assumeIdentity } from '@/p1/replay-bootstrap';
import { COMPANY, MAKER, PROPERTY, createOfficeCreditorFixture } from '@/test/office-creditor-fixture';
import { offsetFixtureCommand as command, offsetDate as at } from '@/test/owner-offset-fixture';
import {
  S09EvidenceError,
  buildCreateS09DraftPayload,
  parseApplyS09Result,
  parseCreateS09DraftResult,
  parseS09Correction,
  translateS09Error,
} from './s09-correction-service';

let db: PGlite;
let expense: string;
let period: string;
const checker = 'c2000000-0000-4000-8000-000000000097';

async function makeApprovedReview() {
  const row = await command(db, 's08_create_frozen_review', {
    accounting_period_id: period,
    review_scope: { expense_ids: [expense] },
    dataset_lineage: 's09-service',
  });
  await db.query("select public.s08_analyze_frozen_review($1::uuid,'{}','{}','[]')", [row.id]);
  await assumeIdentity(db, checker, COMPANY);
  await db.query('select public.s08_approve_frozen_review($1::uuid,$2)', [
    row.id,
    'Independent review for S09 service tests',
  ]);
  await assumeIdentity(db, MAKER, COMPANY);
  return String(row.id);
}

beforeAll(async () => {
  ({ db } = await createOfficeCreditorFixture({ throughMigration: '20260909000011' }));
  await db.query('insert into auth.users(id,email) values($1::uuid,$2)', [
    checker,
    's09-checker@test.local',
  ]);
  await db.query(
    "insert into public.users(id,email,name,role,status,is_active) values($1::uuid,$2,'S09 checker','ACCOUNTANT','ACTIVE',true)",
    [checker, 's09-checker@test.local'],
  );
  await db.query(
    "insert into public.company_members(company_id,user_id,role) values($1::uuid,$2::uuid,'ACCOUNTANT')",
    [COMPANY, checker],
  );
  await db.exec('set role authenticated');
  expense = String(
    (
      await command(db, 'create_expense_with_journal_atomic', {
        property_id: PROPERTY,
        category: 'صيانة',
        charged_to: 'OWNER',
        amount: 30.125,
        expense_date: at(9),
        request_id: 's09-service-expense',
      })
    ).expense_id,
  );
  period = (
    await db.query<{ id: string }>(
      'select id from public.accounting_periods where company_id=$1::uuid and $2::date between start_date and end_date',
      [COMPANY, at(9)],
    )
  ).rows[0].id;
  await db.exec('reset role');
  await db.exec(
    readFileSync(
      `${repoRoot}/supabase/migrations/20260909000012_owner_expense_allocation_source.sql`,
      'utf8',
    ),
  );
  await db.exec('set role authenticated');
  await assumeIdentity(db, MAKER, COMPANY);
}, 180_000);

afterAll(async () => {
  await db?.close();
});

// Each test runs inside its own transaction and is rolled back. S08 reviews are
// deduplicated by a (company, period, fingerprint) unique index, so without this
// isolation a second test asking for an equivalent review would collide with the
// first test's row rather than exercising its own scenario.
beforeEach(async () => {
  await db.exec('begin');
});
afterEach(async () => {
  await db.exec('rollback');
  await assumeIdentity(db, MAKER, COMPANY);
});

describe('S09 correction chain — real SQL', () => {
  it('runs create → validate → apply and preserves the ORIGINAL posting untouched', async () => {
    const reviewId = await makeApprovedReview();

    // Capture the original expense posting BEFORE any correction.
    const originalBatch = (
      await db.query<{ id: string; total: string; lines: number }>(
        `select b.id::text as id,
                (select sum(l.debit)::text from public.journal_lines l where l.batch_id=b.id) as total,
                (select count(*)::int from public.journal_lines l where l.batch_id=b.id) as lines
           from public.journal_batches b
          where b.source_type='expense' and b.source_id=$1
          limit 1`,
        [expense],
      )
    ).rows[0];
    expect(originalBatch).toBeTruthy();
    expect(Number(originalBatch.total)).toBe(30.125);

    const payload = buildCreateS09DraftPayload({
      reviewId,
      sourceType: 'expense',
      sourceId: expense,
      reason: 'Reclassify approved expense',
      amount: 30.125,
      debitAccountNo: '1300',
      creditAccountNo: '6100',
      requestId: 's09-service-1',
      accountingPeriodId: period,
      originalJournalBatchId: originalBatch.id,
    });
    // The client payload must be accepted verbatim by the deployed function.
    const created = parseCreateS09DraftResult(
      await command(db, 's09_create_correction_draft', payload),
    );
    expect(created.status).toBe('DRAFT');

    await db.query('select public.s09_validate_correction($1::uuid)', [created.id]);

    const applied = parseApplyS09Result(
      (
        await db.query<{ data: Record<string, unknown> }>(
          'select public.s09_apply_correction($1::uuid) as data',
          [created.id],
        )
      ).rows[0].data,
    );
    expect(applied.status).toBe('APPLIED');
    expect(applied.batchId).toBeTruthy();

    // THE ORIGINAL POSTING IS UNCHANGED: same line count, same total.
    const originalAfter = (
      await db.query<{ total: string; lines: number }>(
        `select (select sum(l.debit)::text from public.journal_lines l where l.batch_id=$1::uuid) as total,
                (select count(*)::int from public.journal_lines l where l.batch_id=$1::uuid) as lines`,
        [originalBatch.id],
      )
    ).rows[0];
    expect(Number(originalAfter.total)).toBe(30.125);
    expect(originalAfter.lines).toBe(originalBatch.lines);

    // The correction is a SEPARATE batch, and it is balanced.
    expect(applied.batchId).not.toBe(originalBatch.id);
    const correctionLines = (
      await db.query<{ debit: string; credit: string }>(
        'select sum(debit)::text as debit, sum(credit)::text as credit from public.journal_lines where batch_id=$1::uuid',
        [applied.batchId],
      )
    ).rows[0];
    expect(Number(correctionLines.debit)).toBe(30.125);
    expect(Number(correctionLines.debit)).toBe(Number(correctionLines.credit));

    // The stored row links BOTH batches — lineage is preserved, not replaced.
    const stored = (
      await db.query<{ row: Record<string, unknown> }>(
        'select to_jsonb(c) as row from public.s09_corrections c where id=$1::uuid',
        [created.id],
      )
    ).rows[0].row;
    expect(stored.original_journal_batch_id).toBe(originalBatch.id);
    expect(stored.correction_journal_batch_id).toBe(applied.batchId);

    const parsed = parseS09Correction(stored);
    expect(parsed.status).toBe('APPLIED');
    expect(parsed.correctionBatchId).toBe(applied.batchId);
    expect(parsed.amount).toBe(30.125);
  });

  it('refuses to apply a correction that has not been validated', async () => {
    const reviewId = await makeApprovedReview();
    const created = parseCreateS09DraftResult(
      await command(
        db,
        's09_create_correction_draft',
        buildCreateS09DraftPayload({
          reviewId,
          sourceType: 'expense',
          sourceId: expense,
          reason: 'Attempt to skip validation',
          amount: 5,
          debitAccountNo: '1300',
          creditAccountNo: '6100',
          requestId: 's09-service-skip',
          accountingPeriodId: period,
        }),
      ),
    );
    expect(created.status).toBe('DRAFT');
    await expect(
      db.query('select public.s09_apply_correction($1::uuid)', [created.id]),
    ).rejects.toThrow(/S09_APPLY_STATUS_INVALID/);
  });

  it('is idempotent on create for a repeated request id', async () => {
    const reviewId = await makeApprovedReview();
    const input = {
      reviewId,
      sourceType: 'expense' as const,
      sourceId: expense,
      reason: 'Idempotent draft',
      amount: 7.5,
      debitAccountNo: '1300',
      creditAccountNo: '6100',
      requestId: 's09-service-idem',
      accountingPeriodId: period,
    };
    const first = parseCreateS09DraftResult(
      await command(db, 's09_create_correction_draft', buildCreateS09DraftPayload(input)),
    );
    const second = parseCreateS09DraftResult(
      await command(db, 's09_create_correction_draft', buildCreateS09DraftPayload(input)),
    );
    expect(second.id).toBe(first.id);
    expect(second.idempotent).toBe(true);

    const count = (
      await db.query<{ c: number }>(
        'select count(*)::int as c from public.s09_corrections where request_id=$1',
        ['s09-service-idem'],
      )
    ).rows[0].c;
    expect(count).toBe(1);
  });

  it('refuses a correction anchored to a review that is not APPROVED', async () => {
    const row = await command(db, 's08_create_frozen_review', {
      accounting_period_id: period,
      review_scope: { expense_ids: [expense] },
      dataset_lineage: 's09-service',
    });
    await db.query("select public.s08_analyze_frozen_review($1::uuid,'{}','{}','[]')", [row.id]);
    const created = parseCreateS09DraftResult(
      await command(
        db,
        's09_create_correction_draft',
        buildCreateS09DraftPayload({
          reviewId: String(row.id),
          sourceType: 'expense',
          sourceId: expense,
          reason: 'Unapproved review anchor',
          amount: 3,
          debitAccountNo: '1300',
          creditAccountNo: '6100',
          requestId: 's09-service-unapproved',
          accountingPeriodId: period,
        }),
      ),
    );
    await expect(
      db.query('select public.s09_validate_correction($1::uuid)', [created.id]),
    ).rejects.toThrow(/S09_S08_APPROVAL_REQUIRED/);
  });

  it('refuses an account number that does not exist in the company chart', async () => {
    const reviewId = await makeApprovedReview();
    await expect(
      command(
        db,
        's09_create_correction_draft',
        buildCreateS09DraftPayload({
          reviewId,
          sourceType: 'expense',
          sourceId: expense,
          reason: 'Bad account',
          amount: 3,
          debitAccountNo: '9999',
          creditAccountNo: '6100',
          requestId: 's09-service-badaccount',
          accountingPeriodId: period,
        }),
      ),
    ).rejects.toThrow(/S09_ACCOUNT_NOT_FOUND/);
  });

  it('rejects an identical debit and credit account before reaching the server', () => {
    expect(() =>
      buildCreateS09DraftPayload({
        reviewId: 'r',
        sourceType: 'expense',
        sourceId: 'e',
        reason: 'No-op correction',
        amount: 3,
        debitAccountNo: '1300',
        creditAccountNo: '1300',
        requestId: 'x',
      }),
    ).toThrow(S09EvidenceError);
  });

  it('rejects a sub-baisa correction amount before reaching the server', () => {
    expect(() =>
      buildCreateS09DraftPayload({
        reviewId: 'r',
        sourceType: 'expense',
        sourceId: 'e',
        reason: 'Precision probe',
        amount: 1.00049,
        debitAccountNo: '1300',
        creditAccountNo: '6100',
        requestId: 'x',
      }),
    ).toThrow(/PRECISION|دقة/);
  });

  it('never presents an APPLIED correction that has no posted batch', () => {
    expect(() =>
      parseS09Correction({
        id: 'c1',
        review_id: 'r1',
        source_type: 'expense',
        source_id: 'e1',
        reason: 'x',
        status: 'APPLIED',
        amount: '5.000',
        correction_journal_batch_id: null,
      }),
    ).toThrow(/S09_APPLIED_WITHOUT_BATCH|بلا قيد/);
  });

  it('explains a hard-closed period without suggesting the period be reopened', () => {
    const message = translateS09Error(new Error('S09_PERIOD_HARD_CLOSED: period X'));
    expect(message).toContain('مقفلة نهائياً');
    expect(message).toContain('لا يجوز إعادة فتحها');
  });
});
