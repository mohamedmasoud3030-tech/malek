import { getInvoiceRemainingAmount } from './invoices/invoice-amounts';
/**
 * PHASE 3 — Credit / Reversal / AR Allocation Integrity.
 *
 * Proves against a full migration replay that invoice credits and their
 * reversals:
 *   - leave the original posted invoice immutable,
 *   - reduce the derived outstanding balance and reconcile to the 1201 AR
 *     control account,
 *   - post balanced, canonical journal batches,
 *   - enforce credit ceilings, duplicate-reversal rejection and idempotency,
 *   - reject cross-company credits,
 *   - drive derived invoice status (UNPAID / PARTIALLY_PAID / PAID).
 * See docs/audits/FINANCIAL_HARDENING_AUDIT_20260815.md (F05, F06, F11, F12, F29).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { assumeIdentity } from '../../p1/replay-bootstrap';

import { COMPANY, MAKER, OTHER, OTHER_COMPANY, RENT, createOfficeCreditorFixture } from '../../test/office-creditor-fixture';

let db: PGlite;
let invoiceId = '';

async function rpc(name: string, payload: Record<string, unknown>) {
  const { rows } = await db.query<{ value: string }>(
    `select public.${name}($1::jsonb)::text as value`,
    [JSON.stringify(payload)],
  );
  return JSON.parse(rows[0]?.value ?? '{}') as Record<string, unknown>;
}

async function glBalance(accountNo: string): Promise<number> {
  const { rows } = await db.query<{ value: string }>(
    `select coalesce(sum(l.debit - l.credit), 0)::text as value
       from public.journal_lines l
       join public.journal_batches b on b.id = l.batch_id
       join public.accounts a on a.id = l.account_id
      where b.company_id = $1::uuid
        and b.status in ('POSTED', 'REVERSED')
        and a.no = $2`,
    [COMPANY, accountNo],
  );
  return Number(rows[0]?.value ?? 0);
}

async function invoiceState() {
  const { rows } = await db.query<{ amount: string; tax_amount: string; paid_amount: string; credited_amount: string; status: string; issue_date: string; due_date: string; outstanding: string }>(
    `select amount::text as amount, tax_amount::text as tax_amount,
            paid_amount::text as paid_amount, credited_amount::text as credited_amount,
            status, issue_date::text as issue_date, due_date::text as due_date,
            greatest(0, round(amount + tax_amount - paid_amount - credited_amount, 3))::text as outstanding
       from public.invoices where id::text = $1`,
    [invoiceId],
  );
  const row = rows[0];
  expect(getInvoiceRemainingAmount({
    amount: Number(row.amount), tax_amount: Number(row.tax_amount),
    paid_amount: Number(row.paid_amount), credited_amount: Number(row.credited_amount),
  })).toBe(Number(row.outstanding));
  return row;
}

beforeAll(async () => {
  ({ db, invoiceId } = await createOfficeCreditorFixture());
}, 420_000);

afterAll(async () => {
  await db?.close();
});

describe('PHASE 3 — credit / reversal / AR allocation integrity', () => {
  it('posting the invoice creates AR and a canonical balanced journal', async () => {
    expect(await glBalance('1201')).toBe(RENT);
    const st = await invoiceState();
    expect(Number(st.amount)).toBe(RENT);
    expect(Number(st.tax_amount)).toBe(0);
    expect(Number(st.credited_amount)).toBe(0);
    expect(st.status).toBe('UNPAID');
  });

  it('a partial credit reduces outstanding, reconciles AR, and leaves the original immutable', async () => {
    const credit = await rpc('create_invoice_credit_atomic', {
      invoice_id: invoiceId,
      amount: 250,
      credit_type: 'PARTIAL',
      reason: 'Agreed concession on August rent',
      request_id: 'p3-credit-1',
    });
    expect(credit.success).toBe(true);
    expect(credit.outstanding_after).toBe(String(750));

    const st = await invoiceState();
    expect(Number(st.credited_amount)).toBe(250);
    expect(st.status).toBe('PARTIALLY_PAID');
    // Original invoice financial fields unchanged.
    expect(Number(st.amount)).toBe(RENT);
    expect(Number(st.tax_amount)).toBe(0);
    // AR control account reconciles to the derived outstanding (1000 - 250).
    expect(await glBalance('1201')).toBe(750);

    // Canonical balanced credit journal exists.
    const { rows } = await db.query<{ diff: string }>(
      `select (sum(l.debit) - sum(l.credit))::text as diff
         from public.journal_lines l join public.journal_batches b on b.id = l.batch_id
        where b.company_id = $1 and b.source_type = 'invoice_credit' and b.status = 'POSTED'`,
      [COMPANY],
    );
    expect(Number(rows[0].diff)).toBe(0);
  });

  it('is idempotent under replay of the same request', async () => {
    const again = await rpc('create_invoice_credit_atomic', {
      invoice_id: invoiceId,
      amount: 250,
      credit_type: 'PARTIAL',
      reason: 'Agreed concession on August rent',
      request_id: 'p3-credit-1',
    });
    expect(again.success).toBe(true);
    expect(String(again.credit_id)).toBeDefined();
    // credited_amount must not double-count.
    expect(Number((await invoiceState()).credited_amount)).toBe(250);
  });

  it('rejects a credit exceeding the eligible outstanding (ceiling)', async () => {
    await expect(
      db.query(`select public.create_invoice_credit_atomic('{"invoice_id":"${invoiceId}","amount":99999,"credit_type":"PARTIAL","reason":"too much","request_id":"p3-credit-over"}'::jsonb)`),
    ).rejects.toThrow(/CREDIT_EXCEEDS_OUTSTANDING/);
  });

  it('rejects a cross-company credit (isolation)', async () => {
    await assumeIdentity(db, OTHER, OTHER_COMPANY);
    await expect(
      db.query(`select public.create_invoice_credit_atomic('{"invoice_id":"${invoiceId}","amount":100,"credit_type":"PARTIAL","reason":"x","request_id":"p3-credit-x-iso"}'::jsonb)`),
    ).rejects.toThrow(/CREDIT_INVOICE_NOT_FOUND_OR_FORBIDDEN|42501/);
    await assumeIdentity(db, MAKER, COMPANY);
  });

  it('a credit that fully clears the invoice drives status PAID and AR to zero', async () => {
    const credit = await rpc('create_invoice_credit_atomic', {
      invoice_id: invoiceId,
      amount: 750,
      credit_type: 'FULL',
      reason: 'Full concession for the period',
      request_id: 'p3-credit-2',
    });
    expect(credit.success).toBe(true);
    expect(Number((await invoiceState()).credited_amount)).toBe(1000);
    expect((await invoiceState()).status).toBe('PAID');
    expect(await glBalance('1201')).toBe(0);
  });

  it('reverses a posted credit (compensating) and restores AR', async () => {
    // Reverse the 250 credit.
    const { rows: credits } = await db.query<{ id: string }>(
      `select id from public.invoice_credits where company_id=$1 and status='POSTED' order by created_at limit 1`, [COMPANY],
    );
    const creditId = credits[0].id;
    const rev = await rpc('reverse_invoice_credit_atomic', {
      credit_id: creditId,
      reason: 'Credit entered in error',
      request_id: 'p3-rev-1',
    });
    expect(rev.success).toBe(true);
    // credited_amount 1000 -> 750, AR 0 -> 250, status PARTIALLY_PAID.
    expect(Number((await invoiceState()).credited_amount)).toBe(750);
    expect((await invoiceState()).status).toBe('PARTIALLY_PAID');
    expect(await glBalance('1201')).toBe(250);
  });

  it('rejects reversing the same credit twice (duplicate reversal)', async () => {
    const { rows: credits } = await db.query<{ id: string }>(
      `select id from public.invoice_credits where company_id=$1 and status='REVERSED' order by created_at limit 1`, [COMPANY],
    );
    await expect(
      db.query(`select public.reverse_invoice_credit_atomic('{"credit_id":"${credits[0].id}","reason":"again","request_id":"p3-rev-dup"}'::jsonb)`),
    ).rejects.toThrow(/CREDIT_ALREADY_REVERSED/);
  });

  it('keeps AR reconciliation consistent after credits and reversals', async () => {
    // After reversal: credited 750, outstanding 250, AR 250. Subledger (via
    // wp05) equals AR control account.
    const { rows } = await db.query<{ balance: string }>(
      `select balance::text as balance from public.wp05_subledger_tenant_receivables($1::uuid, current_date)`, [COMPANY],
    );
    expect(Number(rows[0].balance)).toBe(250);
    expect(await glBalance('1201')).toBe(250);
  });
});
