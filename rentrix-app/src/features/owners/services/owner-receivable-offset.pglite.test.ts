/**
 * G5 closure — lawful offset of an owner receivable, and its EFFECT ON THE
 * ORIGINAL SOURCE.
 *
 * Real PostgreSQL (PGlite replay of the full migration chain). Every assertion
 * exercises the DEPLOYED `public.offset_owner_receivable_atomic` body, never a
 * re-implementation. The service parsers are fed the unmodified server jsonb,
 * so a drift between the RPC contract and the client parser fails here.
 *
 * The task requirement this file discharges: "adjustment/recovery/offset
 * interfaces showing their effect on the original source". The proof is that
 * after an offset the ORIGINAL receivable row still carries its original
 * `amount`, and the movement is visible as `offset_amount` + a reduced
 * `outstanding` + a GL batch — the original is never rewritten.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { COMPANY, MAKER } from '../../../test/office-creditor-fixture';
import {
  createOwnerOffsetFixture,
  offsetFixtureCommand,
  offsetDate,
  OTHER_OFFSET_OWNER,
} from '../../../test/owner-offset-fixture';
import { assumeIdentity } from '../../../p1/replay-bootstrap';
import {
  OwnerReceivableEvidenceError,
  applyOwnerReceivableOffset,
  buildApplyOwnerOffsetPayload,
  parseApplyOwnerOffsetResult,
  parseOwnerReceivable,
  parseOwnerReceivableOffset,
} from './owner-receivable-offset-service';

let db: PGlite;
let receivable: string;
let settlement: string;

async function receivableRow(id: string) {
  return (
    await db.query<{ row: Record<string, unknown> }>(
      'select to_jsonb(d) as row from public.due_from_owners d where id=$1::uuid',
      [id],
    )
  ).rows[0].row;
}

beforeAll(async () => {
  const fixture = await createOwnerOffsetFixture();
  db = fixture.db;
  receivable = fixture.receivable;
  settlement = fixture.settlement;
}, 180_000);

afterAll(async () => {
  await db?.close();
});

describe('owner receivable offset — real SQL', () => {
  it('parses the untouched stored receivable and reports the original amount', async () => {
    const parsed = parseOwnerReceivable(await receivableRow(receivable));
    expect(parsed.amount).toBe(200);
    expect(parsed.outstanding).toBe(200);
    expect(parsed.offsetAmount).toBe(0);
    expect(parsed.status).toBe('OPEN');
    // The right must be a stored boolean; it is never inferred.
    expect(typeof parsed.lawfulOffsetRight).toBe('boolean');
  });

  it('posts a lawful offset and shows the effect on the original source', async () => {
    const before = parseOwnerReceivable(await receivableRow(receivable));

    const data = await offsetFixtureCommand(db, 'offset_owner_receivable_atomic', {
      due_from_owner_id: receivable,
      owner_settlement_id: settlement,
      amount: 25,
      effective_date: offsetDate(2),
      lawful_offset_evidence: 'Contractual offset clause 7',
      request_id: 'g5-offset-1',
    });

    // The real server response must satisfy the client parser unchanged.
    const result = parseApplyOwnerOffsetResult(data);
    expect(result.amount).toBe(25);
    expect(result.outstanding).toBe(175);
    expect(result.status).toBe('OFFSET');
    expect(result.journalBatchId).toBeTruthy();

    const after = parseOwnerReceivable(await receivableRow(receivable));
    // THE ORIGINAL IS NOT REWRITTEN: the principal is untouched.
    expect(after.amount).toBe(before.amount);
    // The effect is expressed as a movement plus a reduced remainder.
    expect(after.offsetAmount).toBe(25);
    expect(after.outstanding).toBe(175);
    expect(after.status).toBe('OFFSET');

    // The movement is independently auditable and carries its GL proof.
    const movements = (
      await db.query<{ row: Record<string, unknown> }>(
        'select to_jsonb(o) as row from public.due_from_owner_offsets o where due_from_owner_id=$1::uuid',
        [receivable],
      )
    ).rows.map((r) => parseOwnerReceivableOffset(r.row));
    expect(movements).toHaveLength(1);
    expect(movements[0].amount).toBe(25);
    expect(movements[0].lawfulOffsetEvidence).toBe('Contractual offset clause 7');
    expect(movements[0].journalBatchId).toBe(result.journalBatchId);
  });

  it('is idempotent for a repeated request id and posts no second journal batch', async () => {
    const batchesBefore = (await db.query('select id from public.journal_batches')).rows.length;

    const repeat = await offsetFixtureCommand(db, 'offset_owner_receivable_atomic', {
      due_from_owner_id: receivable,
      owner_settlement_id: settlement,
      amount: 25,
      effective_date: offsetDate(2),
      lawful_offset_evidence: 'Contractual offset clause 7',
      request_id: 'g5-offset-1',
    });
    const parsed = parseApplyOwnerOffsetResult(repeat);
    expect(parsed.outstanding).toBe(175);

    const batchesAfter = (await db.query('select id from public.journal_batches')).rows.length;
    expect(batchesAfter).toBe(batchesBefore);

    const still = parseOwnerReceivable(await receivableRow(receivable));
    expect(still.offsetAmount).toBe(25);
    expect(still.outstanding).toBe(175);
  });

  it('refuses to offset more than the outstanding remainder', async () => {
    await expect(
      offsetFixtureCommand(db, 'offset_owner_receivable_atomic', {
        due_from_owner_id: receivable,
        owner_settlement_id: settlement,
        amount: 5000,
        effective_date: offsetDate(3),
        lawful_offset_evidence: 'Attempted over-offset',
        request_id: 'g5-offset-over',
      }),
    ).rejects.toThrow(/EXCEEDS_OUTSTANDING|EXCEEDS_PAYABLE/);

    const unchanged = parseOwnerReceivable(await receivableRow(receivable));
    expect(unchanged.outstanding).toBe(175);
  });

  it('refuses a client-supplied server-owned field', async () => {
    await expect(
      offsetFixtureCommand(db, 'offset_owner_receivable_atomic', {
        due_from_owner_id: receivable,
        owner_settlement_id: settlement,
        amount: 5,
        effective_date: offsetDate(4),
        lawful_offset_evidence: 'Forbidden field attempt',
        request_id: 'g5-offset-forbidden',
        company_id: COMPANY,
      }),
    ).rejects.toThrow(/SERVER_OWNED_FIELDS_FORBIDDEN/);
  });

  it('refuses to offset one owner receivable against another owner payable', async () => {
    // Forge an APPROVED settlement belonging to a DIFFERENT owner in the same
    // company. The row is forged only to create the adverse condition the
    // guard is meant to detect; the guard itself is never bypassed.
    const foreignSettlement = 'g5-foreign-settlement';
    // Seed as owner (setup only), then immediately restore the app identity so
    // the RPC below is executed under the ordinary authenticated role.
    await db.exec(
      `reset role;
       insert into public.owner_settlements
         (id, owner_id, company_id, status, gross_collected, office_fee,
          owner_expenses, tax_amount, net_payable, period_start, period_end,
          approved_at, approved_by)
       values ('${foreignSettlement}', '${OTHER_OFFSET_OWNER}', '${COMPANY}',
               'APPROVED', 500, 0, 0, 0, 500, '${offsetDate(1)}', '${offsetDate(28)}',
               now(), '${MAKER}')
       on conflict (id) do nothing;`,
    );
    await assumeIdentity(db, MAKER, COMPANY);
    // Guard the guard: the adverse row must really exist, otherwise this test
    // would pass vacuously.
    const exists = await db.query<{ c: number }>(
      "select count(*)::int as c from public.owner_settlements where id=$1 and status='APPROVED'",
      [foreignSettlement],
    );
    expect(exists.rows[0].c).toBe(1);

    await expect(
      offsetFixtureCommand(db, 'offset_owner_receivable_atomic', {
        due_from_owner_id: receivable,
        owner_settlement_id: foreignSettlement,
        amount: 5,
        effective_date: offsetDate(5),
        lawful_offset_evidence: 'Owner mismatch attempt',
        request_id: 'g5-offset-mismatch',
      }),
    ).rejects.toThrow(/DUE_FROM_OWNER_OFFSET_OWNER_MISMATCH/);

    // The original receivable is untouched by the rejected attempt.
    const after = parseOwnerReceivable(await receivableRow(receivable));
    expect(after.outstanding).toBe(175);
    expect(after.offsetAmount).toBe(25);
  });

  it('fails closed on a contradictory stored row instead of showing a balance', async () => {
    const row = await receivableRow(receivable);
    const tampered = { ...row, outstanding: '999.000' };
    expect(() => parseOwnerReceivable(tampered)).toThrow(OwnerReceivableEvidenceError);
    expect(() => parseOwnerReceivable(tampered)).toThrow(/متناقضة/);
  });

  it('rejects a success response that carries no GL proof', () => {
    expect(() =>
      parseApplyOwnerOffsetResult({
        success: true,
        due_from_owner_id: receivable,
        owner_settlement_id: settlement,
        amount: 25,
        outstanding: 175,
        journal_batch_id: null,
        status: 'OFFSET',
        request_id: 'x',
      }),
    ).toThrow(/OWNER_RECEIVABLE_OFFSET_UNPOSTED|لم تُرحّل/);
  });

  it('rejects a sub-baisa amount before it reaches the server', () => {
    expect(() =>
      buildApplyOwnerOffsetPayload({
        dueFromOwnerId: receivable,
        ownerSettlementId: settlement,
        amount: 1.00049,
        effectiveDate: offsetDate(6),
        lawfulOffsetEvidence: 'Precision probe',
        requestId: 'g5-precision',
      }),
    ).toThrow(/PRECISION_VIOLATION|دقة الريال/);
  });

  it('requires lawful offset evidence of at least three characters', () => {
    expect(() =>
      buildApplyOwnerOffsetPayload({
        dueFromOwnerId: receivable,
        ownerSettlementId: settlement,
        amount: 5,
        effectiveDate: offsetDate(6),
        lawfulOffsetEvidence: 'x',
        requestId: 'g5-evidence',
      }),
    ).toThrow(/سند المقاصة/);
  });

  it('keeps the owner-funds control consistent: no journal batch is ever deleted', async () => {
    const reversals = await db.query(
      "select id from public.journal_batches where source_type='pm_due_from_owner_offset'",
    );
    expect(reversals.rows.length).toBeGreaterThanOrEqual(1);
    // Posted history is append-only: the offset batch is still present.
    const lines = await db.query(
      `select count(*)::int as c from public.journal_lines l
       join public.journal_batches b on b.id=l.batch_id
       where b.source_type='pm_due_from_owner_offset'`,
    );
    expect((lines.rows[0] as { c: number }).c).toBeGreaterThanOrEqual(2);
  });
});
