import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from '../p1/replay-bootstrap';
import {
  ADMIN_A,
  CHECKER_A,
  COMPANY_A,
  CONTRACT_A,
  INVOICE_A1,
  queryOne,
  rpcJsonb,
  seedPhase3a1bFixture,
} from '../p3/phase3a1b-fixture';
import { requestAndApproveReceiptVoid } from '../p3/receipt-void-maker-checker-test-helper';

const RECEIPT_ID = '53a40000-0000-4000-8000-000000000001';
const POST_REQUEST_ID = 's03-void-source-post-1';
const VOID_REQUEST_ID = 's03-engine-void-1';

let db: PGlite;
let cash: string;
let receivable: string;

async function accountId(no: string) {
  const row = await queryOne(
    db,
    `select id from public.accounts where company_id = $1::uuid and no = $2`,
    [COMPANY_A, no],
  );
  return String(row?.id ?? '');
}

async function postCanonicalReceipt() {
  return rpcJsonb(db, 'post_receipt_atomic', {
    request_id: POST_REQUEST_ID,
    receipt: {
      id: RECEIPT_ID,
      contract_id: CONTRACT_A,
      amount: 100,
      channel: 'BANK_TRANSFER',
      date_time: '2026-07-24',
      notes: 'S03 engine VOID source',
    },
    allocations: [{ invoice_id: INVOICE_A1, amount: 100 }],
    journal_entries: [
      { no: 'S03-VOID-SRC-D', date: '2026-07-24', account_id: cash, amount: 100, type: 'DEBIT', source_id: RECEIPT_ID, entity_type: 'contract', entity_id: CONTRACT_A },
      { no: 'S03-VOID-SRC-C', date: '2026-07-24', account_id: receivable, amount: 100, type: 'CREDIT', source_id: RECEIPT_ID, entity_type: 'contract', entity_id: CONTRACT_A },
    ],
  });
}

describe('Stage 3 — receipt VOID uses engine-managed reversal', () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;
    await seedPhase3a1bFixture(db);
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    cash = await accountId('1111');
    receivable = await accountId('1201');
    expect(cash).not.toBe('');
    expect(receivable).not.toBe('');
    const posted = await postCanonicalReceipt();
    expect(posted).toMatchObject({ success: true, receipt_id: RECEIPT_ID });
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it('reverses the canonical receipt batch once and links both batches', async () => {
    const original = await queryOne(
      db,
      `select id::text as id, status, is_legacy_compat
         from public.journal_batches
        where company_id = $1::uuid
          and source_type = 'receipt'
          and source_id = $2
          and event_id = $3`,
      [COMPANY_A, RECEIPT_ID, POST_REQUEST_ID],
    );
    expect(original).toMatchObject({ status: 'POSTED', is_legacy_compat: false });

    const beforeInvoice = await queryOne(
      db,
      `select paid_amount::numeric as paid_amount from public.invoices where id::text = $1`,
      [INVOICE_A1],
    );
    expect(Number(beforeInvoice?.paid_amount)).toBe(100);

    const result = await requestAndApproveReceiptVoid(
      db,
      ADMIN_A,
      CHECKER_A,
      COMPANY_A,
      {
        receipt_id: RECEIPT_ID,
        reason: 'S03 engine-managed reversal proof',
        request_id: VOID_REQUEST_ID,
      },
    );

    expect(result).toMatchObject({
      success: true,
      idempotent: false,
      receipt_id: RECEIPT_ID,
      status: 'VOID',
      journal_reversal_entries: 2,
    });
    const reversalId = String(result.journal_reversal_batch_id);
    expect(reversalId).not.toBe('');

    const originalAfter = await queryOne(
      db,
      `select status, reversal_of_batch_id::text as reversal_id
         from public.journal_batches where id = $1::uuid`,
      [String(original?.id)],
    );
    expect(originalAfter).toEqual({ status: 'REVERSED', reversal_id: reversalId });

    const reversal = await queryOne(
      db,
      `select status, source_type, source_id, reversal_of_batch_id::text as original_id,
              is_legacy_compat, accounting_period_id is not null as has_period,
              effective_date::text as effective_date, posting_date::text as posting_date,
              late_posting
         from public.journal_batches where id = $1::uuid`,
      [reversalId],
    );
    expect(reversal).toMatchObject({
      status: 'POSTED',
      source_type: 'journal_reversal',
      source_id: String(original?.id),
      original_id: String(original?.id),
      is_legacy_compat: false,
      has_period: true,
      effective_date: '2026-07-24',
      posting_date: '2026-07-24',
      late_posting: false,
    });

    const totals = await queryOne(
      db,
      `select
         sum(case when account_id = $2 then debit else 0 end)::numeric as cash_debit,
         sum(case when account_id = $2 then credit else 0 end)::numeric as cash_credit,
         sum(case when account_id = $3 then debit else 0 end)::numeric as ar_debit,
         sum(case when account_id = $3 then credit else 0 end)::numeric as ar_credit,
         sum(debit)::numeric as total_debit,
         sum(credit)::numeric as total_credit,
         count(*)::int as n
       from public.journal_lines
       where batch_id = $1::uuid`,
      [reversalId, cash, receivable],
    );
    expect(totals).toMatchObject({ n: 2 });
    expect(Number(totals?.cash_debit)).toBe(0);
    expect(Number(totals?.cash_credit)).toBe(100);
    expect(Number(totals?.ar_debit)).toBe(100);
    expect(Number(totals?.ar_credit)).toBe(0);
    expect(Number(totals?.total_debit)).toBe(100);
    expect(Number(totals?.total_credit)).toBe(100);

    const invoiceAfter = await queryOne(
      db,
      `select paid_amount::numeric as paid_amount, status from public.invoices where id::text = $1`,
      [INVOICE_A1],
    );
    expect(Number(invoiceAfter?.paid_amount)).toBe(0);
    // Status is a derived projection. This historical invoice is past due, so
    // the compensating receipt VOID correctly restores OVERDUE rather than a
    // stale hard-coded UNPAID label.
    expect(invoiceAfter?.status).toBe('OVERDUE');

    const statuses = await queryOne(
      db,
      `select r.status as receipt_status, p.status as payment_status
         from public.receipts r
         join public.payments p on p.receipt_id = r.id
        where r.id::text = $1`,
      [RECEIPT_ID],
    );
    expect(statuses).toEqual({ receipt_status: 'VOID', payment_status: 'VOID' });

    const replay = await requestAndApproveReceiptVoid(
      db,
      ADMIN_A,
      CHECKER_A,
      COMPANY_A,
      {
        receipt_id: RECEIPT_ID,
        reason: 'S03 engine-managed reversal proof',
        request_id: VOID_REQUEST_ID,
      },
    );
    expect(replay).toMatchObject({
      success: true,
      idempotent: true,
      receipt_id: RECEIPT_ID,
      journal_reversal_batch_id: reversalId,
    });

    const counts = await queryOne(
      db,
      `select
         (select count(*)::int from public.journal_batches where id = $1::uuid) as reversal_batches,
         (select count(*)::int from public.journal_batches where reversal_of_batch_id = $2::uuid and source_type = 'journal_reversal') as linked_reversals,
         (select count(*)::int from public.journal_lines where batch_id = $1::uuid) as reversal_lines`,
      [reversalId, String(original?.id)],
    );
    expect(counts).toEqual({ reversal_batches: 1, linked_reversals: 1, reversal_lines: 2 });
  }, 120_000);
});
