import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../p1/replay-bootstrap';
import {
  ADMIN_A,
  COMPANY_A,
  CONTRACT_A,
  INVOICE_A1,
  queryOne,
  rpcJsonb,
  seedPhase3a1bFixture,
} from '../p3/phase3a1b-fixture';

const RECEIPT_ID = '53a30000-0000-4000-8000-000000000001';
const REQUEST_ID = 's03-receipt-engine-1';

let db: PGlite;

async function accountId(no: string) {
  const row = await queryOne(
    db,
    `select id from public.accounts where company_id = $1::uuid and no = $2`,
    [COMPANY_A, no],
  );
  return String(row?.id ?? '');
}

describe('Stage 3 — first live receipt/payment business posting', () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;
    await seedPhase3a1bFixture(db);
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it('boots the first OPEN period and posts one canonical non-compat receipt batch', async () => {
    const cash = await accountId('1111');
    const receivable = await accountId('1201');
    expect(cash).not.toBe('');
    expect(receivable).not.toBe('');

    expect(await queryOne(
      db,
      `select count(*)::int as n from public.accounting_periods where company_id = $1::uuid`,
      [COMPANY_A],
    )).toEqual({ n: 0 });

    const result = await rpcJsonb(db, 'post_receipt_atomic', {
      request_id: REQUEST_ID,
      receipt: {
        id: RECEIPT_ID,
        contract_id: CONTRACT_A,
        amount: 100,
        channel: 'BANK_TRANSFER',
        date_time: '2026-07-24',
        notes: 'S03 canonical receipt posting proof',
      },
      allocations: [{ invoice_id: INVOICE_A1, amount: 100 }],
      journal_entries: [
        {
          no: 'S03-RCT-D',
          date: '2026-07-24',
          account_id: cash,
          amount: 100,
          type: 'DEBIT',
          source_id: RECEIPT_ID,
          entity_type: 'contract',
          entity_id: CONTRACT_A,
        },
        {
          no: 'S03-RCT-C',
          date: '2026-07-24',
          account_id: receivable,
          amount: 100,
          type: 'CREDIT',
          source_id: RECEIPT_ID,
          entity_type: 'contract',
          entity_id: CONTRACT_A,
        },
      ],
    });

    expect(result).toMatchObject({ success: true, idempotent: false, receipt_id: RECEIPT_ID });

    const period = await queryOne(
      db,
      `select name, start_date::text as start_date, end_date::text as end_date, status
         from public.accounting_periods
        where company_id = $1::uuid`,
      [COMPANY_A],
    );
    expect(period).toEqual({
      name: '2026-07',
      start_date: '2026-07-01',
      end_date: '2026-07-31',
      status: 'OPEN',
    });

    const batch = await queryOne(
      db,
      `select id::text as id, status, source_type, source_id, event_id,
              effective_date::text as effective_date, posting_date::text as posting_date,
              late_posting, accounting_period_id is not null as has_period,
              is_legacy_compat
         from public.journal_batches
        where company_id = $1::uuid
          and source_type = 'receipt'
          and source_id = $2
          and event_id = $3`,
      [COMPANY_A, RECEIPT_ID, REQUEST_ID],
    );
    expect(batch).toMatchObject({
      status: 'POSTED',
      source_type: 'receipt',
      source_id: RECEIPT_ID,
      event_id: REQUEST_ID,
      effective_date: '2026-07-24',
      posting_date: '2026-07-24',
      late_posting: false,
      has_period: true,
      is_legacy_compat: false,
    });

    const lines = await queryOne(
      db,
      `select count(*)::int as n,
              sum(debit)::numeric as debit,
              sum(credit)::numeric as credit,
              bool_and(company_id = $2::uuid) as company_ok
         from public.journal_lines
        where batch_id = $1::uuid`,
      [String(batch?.id), COMPANY_A],
    );
    expect(lines).toMatchObject({ n: 2, company_ok: true });
    expect(Number(lines?.debit)).toBe(100);
    expect(Number(lines?.credit)).toBe(100);

    // The compatibility read view still exposes the same business source for
    // existing reports/readers, but the underlying batch is canonical.
    const compatibilityRead = await queryOne(
      db,
      `select count(*)::int as n from public.journal_entries
        where company_id = $1::uuid and source_id::text = $2`,
      [COMPANY_A, RECEIPT_ID],
    );
    expect(compatibilityRead).toEqual({ n: 2 });

    const replay = await rpcJsonb(db, 'post_receipt_atomic', {
      request_id: REQUEST_ID,
      receipt: {
        id: RECEIPT_ID,
        contract_id: CONTRACT_A,
        amount: 100,
        channel: 'BANK_TRANSFER',
        date_time: '2026-07-24',
        notes: 'S03 canonical receipt posting proof',
      },
      allocations: [{ invoice_id: INVOICE_A1, amount: 100 }],
      journal_entries: [
        { no: 'S03-RCT-C-REORDER', date: '2026-07-24', account_id: receivable, amount: 100, type: 'CREDIT', source_id: RECEIPT_ID, entity_type: 'contract', entity_id: CONTRACT_A },
        { no: 'S03-RCT-D-REORDER', date: '2026-07-24', account_id: cash, amount: 100, type: 'DEBIT', source_id: RECEIPT_ID, entity_type: 'contract', entity_id: CONTRACT_A },
      ],
    });
    expect(replay).toMatchObject({ success: true, idempotent: true, receipt_id: RECEIPT_ID });

    expect(await queryOne(
      db,
      `select count(*)::int as n from public.journal_batches
        where company_id = $1::uuid and source_type = 'receipt' and source_id = $2 and event_id = $3`,
      [COMPANY_A, RECEIPT_ID, REQUEST_ID],
    )).toEqual({ n: 1 });
  }, 120_000);
});
