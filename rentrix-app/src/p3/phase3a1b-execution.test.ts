/**
 * Phase 3A-1B — execution (PGlite) lifecycle proofs for invoice generation,
 * payment recording, receipt posting and VOID under canonical account resolution.
 *
 * Covers §4/§5/§6/§7/§8/§9 of the Phase 3A-1B directive and writes:
 *   evidence/p3/phase3a1b/invoice-posting-lifecycle.json
 *   evidence/p3/phase3a1b/payment-receipt-lifecycle.json
 *   evidence/p3/phase3a1b/payment-receipt-identity.json
 *   evidence/p3/phase3a1b/void-reversal-lifecycle.json
 *   evidence/p3/phase3a1b/two-company-isolation.json
 *   evidence/p3/phase3a1b/idempotency-isolation.json
 *
 * Company A is provisioned (1111/1201/4000/2100 + VAT 5%); company B is
 * deliberately unprovisioned — account resolution must fail loudly for B.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity, createFullReplayedDatabase, repoRoot } from '../p1/replay-bootstrap';
import {
  ADMIN_A,
  ADMIN_B,
  COMPANY_A,
  COMPANY_B,
  CONTRACT_A,
  CONTRACT_B,
  INVOICE_A1,
  INVOICE_A2,
  INVOICE_B1,
  journalBalance,
  queryOne,
  rpcJsonb,
  seedPhase3a1bFixture,
} from './phase3a1b-fixture';

const OUT_DIR = join(repoRoot, 'evidence', 'p3', 'phase3a1b');
const MULTI_RECEIPT_ID = '77cc31b0-0000-4000-8000-000000000001';

let db: PGlite;
const evidence: Record<string, Record<string, unknown>> = {
  invoicePosting: {},
  paymentReceipt: {},
  identity: {},
  void: {},
  isolation: {},
  idempotency: {},
};

async function accountId(dbh: PGlite, no: string, companyId: string) {
  const row = await queryOne(dbh, `select id from public.accounts where no = $1 and company_id = $2::uuid`, [no, companyId]);
  return row ? String(row.id) : null;
}

async function invoiceState(id: string) {
  return queryOne(
    db,
    `select id::text, amount::numeric as amount, tax_amount::numeric as tax_amount,
            paid_amount::numeric as paid_amount, status, company_id::text as company_id
       from public.invoices where id::text = $1`,
    [id],
  );
}

async function receiptState(id: string) {
  return queryOne(
    db,
    `select r.id::text, r.status, r.amount::numeric as amount, r.request_id, r.voided_at,
            r.company_id::text as company_id,
            p.id::text as payment_id, p.receipt_id::text as payment_receipt_id, p.status as payment_status,
            p.company_id::text as payment_company_id
       from public.receipts r
       left join public.payments p on p.receipt_id = r.id
      where r.id::text = $1`,
    [id],
  );
}

async function contractBalance(contractId: string) {
  return queryOne(
    db,
    `select total_invoiced::numeric as total_invoiced, total_paid::numeric as total_paid,
            balance_due::numeric as balance_due, company_id::text as company_id
       from public.contract_balances where contract_id::text = $1`,
    [contractId],
  );
}

describe('Phase 3A-1B execution lifecycle', () => {
  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;
    await seedPhase3a1bFixture(db);
  }, 420_000);

  afterAll(async () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const stamp = new Date().toISOString();
    const files: Record<string, Record<string, unknown>> = {
      'invoice-posting-lifecycle.json': evidence.invoicePosting,
      'payment-receipt-lifecycle.json': evidence.paymentReceipt,
      'payment-receipt-identity.json': evidence.identity,
      'void-reversal-lifecycle.json': evidence.void,
      'two-company-isolation.json': evidence.isolation,
      'idempotency-isolation.json': evidence.idempotency,
    };
    for (const [file, value] of Object.entries(files)) {
      writeFileSync(join(OUT_DIR, file), `${JSON.stringify({ generatedAt: stamp, ...value }, null, 2)}\n`);
    }
    await db?.close();
  });

  // ── T1 · invoice generation/posting ────────────────────────────────────────
  it('generates company-scoped invoices with balanced canonical journals; retry is a no-op', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const { rows: first } = await db.query(`select public.generate_invoices_from_active_contracts() as n`);
    expect((first[0] as { n: number }).n).toBe(1);

    const generated = await queryOne(
      db,
      `select i.id::text, i.amount::numeric as amount, i.tax_amount::numeric as tax_amount,
              i.tax_rate::numeric as tax_rate, i.status, i.issue_date::text, i.company_id::text as company_id
         from public.invoices i
        where i.contract_id::text = $1
          and i.issue_date = current_date
          and i.deleted_at is null`,
      [CONTRACT_A],
    );
    expect(generated).toBeDefined();
    expect(generated!.company_id).toBe(COMPANY_A);
    expect(Number(generated!.amount)).toBeCloseTo(1000, 3);
    expect(Number(generated!.tax_rate)).toBeCloseTo(5, 3);
    expect(Number(generated!.tax_amount)).toBeCloseTo(50, 3);
    expect(generated!.status).toBe('UNPAID');

    // Canonical company-owned AR / revenue / VAT lines, balanced journal.
    const { rows: lines } = await db.query(
      `select je.account_id, a.no as account_no, a.company_id::text as account_company,
              je.amount::numeric as amount, je.type, je.company_id::text as company_id
         from public.journal_entries je
         join public.accounts a on a.id = je.account_id
        where je.source_id::text = $1
        order by je.type desc, a.no`,
      [generated!.id],
    );
    expect(lines).toHaveLength(3);
    const jl = lines as Record<string, unknown>[];
    const debit = jl.find((l) => l.type === 'DEBIT') as Record<string, unknown>;
    const credits = jl.filter((l) => l.type === 'CREDIT') as Record<string, unknown>[];
    expect(String(debit.account_no)).toBe('1201');
    expect(Number(debit.amount)).toBeCloseTo(1050, 3);
    expect(credits.map((c) => String(c.account_no)).sort()).toEqual(['2100', '4000']);
    for (const line of jl) {
      expect(line.account_company).toBe(COMPANY_A);
      expect(line.company_id).toBe(COMPANY_A);
    }
    const balance = await journalBalance(db, String(generated!.id), COMPANY_A);
    expect(balance.debit).toBeCloseTo(balance.credit, 3);

    // Retry: period dedup — no new invoice, no new journal.
    const { rows: second } = await db.query(`select public.generate_invoices_from_active_contracts() as n`);
    expect((second[0] as { n: number }).n).toBe(0);
    const dup = await queryOne(
      db,
      `select count(*)::int as invoices,
              (select count(*)::int from public.journal_entries je where je.source_id::text = $1) as journals
         from public.invoices i where i.contract_id::text = $2 and i.issue_date = current_date`,
      [generated!.id, CONTRACT_A],
    );
    expect(dup!.invoices).toBe(1);
    expect(dup!.journals).toBe(3);

    // Company B: no canonical chart → loud require error, zero side effects.
    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    await expect(db.query(`select public.generate_invoices_from_active_contracts() as n`)).rejects.toThrow(
      /1201 is not configured for company/,
    );
    const bCount = await queryOne(
      db,
      `select count(*)::int as n from public.invoices i
        join public.contracts c on c.id = i.contract_id
       where c.company_id = $1::uuid and i.deleted_at is null
         and i.issue_date = current_date`,
      [COMPANY_B],
    );
    expect(bCount!.n).toBe(0);

    // The generation loop never touches another company's contracts.
    const aForB = await queryOne(
      db,
      `select count(*)::int as n from public.invoices i where i.company_id = $1::uuid and i.contract_id::text = $2`,
      [COMPANY_A, CONTRACT_B],
    );
    expect(aForB!.n).toBe(0);

    evidence.invoicePosting = {
      scenario: 'generate → retry → B-require-failure',
      generatedInvoiceId: generated!.id,
      totals: { amount: Number(generated!.amount), tax: Number(generated!.tax_amount), due: 1050 },
      journalLines: lines,
      retryCreatedDuplicates: false,
      companyBRequireError: '1201 is not configured for company',
      crossCompanyWrites: 0,
    };
  }, 120_000);

  // ── T2 · multi-invoice allocation receipt (post_receipt_atomic) ────────────
  it('posts one receipt allocated across two invoices and rejects cross-company data', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const cashA = await accountId(db, '1111', COMPANY_A);
    const arA = await accountId(db, '1201', COMPANY_A);
    expect(cashA).not.toBeNull();
    expect(arA).not.toBeNull();

    // Overpay guard fires BEFORE any write.
    await expect(
      rpcJsonb(db, 'post_receipt_atomic', {
        request_id: 'p3a1b-post-overpay',
        receipt: { contract_id: CONTRACT_A, amount: 1700, channel: 'BANK_TRANSFER', date_time: '2026-07-24' },
        allocations: [
          { invoice_id: INVOICE_A1, amount: 1200 },
          { invoice_id: INVOICE_A2, amount: 500 },
        ],
        journal_entries: [],
      }),
    ).rejects.toThrow(/تتجاوز المتبقي/);
    const afterOverpay = await queryOne(db, `select count(*)::int as n from public.receipts where request_id = 'p3a1b-post-overpay'`);
    expect(afterOverpay!.n).toBe(0);

    // Multi-invoice allocation: 700 across A1 (200) + A2 (500). The receipt id
    // is pinned so the journal lines can carry source_id = receipt id (the same
    // linkage the record path produces) for VOID-selectability + balance checks.
    const posted = await rpcJsonb(db, 'post_receipt_atomic', {
      request_id: 'p3a1b-post-1',
      receipt: { id: MULTI_RECEIPT_ID, contract_id: CONTRACT_A, amount: 700, channel: 'BANK_TRANSFER', date_time: '2026-07-24' },
      allocations: [
        { invoice_id: INVOICE_A1, amount: 200 },
        { invoice_id: INVOICE_A2, amount: 500 },
      ],
      journal_entries: [
        { no: 'P3A1B-MULTI-D', date: '2026-07-24', account_id: cashA, amount: 700, type: 'DEBIT', source_id: MULTI_RECEIPT_ID, entity_type: 'contract', entity_id: CONTRACT_A },
        { no: 'P3A1B-MULTI-C', date: '2026-07-24', account_id: arA, amount: 700, type: 'CREDIT', source_id: MULTI_RECEIPT_ID, entity_type: 'contract', entity_id: CONTRACT_A },
      ],
    });
    expect(posted.success).toBe(true);
    expect(posted.idempotent).toBe(false);
    const multiReceiptId = String(posted.receipt_id);
    expect(multiReceiptId).toBe(MULTI_RECEIPT_ID);

    const a1 = await invoiceState(INVOICE_A1);
    const a2 = await invoiceState(INVOICE_A2);
    expect(Number(a1!.paid_amount)).toBeCloseTo(200, 3);
    expect(a1!.status).toBe('PARTIALLY_PAID');
    expect(Number(a2!.paid_amount)).toBeCloseTo(500, 3);
    expect(a2!.status).toBe('PAID');

    // Shared identity: payments.id = payments.receipt_id = receipts.id.
    const receipt = await receiptState(multiReceiptId);
    expect(receipt!.payment_id).toBe(multiReceiptId);
    expect(receipt!.payment_receipt_id).toBe(multiReceiptId);
    expect(receipt!.status).toBe('POSTED');
    expect(receipt!.payment_status).toBe('POSTED');
    expect(receipt!.company_id).toBe(COMPANY_A);
    expect(receipt!.payment_company_id).toBe(COMPANY_A);

    const alloc = await queryOne(
      db,
      `select count(*)::int as count, sum(amount)::numeric as total, bool_and(company_id = $2::uuid) as company_ok
         from public.receipt_allocations where receipt_id::text = $1`,
      [multiReceiptId, COMPANY_A],
    );
    expect(alloc!.count).toBe(2);
    expect(Number(alloc!.total)).toBeCloseTo(700, 3);
    expect(alloc!.company_ok).toBe(true);

    const balance = await journalBalance(db, multiReceiptId, COMPANY_A);
    expect(balance.count).toBe(2);
    expect(balance.debit).toBeCloseTo(700, 3);
    expect(balance.credit).toBeCloseTo(700, 3);
    expect(balance.companyOk).toBe(true);

    // Contract balance is trigger-derived from company invoices only.
    const cb = await contractBalance(CONTRACT_A);
    const recompute = await queryOne(
      db,
      `select sum(amount + coalesce(tax_amount,0))::numeric as invoiced, sum(paid_amount)::numeric as paid
         from public.invoices where contract_id::text = $1 and deleted_at is null`,
      [CONTRACT_A],
    );
    expect(Number(cb!.total_invoiced)).toBeCloseTo(Number(recompute!.invoiced), 3);
    expect(Number(cb!.total_paid)).toBeCloseTo(Number(recompute!.paid), 3);

    // Client-supplied journal account that A does not own → 42501, atomic rollback.
    await expect(
      rpcJsonb(db, 'post_receipt_atomic', {
        request_id: 'p3a1b-post-foreign-account',
        receipt: { contract_id: CONTRACT_A, amount: 10, channel: 'CASH', date_time: '2026-07-24' },
        allocations: [],
        journal_entries: [
          { no: 'P3A1B-X-D', date: '2026-07-24', account_id: '2200', amount: 10, type: 'DEBIT' },
        ],
      }),
    ).rejects.toThrow(/حساب القيد لا ينتمي/);
    const afterForeign = await queryOne(db, `select count(*)::int as n from public.receipts where request_id = 'p3a1b-post-foreign-account'`);
    expect(afterForeign!.n).toBe(0);

    evidence.paymentReceipt = {
      scenario: 'multi-invoice allocation + overpay/foreign-account rejections (atomic)',
      receiptId: multiReceiptId,
      allocationTotal: Number(alloc!.total),
      invoiceStates: { a1: { paid: Number(a1!.paid_amount), status: a1!.status }, a2: { paid: Number(a2!.paid_amount), status: a2!.status } },
      journal: balance,
      contractBalanceMatchesInvoices: true,
    };
    evidence.identity = {
      ...(evidence.identity ?? {}),
      multiReceipt: {
        receiptId: multiReceiptId,
        paymentId: receipt!.payment_id,
        sharedIdentity: receipt!.payment_id === multiReceiptId && receipt!.payment_receipt_id === multiReceiptId,
      },
    };
  }, 120_000);

  // ── T3 · record_invoice_payment_atomic lifecycle + idempotent retry ────────
  it('records partial + settlement payments through canonical accounts with idempotent retry', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const pay1 = await rpcJsonb(db, 'record_invoice_payment_atomic', {
      request_id: 'p3a1b-pay-1',
      invoice_id: INVOICE_A1,
      amount: 400,
      method: 'BANK_TRANSFER',
      date: '2026-07-24',
    });
    expect(pay1.success).toBe(true);
    expect(pay1.status).toBe('recorded');
    const receipt1 = String(pay1.receipt_id);

    const pay1Retry = await rpcJsonb(db, 'record_invoice_payment_atomic', {
      request_id: 'p3a1b-pay-1',
      invoice_id: INVOICE_A1,
      amount: 400,
      method: 'BANK_TRANSFER',
      date: '2026-07-24',
    });
    expect(String(pay1Retry.receipt_id)).toBe(receipt1);
    expect(pay1Retry.status).toBe('recorded');
    const rc = await queryOne(db, `select count(*)::int as n, min(request_id) as raw from public.receipts where request_id = 'p3a1b-pay-1'`);
    expect(rc!.n).toBe(1);
    expect(rc!.raw).toBe('p3a1b-pay-1'); // RAW request_id storage (release-blocker gate contract)

    let a1 = await invoiceState(INVOICE_A1);
    expect(Number(a1!.paid_amount)).toBeCloseTo(600, 3);
    expect(a1!.status).toBe('PARTIALLY_PAID');

    const pay2 = await rpcJsonb(db, 'record_invoice_payment_atomic', {
      request_id: 'p3a1b-pay-2',
      invoice_id: INVOICE_A1,
      amount: 400,
      method: 'CASH',
      date: '2026-07-24',
    });
    expect(pay2.success).toBe(true);
    const receipt2 = String(pay2.receipt_id);
    a1 = await invoiceState(INVOICE_A1);
    expect(Number(a1!.paid_amount)).toBeCloseTo(1000, 3);
    expect(a1!.status).toBe('PAID');

    // Overpayment is rejected with the preserved guard.
    await expect(
      rpcJsonb(db, 'record_invoice_payment_atomic', {
        request_id: 'p3a1b-pay-over',
        invoice_id: INVOICE_A1,
        amount: 0.5,
        method: 'CASH',
      }),
    ).rejects.toThrow(/exceeds outstanding/);

    // Canonical accounts: debit A's 1111, credit A's 1201, balanced, company-stamped.
    const cashA = await accountId(db, '1111', COMPANY_A);
    const arA = await accountId(db, '1201', COMPANY_A);
    for (const rid of [receipt1, receipt2]) {
      const { rows: lines } = await db.query(
        `select account_id, amount::numeric as amount, type, company_id::text as company_id
           from public.journal_entries where source_id::text = $1 order by type`,
        [rid],
      );
      expect(lines).toHaveLength(2);
      const rl = lines as Record<string, unknown>[];
      const debit = rl.find((l) => l.type === 'DEBIT') as Record<string, unknown>;
      const credit = rl.find((l) => l.type === 'CREDIT') as Record<string, unknown>;
      expect(String(debit.account_id)).toBe(String(cashA));
      expect(String(credit.account_id)).toBe(String(arA));
      expect(Number(debit.amount)).toBeCloseTo(Number(credit.amount), 3);
      for (const line of rl) expect(line.company_id).toBe(COMPANY_A);
    }
    const r1 = await receiptState(receipt1);
    const r2 = await receiptState(receipt2);
    expect(r1!.payment_id).toBe(receipt1);
    expect(r2!.payment_id).toBe(receipt2);

    const idem = await queryOne(
      db,
      `select operation_name, request_id from public.financial_operation_idempotency
        where request_id in ('p3a1b-pay-1', 'p3a1b-pay-2') order by request_id`,
    );
    expect(idem).toBeDefined();
    evidence.paymentReceipt = {
      ...evidence.paymentReceipt,
      recordLifecycle: {
        receipt1,
        receipt2,
        retrySameReceipt: true,
        rawRequestIdStored: true,
        finalInvoice: { paid: 1000, status: a1!.status },
        overpayRejected: true,
      },
    };
    evidence.identity = {
      ...(evidence.identity ?? {}),
      recordedReceipts: [
        { receiptId: receipt1, paymentId: r1!.payment_id, shared: r1!.payment_id === receipt1 },
        { receiptId: receipt2, paymentId: r2!.payment_id, shared: r2!.payment_id === receipt2 },
      ],
      idempotencyRows: idem,
    };
  }, 120_000);

  // ── T4 · VOID lifecycle: reversal once, statuses, no deletion ──────────────
  it('voids receipts (by receipt id and by payment id) with a single mirrored reversal batch', async () => {
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const ids = evidence.paymentReceipt.recordLifecycle as { receipt1: string; receipt2: string };
    const receipt2 = ids.receipt2;

    const before = await queryOne(
      db,
      `select (select count(*)::int from public.receipts where id::text = $1) as receipts,
              (select count(*)::int from public.payments where id::text = $1) as payments,
              (select count(*)::int from public.receipt_allocations where receipt_id::text = $1) as allocations,
              (select count(*)::int from public.journal_entries where source_id::text = $1) as journals`,
      [receipt2],
    );
    expect(before).toEqual({ receipts: 1, payments: 1, allocations: 1, journals: 2 });

    const voided = await rpcJsonb(db, 'void_receipt_atomic', {
      receipt_id: receipt2,
      reason: 'duplicate posting',
      request_id: 'p3a1b-void-1',
    });
    expect(voided.success).toBe(true);
    expect(voided.idempotent).toBe(false);
    expect(Number(voided.journal_reversal_entries)).toBe(2);

    const r2 = await receiptState(receipt2);
    expect(r2!.status).toBe('VOID');
    expect(r2!.payment_status).toBe('VOID');
    expect(r2!.voided_at).not.toBeNull();
    let a1 = await invoiceState(INVOICE_A1);
    expect(Number(a1!.paid_amount)).toBeCloseTo(600, 3);
    expect(a1!.status).toBe('PARTIALLY_PAID');

    // Reversal mirrors the original entry (same account, same amount, flipped side).
    const { rows: pairs } = await db.query(
      `select o.account_id as orig_account, o.amount::numeric as orig_amount, o.type as orig_type,
              r.account_id as rev_account, r.amount::numeric as rev_amount, r.type as rev_type,
              r.company_id::text as rev_company
         from public.journal_entries o
         join public.journal_entries r on r.account_id = o.account_id and r.amount = o.amount
        where o.source_id::text = $1 and coalesce(o.entity_type,'') <> 'receipt_void'
          and r.source_id::text = $1 and r.entity_type = 'receipt_void'
          and r.request_id = 'void:' || $1
        order by 1`,
      [receipt2],
    );
    expect(pairs).toHaveLength(2);
    for (const pair of pairs as Record<string, unknown>[]) {
      expect(pair.rev_account).toBe(pair.orig_account);
      expect(Number(pair.rev_amount)).toBeCloseTo(Number(pair.orig_amount), 3);
      expect(pair.rev_type).not.toBe(pair.orig_type);
      expect(pair.rev_company).toBe(COMPANY_A);
    }
    const allFour = await journalBalance(db, receipt2, COMPANY_A);
    expect(allFour.count).toBe(4);
    expect(allFour.debit).toBeCloseTo(allFour.credit, 3);

    // Same-request retry: replayed response, still exactly one reversal batch.
    const retried = await rpcJsonb(db, 'void_receipt_atomic', {
      receipt_id: receipt2,
      reason: 'duplicate posting',
      request_id: 'p3a1b-void-1',
    });
    expect(retried.idempotent).toBe(true);
    let counts = await queryOne(
      db,
      `select count(*)::int as reversals,
              (select count(*)::int from public.audit_log where action = 'VOID_RECEIPT_ATOMIC' and entity_id = $1) as audits
         from public.journal_entries where source_id::text = $1 and entity_type = 'receipt_void'`,
      [receipt2],
    );
    expect(counts).toEqual({ reversals: 2, audits: 1 });

    // New request on an already-VOID receipt: no second reversal, no new audit.
    const again = await rpcJsonb(db, 'void_receipt_atomic', {
      receipt_id: receipt2,
      reason: 'retry after void',
      request_id: 'p3a1b-void-2',
    });
    expect(again.idempotent).toBe(true);
    expect(Number(again.journal_reversal_entries)).toBe(0);
    counts = await queryOne(
      db,
      `select count(*)::int as reversals,
              (select count(*)::int from public.audit_log where action = 'VOID_RECEIPT_ATOMIC' and entity_id = $1) as audits
         from public.journal_entries where source_id::text = $1 and entity_type = 'receipt_void'`,
      [receipt2],
    );
    expect(counts).toEqual({ reversals: 2, audits: 1 });

    // Resolution by payment id resolves the same shared identity.
    const receipt1 = ids.receipt1;
    const voidByPayment = await rpcJsonb(db, 'void_receipt_atomic', {
      receipt_id: receipt1, // payments.id = receipts.id — the payment-id path covers both
      reason: 'resolved via payment identity',
      request_id: 'p3a1b-void-3',
    });
    expect(voidByPayment.success).toBe(true);
    expect(Number(voidByPayment.journal_reversal_entries)).toBe(2);
    a1 = await invoiceState(INVOICE_A1);
    expect(Number(a1!.paid_amount)).toBeCloseTo(200, 3);
    expect(a1!.status).toBe('PARTIALLY_PAID');

    // Nothing was deleted — soft-VOID doctrine.
    const after = await queryOne(
      db,
      `select (select count(*)::int from public.receipts where id::text = $1) as receipts,
              (select count(*)::int from public.payments where id::text = $1) as payments,
              (select count(*)::int from public.receipt_allocations where receipt_id::text = $1) as allocations`,
      [receipt2],
    );
    expect(after).toEqual({ receipts: 1, payments: 1, allocations: 1 });

    evidence.void = {
      scenario: 'void → retry(same req) → retry(new req) → void-by-payment-id',
      receipt2: { id: receipt2, status: r2!.status, paymentStatus: r2!.payment_status, reversalEntries: 2, balancedWithOriginals: true },
      invoiceRestored: { paid: Number(a1!.paid_amount), status: a1!.status },
      noDoubleReversal: true,
      noRecordDeletion: true,
      idempotentRetries: { sameRequest: true, newRequestOnVoidReceipt: true },
    };
  }, 120_000);

  // ── T5 · two-company isolation: every vector rejected with zero writes ─────
  it('rejects cross-company invoice/contract/receipt/account usage before any write', async () => {
    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    const preCounts = await queryOne(
      db,
      `select (select count(*)::int from public.receipts where company_id = $1::uuid) as a_receipts,
              (select count(*)::int from public.journal_entries where company_id = $1::uuid) as a_journals,
              (select count(*)::int from public.receipts where company_id = $2::uuid) as b_receipts`,
      [COMPANY_A, COMPANY_B],
    );

    // B pays A's invoice → invoice lookup is company-scoped → "not found".
    await expect(
      rpcJsonb(db, 'record_invoice_payment_atomic', {
        request_id: 'p3a1b-iso-pay',
        invoice_id: INVOICE_A1,
        amount: 10,
        method: 'CASH',
      }),
    ).rejects.toThrow(/Invoice not found/);

    // B posts a receipt on A's contract → 42501 before any insert.
    await expect(
      rpcJsonb(db, 'post_receipt_atomic', {
        request_id: 'p3a1b-iso-post',
        receipt: { contract_id: CONTRACT_A, amount: 25, channel: 'CASH', date_time: '2026-07-24' },
        allocations: [],
        journal_entries: [],
      }),
    ).rejects.toThrow(/العقد لا ينتمي/);

    // B allocates to A's invoice on its own contract → invoice validation company-scoped.
    await expect(
      rpcJsonb(db, 'post_receipt_atomic', {
        request_id: 'p3a1b-iso-alloc',
        receipt: { contract_id: CONTRACT_B, amount: 10, channel: 'CASH', date_time: '2026-07-24' },
        allocations: [{ invoice_id: INVOICE_A1, amount: 10 }],
        journal_entries: [],
      }),
    ).rejects.toThrow(/فاتورة غير موجودة/);

    // B uses A's account id inside its own receipt journal → 42501, atomic rollback.
    const cashA = await accountId(db, '1111', COMPANY_A);
    await expect(
      rpcJsonb(db, 'post_receipt_atomic', {
        request_id: 'p3a1b-iso-jr',
        receipt: { contract_id: CONTRACT_B, amount: 10, channel: 'CASH', date_time: '2026-07-24' },
        allocations: [],
        journal_entries: [{ no: 'ISO-D', date: '2026-07-24', account_id: cashA, amount: 10, type: 'DEBIT' }],
      }),
    ).rejects.toThrow(/حساب القيد لا ينتمي/);

    // B voids A's receipt → company-scoped resolution behaves exactly like P0002 not-found.
    const ids = evidence.paymentReceipt.recordLifecycle as { receipt1: string };
    await expect(
      rpcJsonb(db, 'void_receipt_atomic', {
        receipt_id: ids.receipt1,
        reason: 'cross-company attempt',
        request_id: 'p3a1b-iso-void',
      }),
    ).rejects.toThrow(/were not found/);
    const aReceipt1 = await receiptState(ids.receipt1);
    expect(aReceipt1!.status).toBe('VOID'); // untouched by A's earlier voids only — B changed nothing

    // Nothing leaked into B, nothing was written on A by B's attempts.
    const postCounts = await queryOne(
      db,
      `select (select count(*)::int from public.receipts where company_id = $1::uuid) as a_receipts,
              (select count(*)::int from public.journal_entries where company_id = $1::uuid) as a_journals,
              (select count(*)::int from public.receipts where company_id = $2::uuid) as b_receipts`,
      [COMPANY_A, COMPANY_B],
    );
    expect(postCounts).toEqual(preCounts);

    evidence.isolation = {
      scenario: 'record-on-foreign-invoice · post-on-foreign-contract · foreign allocation · foreign journal account · foreign VOID',
      vectorsRejected: 5,
      failureBeforeAnyWrite: postCounts,
      unchanged: true,
    };
  }, 120_000);

  // ── T6 · §7 cross-company idempotency isolation ────────────────────────────
  it('namespaces idempotency by company: the same request_id never replays across companies', async () => {
    // record_invoice_payment_atomic — shared request id
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const shared = await rpcJsonb(db, 'record_invoice_payment_atomic', {
      request_id: 'p3a1b-shared-pay',
      invoice_id: INVOICE_A1,
      amount: 200,
      method: 'CASH',
      date: '2026-07-24',
    });
    expect(shared.success).toBe(true);

    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    await expect(
      rpcJsonb(db, 'record_invoice_payment_atomic', {
        request_id: 'p3a1b-shared-pay',
        invoice_id: INVOICE_B1,
        amount: 50,
        method: 'CASH',
      }),
    ).rejects.toThrow(/1111 is not configured for company/); // B fails loudly, never replays A

    // post_receipt_atomic — shared request id
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const postedA = await rpcJsonb(db, 'post_receipt_atomic', {
      request_id: 'p3a1b-shared-post',
      receipt: { contract_id: CONTRACT_A, amount: 50, channel: 'CASH', date_time: '2026-07-24' },
      allocations: [],
      journal_entries: [],
    });
    expect(postedA.success).toBe(true);

    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    // B's scoped replay finds nothing; the global UNIQUE on receipts.request_id
    // then fails LOUDLY (23505) — there is no silent cross-company replay. This
    // global constraint is relaxed only in Phase 3A-2 (documented doctrine).
    await expect(
      rpcJsonb(db, 'post_receipt_atomic', {
        request_id: 'p3a1b-shared-post',
        receipt: { contract_id: CONTRACT_B, amount: 75, channel: 'CASH', date_time: '2026-07-24' },
        allocations: [],
        journal_entries: [],
      }),
    ).rejects.toThrow(/23505|duplicate key/);
    const leaked = await queryOne(db, `select count(*)::int as n from public.receipts where request_id = 'p3a1b-shared-post' and company_id = $1::uuid`, [COMPANY_B]);
    expect(leaked!.n).toBe(0);

    // void_receipt_atomic — shared request id: B gets its OWN result, not A's cached one.
    const receiptSp = String(postedA.receipt_id);
    await assumeIdentity(db, ADMIN_A, COMPANY_A);
    const voidA = await rpcJsonb(db, 'void_receipt_atomic', {
      receipt_id: receiptSp,
      reason: 'shared-id void A',
      request_id: 'p3a1b-shared-void',
    });
    expect(voidA.success).toBe(true);

    // B creates its own receipt first (post path works for B without journal entries).
    await assumeIdentity(db, ADMIN_B, COMPANY_B);
    const postedB = await rpcJsonb(db, 'post_receipt_atomic', {
      request_id: 'p3a1b-post-b',
      receipt: { contract_id: CONTRACT_B, amount: 75, channel: 'CASH', date_time: '2026-07-24' },
      allocations: [],
      journal_entries: [],
    });
    const receiptB = String(postedB.receipt_id);
    const voidB = await rpcJsonb(db, 'void_receipt_atomic', {
      receipt_id: receiptB,
      reason: 'shared-id void B',
      request_id: 'p3a1b-shared-void',
    });
    expect(voidB.success).toBe(true);
    expect(String(voidB.receipt_id)).toBe(receiptB);
    expect(String(voidB.receipt_id)).not.toBe(receiptSp);

    const { rows: idemRows } = await db.query(
      `select operation_name, request_id from public.financial_operation_idempotency
        where request_id like 'p3a1b-%' order by operation_name, request_id`,
    );
    const ops = idemRows.map((r) => String((r as { operation_name: string }).operation_name));
    // Every stored operation key is namespaced <op>:<company_uuid> — no PLAIN keys.
    expect(ops.filter((o) => o === 'record_invoice_payment_atomic' || o === 'void_receipt_atomic')).toEqual([]);
    for (const o of ops) {
      if (o.startsWith('record_invoice_payment_atomic:') || o.startsWith('void_receipt_atomic:')) {
        expect(o.endsWith(COMPANY_A) || o.endsWith(COMPANY_B)).toBe(true);
      }
    }
    const voidShared = idemRows.filter((r) => (r as { request_id: string }).request_id === 'p3a1b-shared-void');
    expect(voidShared).toHaveLength(2);
    expect(new Set(voidShared.map((r) => String((r as { operation_name: string }).operation_name))).size).toBe(2);
    const recordShared = idemRows.filter((r) => (r as { request_id: string }).request_id === 'p3a1b-shared-pay');
    expect(recordShared).toHaveLength(1);
    expect(String((recordShared[0] as { operation_name: string }).operation_name)).toBe(`record_invoice_payment_atomic:${COMPANY_A}`);

    evidence.idempotency = {
      scenario: 'same request_id executed by A and B for record / post / void',
      namespacing: '<operation_name>:<company_uuid>',
      recordShared: 'B failed loudly on canonical accounts (P0001), A response never replayed',
      postShared: 'B hit loud 23505 on the global receipts.request_id UNIQUE (raw storage kept; relax in 3A-2)',
      voidShared: 'A and B each received their OWN response',
      invoiceGeneration: 'n/a by design — generate_invoices_from_active_contracts has no request_id channel; isolation is the company-scoped contract loop',
      rows: idemRows,
    };
  }, 120_000);
});
