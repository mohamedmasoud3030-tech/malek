import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase } from './replay-bootstrap';
import {
  ADMIN_A,
  ADMIN_B,
  CHECKER_A,
  COMPANY_A,
  COMPANY_B,
  INVOICE_A1,
  queryOne,
  rpcJsonb,
  seedPhase3a1bFixture,
} from '../p3/phase3a1b-fixture';

describe('WP-01 receipt VOID Maker-Checker', () => {
  let db: PGlite;
  let receiptId: string;
  let voidRequestId: string;

  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;
    await seedPhase3a1bFixture(db);
    await assumeIdentity(db, ADMIN_A, COMPANY_A);

    const payment = await rpcJsonb(db, 'record_invoice_payment_atomic', {
      request_id: 'wp01-void-source-payment',
      invoice_id: INVOICE_A1,
      amount: 125,
      method: 'CASH',
      date: '2026-08-13',
    });
    receiptId = String(payment.receipt_id);
  }, 420_000);

  afterAll(async () => {
    await db?.close();
  });

  it('fails the legacy one-step facade closed', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    await expect(
      rpcJsonb(db, 'void_receipt_atomic', {
        receipt_id: receiptId,
        reason: 'must not bypass review',
        request_id: 'wp01-direct-void-denied',
      }),
    ).rejects.toThrow(/RECEIPT_VOID_REQUIRES_MAKER_CHECKER/);
  });

  it('records a mandatory-reason request without changing financial state', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);

    await expect(
      rpcJsonb(db, 'request_receipt_void_atomic', {
        receipt_id: receiptId,
        request_id: 'wp01-void-missing-reason',
      }),
    ).rejects.toThrow(/receipt_id, reason, and request_id are required/);

    const requested = await rpcJsonb(db, 'request_receipt_void_atomic', {
      receipt_id: receiptId,
      reason: 'duplicate collection entered by mistake',
      request_id: 'wp01-void-request-1',
    });
    voidRequestId = String(requested.void_request_id);
    expect(requested).toMatchObject({
      success: true,
      idempotent: false,
      receipt_id: receiptId,
      status: 'PENDING',
      requested_by: ADMIN_A,
    });

    const state = await queryOne(
      db,
      `select r.status as receipt_status, p.status as payment_status,
              q.status as request_status, q.requested_by::text as requested_by
         from public.receipts r
         join public.payments p on p.receipt_id = r.id
         join public.receipt_void_requests q on q.receipt_id = r.id::text
        where r.id::text = $1`,
      [receiptId],
    );
    expect(state).toEqual({
      receipt_status: 'POSTED',
      payment_status: 'POSTED',
      request_status: 'PENDING',
      requested_by: ADMIN_A,
    });
  });

  it('rejects self-approval and cross-company lookup without side effects', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    await expect(
      rpcJsonb(db, 'approve_receipt_void_atomic', {
        void_request_id: voidRequestId,
        request_id: 'wp01-self-approval-denied',
      }),
    ).rejects.toThrow(/MAKER_CHECKER_SELF_APPROVAL_DENIED/);

    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    await expect(
      rpcJsonb(db, 'approve_receipt_void_atomic', {
        void_request_id: voidRequestId,
        request_id: 'wp01-cross-company-denied',
      }),
    ).rejects.toThrow(/not found in the active company/);

    expect(await queryOne(
      db,
      `select r.status as receipt_status, p.status as payment_status, q.status as request_status
         from public.receipts r
         join public.payments p on p.receipt_id = r.id
         join public.receipt_void_requests q on q.receipt_id = r.id::text
        where r.id::text = $1`,
      [receiptId],
    )).toEqual({
      receipt_status: 'POSTED',
      payment_status: 'POSTED',
      request_status: 'PENDING',
    });
  });

  it('lets a distinct checker execute one reversal with immutable audit identities', async () => {
    await assumeIdentity(db, CHECKER_A, COMPANY_A);
    const approved = await rpcJsonb(db, 'approve_receipt_void_atomic', {
      void_request_id: voidRequestId,
      request_id: 'wp01-void-approval-1',
    });
    expect(approved).toMatchObject({
      success: true,
      idempotent: false,
      receipt_id: receiptId,
      status: 'VOID',
      void_request_id: voidRequestId,
      void_request_status: 'EXECUTED',
      requested_by: ADMIN_A,
      approved_by: CHECKER_A,
    });
    // WP-02 RATE collection adds owner-payable/fee-revenue lines to the same
    // receipt batch, so the canonical VOID reverses all four economic lines.
    expect(Number(approved.journal_reversal_entries)).toBe(4);

    const replay = await rpcJsonb(db, 'approve_receipt_void_atomic', {
      void_request_id: voidRequestId,
      request_id: 'wp01-void-approval-1',
    });
    expect(replay).toMatchObject({ success: true, idempotent: true });

    const evidence = await queryOne(
      db,
      `select
          r.status as receipt_status,
          p.status as payment_status,
          q.status as request_status,
          q.requested_by::text as requested_by,
          q.reviewed_by::text as reviewed_by,
          q.reversal_batch_id::text as reversal_batch_id,
          (select count(*)::int from public.audit_log a
            where a.entity_id = q.id::text and a.action = 'REQUEST_RECEIPT_VOID') as request_audits,
          (select count(*)::int from public.audit_log a
            where a.entity_id = q.id::text and a.action = 'APPROVE_RECEIPT_VOID') as approval_audits,
          (select count(*)::int from public.journal_entries je
            where je.source_id::text = r.id::text and je.entity_type = 'receipt_void') as reversal_lines
       from public.receipts r
       join public.payments p on p.receipt_id = r.id
       join public.receipt_void_requests q on q.receipt_id = r.id::text
       where r.id::text = $1`,
      [receiptId],
    );

    expect(evidence).toMatchObject({
      receipt_status: 'VOID',
      payment_status: 'VOID',
      request_status: 'EXECUTED',
      requested_by: ADMIN_A,
      reviewed_by: CHECKER_A,
      request_audits: 1,
      approval_audits: 1,
      reversal_lines: 4,
    });
    expect(String(evidence?.reversal_batch_id ?? '')).not.toBe('');
  });
});
