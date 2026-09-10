/**
 * G5 — cash recovery of an owner receivable, and its EFFECT ON THE ORIGINAL
 * SOURCE.
 *
 * Real PostgreSQL (PGlite replay of the full migration chain). Every assertion
 * exercises the DEPLOYED `public.recover_owner_receivable_atomic` body. The
 * service parsers are fed the unmodified server jsonb, so a drift between the
 * RPC contract and the client parser fails here.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { COMPANY } from '../../../test/office-creditor-fixture';
import {
  createOwnerOffsetFixture,
  offsetFixtureCommand,
  offsetDate,
} from '../../../test/owner-offset-fixture';
import { parseOwnerReceivable } from './owner-receivable-offset-service';
import {
  buildRecoverOwnerReceivablePayload,
  parseOwnerReceivableRecovery,
  parseRecoverOwnerReceivableResult,
} from './owner-receivable-recovery-service';

let db: PGlite;
let receivable: string;

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
}, 180_000);

afterAll(async () => {
  await db?.close();
});

describe('owner receivable cash recovery — real SQL', () => {
  it('posts a recovery and shows the effect on the original source', async () => {
    const before = parseOwnerReceivable(await receivableRow(receivable));
    expect(before.amount).toBe(200);
    expect(before.outstanding).toBe(200);

    const data = await offsetFixtureCommand(db, 'recover_owner_receivable_atomic', {
      due_from_owner_id: receivable,
      amount: 50,
      effective_date: offsetDate(2),
      cash_account_no: '1120',
      request_id: 'g5-recovery-1',
    });

    const result = parseRecoverOwnerReceivableResult(data);
    expect(result.amount).toBe(50);
    expect(result.outstanding).toBe(150);
    expect(result.status).toBe('PARTIALLY_RECOVERED');
    expect(result.journalBatchId).toBeTruthy();

    const after = parseOwnerReceivable(await receivableRow(receivable));
    // THE ORIGINAL IS NOT REWRITTEN.
    expect(after.amount).toBe(before.amount);
    expect(after.recoveredAmount).toBe(50);
    expect(after.outstanding).toBe(150);

    const movements = (
      await db.query<{ row: Record<string, unknown> }>(
        'select to_jsonb(r) as row from public.due_from_owner_recoveries r where due_from_owner_id=$1::uuid',
        [receivable],
      )
    ).rows.map((r) => parseOwnerReceivableRecovery(r.row));
    expect(movements).toHaveLength(1);
    expect(movements[0].amount).toBe(50);
    expect(movements[0].cashAccountNo).toBe('1120');
    expect(movements[0].journalBatchId).toBe(result.journalBatchId);
  });

  it('posts a balanced DR cash / CR 1300 journal', async () => {
    const lines = await db.query<{ no: string; debit: string; credit: string }>(
      `select a.no, l.debit::text, l.credit::text
         from public.journal_lines l
         join public.journal_batches b on b.id = l.batch_id
         join public.accounts a on a.id = l.account_id
        where b.source_type = 'pm_due_from_owner_recovery'
        order by a.no`,
    );
    expect(lines.rows.length).toBe(2);
    const debit = lines.rows.find((r) => Number(r.debit) > 0);
    const credit = lines.rows.find((r) => Number(r.credit) > 0);
    expect(debit?.no).toBe('1120');
    expect(credit?.no).toBe('1300');
    expect(Number(debit?.debit)).toBe(Number(credit?.credit));
  });

  it('is idempotent for a repeated request id and posts no second journal batch', async () => {
    const before = (
      await db.query<{ c: number }>(
        "select count(*)::int as c from public.journal_batches where source_type='pm_due_from_owner_recovery'",
      )
    ).rows[0].c;

    const repeat = await offsetFixtureCommand(db, 'recover_owner_receivable_atomic', {
      due_from_owner_id: receivable,
      amount: 50,
      effective_date: offsetDate(2),
      cash_account_no: '1120',
      request_id: 'g5-recovery-1',
    });
    expect(parseRecoverOwnerReceivableResult(repeat).outstanding).toBe(150);

    const after = (
      await db.query<{ c: number }>(
        "select count(*)::int as c from public.journal_batches where source_type='pm_due_from_owner_recovery'",
      )
    ).rows[0].c;
    expect(after).toBe(before);
    expect(parseOwnerReceivable(await receivableRow(receivable)).outstanding).toBe(150);
  });

  it('rejects a reused request id carrying different figures', async () => {
    await expect(
      offsetFixtureCommand(db, 'recover_owner_receivable_atomic', {
        due_from_owner_id: receivable,
        amount: 75,
        effective_date: offsetDate(2),
        cash_account_no: '1120',
        request_id: 'g5-recovery-1',
      }),
    ).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST/);
  });

  it('refuses to recover more than the outstanding remainder', async () => {
    await expect(
      offsetFixtureCommand(db, 'recover_owner_receivable_atomic', {
        due_from_owner_id: receivable,
        amount: 5000,
        effective_date: offsetDate(3),
        cash_account_no: '1120',
        request_id: 'g5-recovery-over',
      }),
    ).rejects.toThrow(/DUE_FROM_OWNER_RECOVERY_EXCEEDS_OUTSTANDING/);
    expect(parseOwnerReceivable(await receivableRow(receivable)).outstanding).toBe(150);
  });

  it('refuses a cash account outside the permitted pair', async () => {
    await expect(
      offsetFixtureCommand(db, 'recover_owner_receivable_atomic', {
        due_from_owner_id: receivable,
        amount: 5,
        effective_date: offsetDate(3),
        cash_account_no: '4000',
        request_id: 'g5-recovery-badaccount',
      }),
    ).rejects.toThrow(/DUE_FROM_OWNER_RECOVERY_CASH_ACCOUNT_INVALID/);
  });

  it('refuses a client-supplied server-owned field', async () => {
    await expect(
      offsetFixtureCommand(db, 'recover_owner_receivable_atomic', {
        due_from_owner_id: receivable,
        amount: 5,
        effective_date: offsetDate(3),
        cash_account_no: '1120',
        request_id: 'g5-recovery-forbidden',
        company_id: COMPANY,
      }),
    ).rejects.toThrow(/DUE_FROM_OWNER_RECOVERY_SERVER_OWNED_FIELDS_FORBIDDEN/);
  });

  it('closes the receivable as RECOVERED when the remainder reaches zero', async () => {
    const data = await offsetFixtureCommand(db, 'recover_owner_receivable_atomic', {
      due_from_owner_id: receivable,
      amount: 150,
      effective_date: offsetDate(4),
      cash_account_no: '1111',
      request_id: 'g5-recovery-final',
    });
    const result = parseRecoverOwnerReceivableResult(data);
    expect(result.outstanding).toBe(0);
    expect(result.status).toBe('RECOVERED');

    const after = parseOwnerReceivable(await receivableRow(receivable));
    // Original principal still intact even when fully recovered.
    expect(after.amount).toBe(200);
    expect(after.recoveredAmount).toBe(200);
    expect(after.outstanding).toBe(0);
    expect(after.status).toBe('RECOVERED');
  });

  it('rejects a sub-baisa amount before it reaches the server', () => {
    expect(() =>
      buildRecoverOwnerReceivablePayload({
        dueFromOwnerId: receivable,
        amount: 1.00049,
        effectiveDate: offsetDate(5),
        cashAccountNo: '1120',
        requestId: 'g5-recovery-precision',
      }),
    ).toThrow(/PRECISION_VIOLATION|دقة/);
  });
});
