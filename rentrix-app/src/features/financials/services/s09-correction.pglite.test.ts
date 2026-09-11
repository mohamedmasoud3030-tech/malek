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
  buildReverseS09Args,
  parseApplyS09Result,
  parseCreateS09DraftResult,
  parseReverseS09Result,
  parseS09Correction,
  parseS09ListEnvelope,
  translateS09Error,
} from './s09-correction-service';

let db: PGlite;
let expense: string;
let period: string;
const checker = 'c2000000-0000-4000-8000-000000000097';
const manager = 'c2000000-0000-4000-8000-000000000096';

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

/** create → validate → apply as MAKER (ADMIN); used by the reversal suite. */
async function createAppliedCorrection(requestId: string) {
  const reviewId = await makeApprovedReview();
  const originalId = await originalExpenseBatchId();
  const created = parseCreateS09DraftResult(
    await command(
      db,
      's09_create_correction_draft',
      buildCreateS09DraftPayload({
        reviewId,
        sourceType: 'expense',
        sourceId: expense,
        reason: 'Reclassify approved expense',
        amount: 30.125,
        debitAccountNo: '1300',
        creditAccountNo: '6100',
        requestId,
        accountingPeriodId: period,
        originalJournalBatchId: originalId,
      }),
    ),
  );
  await db.query('select public.s09_validate_correction($1::uuid)', [created.id]);
  const applied = parseApplyS09Result(
    (
      await db.query<{ data: Record<string, unknown> }>(
        'select public.s09_apply_correction($1::uuid) as data',
        [created.id],
      )
    ).rows[0].data,
  );
  return { created, applied, originalId };
}

/** Full byte-level snapshot of a batch and its lines, for preservation proofs. */
async function batchSnapshot(batchId: string) {
  return (
    await db.query<{ batch: Record<string, unknown>; lines: unknown }>(
      `select to_jsonb(b) as batch,
              coalesce((select jsonb_agg(to_jsonb(l) order by l.no)
                          from public.journal_lines l
                         where l.batch_id = b.id), '[]'::jsonb) as lines
         from public.journal_batches b
        where b.id = $1::uuid`,
      [batchId],
    )
  ).rows[0];
}

async function originalExpenseBatchId() {
  return (
    await db.query<{ id: string }>(
      `select b.id::text as id
         from public.journal_batches b
        where b.source_type = 'expense' and b.source_id = $1
        limit 1`,
      [expense],
    )
  ).rows[0].id;
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
  await db.query('insert into auth.users(id,email) values($1::uuid,$2)', [
    manager,
    's09-manager@test.local',
  ]);
  await db.query(
    "insert into public.users(id,email,name,role,status,is_active) values($1::uuid,$2,'S09 manager','MANAGER','ACTIVE',true)",
    [manager, 's09-manager@test.local'],
  );
  await db.query(
    "insert into public.company_members(company_id,user_id,role) values($1::uuid,$2::uuid,'MANAGER')",
    [COMPANY, manager],
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

describe('S09 reversal — real SQL against the deployed s09_reverse_correction body', () => {
  it('reverses an APPLIED correction with a compensating batch, preserving BOTH the original source and the correction batch', async () => {
    const { created, applied, originalId } = await createAppliedCorrection('s09-service-reverse-1');
    expect(originalId).toBeTruthy();

    // Byte-level snapshots BEFORE the reversal.
    const originalBefore = await batchSnapshot(originalId);
    const correctionBefore = await batchSnapshot(applied.batchId);

    const reversed = parseReverseS09Result(
      (
        await db.query<{ data: Record<string, unknown> }>(
          'select public.s09_reverse_correction($1::uuid,$2::text) as data',
          [created.id, 'Posted to the wrong account pair; reversing for reclassification'],
        )
      ).rows[0].data,
    );
    expect(reversed.status).toBe('REVERSED');
    expect(reversed.id).toBe(created.id);
    expect(reversed.reversalBatchId).toBeTruthy();
    expect(reversed.idempotent).toBe(false);

    // THE ORIGINAL SOURCE POSTING IS BYTE-IDENTICAL: reversal of a correction
    // never touches the posting the correction was about.
    expect(await batchSnapshot(originalId)).toEqual(originalBefore);

    // The correction batch is PRESERVED — same lines, same amounts — only its
    // status flips to REVERSED and it gains the link to its compensating batch.
    const correctionAfter = await batchSnapshot(applied.batchId);
    expect(correctionAfter.lines).toEqual(correctionBefore.lines);
    expect(correctionAfter.batch.status).toBe('REVERSED');
    expect(correctionAfter.batch.reversal_of_batch_id).toBe(reversed.reversalBatchId);
    expect(correctionBefore.batch.status).toBe('POSTED');

    // The compensating batch is separate, POSTED, balanced, equal-and-opposite.
    const reversalRow = (
      await db.query<{ batch: Record<string, unknown>; debit: string; credit: string }>(
        `select to_jsonb(b) as batch,
                (select sum(l.debit)::text from public.journal_lines l where l.batch_id=b.id) as debit,
                (select sum(l.credit)::text from public.journal_lines l where l.batch_id=b.id) as credit
           from public.journal_batches b
          where b.id = $1::uuid`,
        [reversed.reversalBatchId],
      )
    ).rows[0];
    expect(reversalRow.batch.status).toBe('POSTED');
    expect(reversalRow.batch.source_type).toBe('journal_reversal');
    expect(reversalRow.batch.reversal_of_batch_id).toBe(applied.batchId);
    expect(Number(reversalRow.debit)).toBe(30.125);
    expect(Number(reversalRow.debit)).toBe(Number(reversalRow.credit));

    // The stored row keeps the FULL lineage: original + correction + reversal,
    // with the reason recorded as evidence.
    const stored = (
      await db.query<{ row: Record<string, unknown> }>(
        'select to_jsonb(c) as row from public.s09_corrections c where id=$1::uuid',
        [created.id],
      )
    ).rows[0].row;
    expect(stored.status).toBe('REVERSED');
    expect(stored.original_journal_batch_id).toBe(originalId);
    expect(stored.correction_journal_batch_id).toBe(applied.batchId);
    expect(stored.reversal_journal_batch_id).toBe(reversed.reversalBatchId);
    expect(stored.reversed_at).toBeTruthy();
    expect(String(stored.reversal_reason)).toContain('wrong account pair');
    const evidence = stored.after_evidence as Record<string, unknown>;
    expect(evidence.reversal_reason).toBe(stored.reversal_reason);
    expect(evidence.reversal_batch).toBeTruthy();

    // The client parser reads the deployed stored row, including the REVERSED
    // state — and only because the reversal batch proof is present.
    const parsed = parseS09Correction(stored);
    expect(parsed.status).toBe('REVERSED');
    expect(parsed.reversalBatchId).toBe(reversed.reversalBatchId);
    expect(parsed.correctionBatchId).toBe(applied.batchId);
  });

  it('refuses to reverse a correction that is not APPLIED', async () => {
    const reviewId = await makeApprovedReview();
    const created = parseCreateS09DraftResult(
      await command(
        db,
        's09_create_correction_draft',
        buildCreateS09DraftPayload({
          reviewId,
          sourceType: 'expense',
          sourceId: expense,
          reason: 'Reversal attempted too early',
          amount: 4,
          debitAccountNo: '1300',
          creditAccountNo: '6100',
          requestId: 's09-service-reverse-draft',
          accountingPeriodId: period,
        }),
      ),
    );
    await expect(
      db.query('select public.s09_reverse_correction($1::uuid,$2)', [created.id, 'too early']),
    ).rejects.toThrow(/S09_REVERSE_STATUS_INVALID/);
  });

  it('refuses an empty reversal reason on the server and before the request on the client', async () => {
    const { created } = await createAppliedCorrection('s09-service-reverse-noreason');
    await expect(
      db.query('select public.s09_reverse_correction($1::uuid,$2)', [created.id, '   ']),
    ).rejects.toThrow(/S09_REVERSAL_REASON_REQUIRED/);
    // The client builder refuses locally first; the server refusal above is the
    // authority, this is defence in depth.
    expect(() => buildReverseS09Args(created.id, '  ')).toThrow(S09EvidenceError);
    expect(() => buildReverseS09Args('', 'with reason')).toThrow(
      /S09_CORRECTION_ID_REQUIRED|معرّف التصحيح مطلوب/,
    );
  });

  it('lets an ACCOUNTANT reverse, then refuses a second reversal — exactly one compensating batch exists', async () => {
    const { created, applied } = await createAppliedCorrection('s09-service-reverse-twice');
    await assumeIdentity(db, checker, COMPANY);
    const first = parseReverseS09Result(
      (
        await db.query<{ data: Record<string, unknown> }>(
          'select public.s09_reverse_correction($1::uuid,$2::text) as data',
          [created.id, 'First reversal by the accountant'],
        )
      ).rows[0].data,
    );
    expect(first.reversalBatchId).toBeTruthy();
    await assumeIdentity(db, MAKER, COMPANY);
    // The refusal aborts the surrounding transaction in PG; a savepoint keeps
    // the follow-up count query runnable (repo pattern).
    await db.exec('savepoint second_reversal');
    await expect(
      db.query('select public.s09_reverse_correction($1::uuid,$2)', [created.id, 'second attempt']),
    ).rejects.toThrow(/S09_REVERSE_STATUS_INVALID/);
    await db.exec('rollback to savepoint second_reversal');
    const reversalCount = (
      await db.query<{ c: number }>(
        `select count(*)::int as c
           from public.journal_batches
          where source_type='journal_reversal' and reversal_of_batch_id=$1::uuid`,
        [applied.batchId],
      )
    ).rows[0].c;
    expect(reversalCount).toBe(1);
  });

  it('refuses reversal by a MANAGER — the deployed role guard is ACCOUNTANT or ADMIN', async () => {
    const { created } = await createAppliedCorrection('s09-service-reverse-role');
    await assumeIdentity(db, manager, COMPANY);
    await db.exec('savepoint manager_reversal');
    await expect(
      db.query('select public.s09_reverse_correction($1::uuid,$2)', [created.id, 'manager attempt']),
    ).rejects.toThrow(/S09_REVERSE_REQUIRES_ACCOUNTANT/);
    await db.exec('rollback to savepoint manager_reversal');
    await assumeIdentity(db, MAKER, COMPANY);
    // Still APPLIED after the refused attempt — nothing was reversed.
    const status = (
      await db.query<{ status: string }>(
        'select status from public.s09_corrections where id=$1::uuid',
        [created.id],
      )
    ).rows[0].status;
    expect(status).toBe('APPLIED');
  });

  it('parses the deployed list envelope: rows nested under `corrections`, never a bare array', async () => {
    const { created, applied } = await createAppliedCorrection('s09-service-reverse-list');
    await db.query('select public.s09_reverse_correction($1::uuid,$2)', [
      created.id,
      'List envelope proof',
    ]);
    const envelope = (
      await db.query<{ data: Record<string, unknown> }>(
        'select public.s09_list_corrections(null::uuid,null::text) as data',
      )
    ).rows[0].data;
    // Regression lock for the array-only parser defect: the deployed body
    // returns an OBJECT; a parser expecting a bare array fails on every real
    // response.
    expect(Array.isArray(envelope)).toBe(false);
    expect(envelope.company_id).toBe(COMPANY);
    const rows = parseS09ListEnvelope(envelope);
    const reversedRow = rows.find((row) => row.id === created.id);
    expect(reversedRow?.status).toBe('REVERSED');
    expect(reversedRow?.correctionBatchId).toBe(applied.batchId);
    expect(reversedRow?.reversalBatchId).toBeTruthy();
    expect(() => parseS09ListEnvelope(rows)).toThrow(/S09_LIST_RESPONSE_INVALID|غير صالحة/);
    expect(() => parseS09ListEnvelope(null)).toThrow(/S09_LIST_RESPONSE_INVALID|فارغة/);
  });
});

describe('S09 reversal — client parsers (pure)', () => {
  it('rejects a reverse response that cannot prove the compensating batch', () => {
    expect(() =>
      parseReverseS09Result({ success: true, id: 'c1', status: 'REVERSED' }),
    ).toThrow(/S09_REVERSED_WITHOUT_BATCH|قيد العكس/);
    expect(() =>
      parseReverseS09Result({ success: true, id: 'c1', status: 'APPLIED', reversal_batch_id: 'b1' }),
    ).toThrow(/S09_STATUS_UNKNOWN|معكوس/);
    expect(() =>
      parseReverseS09Result({ success: false, id: 'c1', status: 'REVERSED', reversal_batch_id: 'b1' }),
    ).toThrow(/S09_RESPONSE_INVALID|يؤكد/);
    // Contradictory evidence between the top level and the nested
    // reverse_journal_batch envelope is rejected, never smoothed over.
    expect(() =>
      parseReverseS09Result({
        success: true,
        id: 'c1',
        status: 'REVERSED',
        reversal_batch_id: 'b1',
        result: { success: true, idempotent: false, reversal_batch_id: 'DIFFERENT' },
      }),
    ).toThrow(/S09_RESPONSE_CONTRADICTION|متضارب/);
    const accepted = parseReverseS09Result({
      success: true,
      id: 'c1',
      status: 'REVERSED',
      reversal_batch_id: 'b1',
      result: {
        success: true,
        idempotent: true,
        original_batch_id: 'cb1',
        reversal_batch_id: 'b1',
        status: 'REVERSED',
      },
    });
    expect(accepted).toEqual({ id: 'c1', status: 'REVERSED', reversalBatchId: 'b1', idempotent: true });
  });

  it('never presents a REVERSED correction that has no posted reversal batch', () => {
    expect(() =>
      parseS09Correction({
        id: 'c1',
        review_id: 'r1',
        source_type: 'expense',
        source_id: 'e1',
        reason: 'x',
        status: 'REVERSED',
        amount: '5.000',
        correction_batch_id: 'b1',
        reversal_batch_id: null,
      }),
    ).toThrow(/S09_REVERSED_WITHOUT_BATCH|بلا قيد عكس/);
  });

  it('translates the reversal refusals without softening them', () => {
    expect(
      translateS09Error(
        new Error('S09_REVERSE_STATUS_INVALID: only APPLIED can be REVERSED, current DRAFT'),
      ),
    ).toContain('مُطبَّق');
    expect(translateS09Error(new Error('S09_REVERSE_REQUIRES_ACCOUNTANT'))).toContain(
      'محاسب أو مدير نظام',
    );
    expect(
      translateS09Error(new Error('S09_REVERSAL_REASON_REQUIRED: non-empty reason required')),
    ).toContain('سبب العكس مطلوب');
    expect(
      translateS09Error(new Error('S09_REVERSE_NO_BATCH: correction has no journal batch')),
    ).toContain('لا يحمل قيداً مرحَّلاً');
  });
});
