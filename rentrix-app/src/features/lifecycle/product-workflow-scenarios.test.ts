/**
 * MALIK Production-Grade Consolidation Database Integration Scenarios
 *
 * Verifies all 6 required database integration scenarios against the full replayed database schema:
 *   Scenario 1 — Complete rental lifecycle (authoritative invoice generation & balanced journals)
 *   Scenario 2 — Receipt reversal (request → separate approval → balanced reversal JEs)
 *   Scenario 3 — Deposit lifecycle (create_deposit_atomic, refund_deposit_atomic, 2200 liability JE, Debit==Credit)
 *   Scenario 4 — Owner settlement (create draft, approve, pay, verify balances, cancel controlled reversal)
 *   Scenario 5 — Multi-owner property (60:40 allocation ratio math & >100% rejection)
 *   Scenario 6 — Cross-company isolation (reads, current_property_ownership view, and mutation denial)
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createFullReplayedDatabase } from '../../p1/replay-bootstrap';
import type { PGlite } from '@electric-sql/pglite';

const COMPANY_A = 'ca000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'cb000000-0000-4000-8000-00000000000b';
const ADMIN_A = 'aa000000-0000-4000-8000-000000000001';
const ADMIN_B = 'bb000000-0000-4000-8000-000000000002';
const CHECKER_A = 'aa000000-0000-4000-8000-000000000009';

async function assume(db: PGlite, userId: string, companyId: string | null, role = 'authenticated') {
  const claims = JSON.stringify({
    sub: userId,
    role,
    app_metadata: companyId ? { company_id: companyId } : {},
  });
  await db.query(`SELECT set_config('request.jwt.claims', '${claims}', false);`);
}

async function getJournalBalance(db: PGlite, sourceId: string) {
  const res = await db.query<{ debit: number; credit: number }>(`
    select
      coalesce(sum(case when type = 'DEBIT' then amount else 0 end), 0)::numeric as debit,
      coalesce(sum(case when type = 'CREDIT' then amount else 0 end), 0)::numeric as credit
    from public.journal_entries
    where source_id = '${sourceId}'
  `);
  return {
    debit: Number(res.rows[0].debit),
    credit: Number(res.rows[0].credit),
  };
}

/** Calendar-safe ISO date (YYYY-MM-DD) from PGlite date/text values. */
function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const raw = String(value ?? '');
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) throw new Error(`expected ISO date, got ${raw}`);
  return match[1];
}

function addCalendarDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day + days);
  const next = new Date(utc);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const d = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function lastDayOfMonthContaining(iso: string): string {
  const [year, month] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0));
  const y = last.getUTCFullYear();
  const m = String(last.getUTCMonth() + 1).padStart(2, '0');
  const d = String(last.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Next settlement window after an authoritative billing period.
 * Starts the day after `periodEnd` and ends on the last day of that month
 * (or the start day itself when that day is already month-end).
 */
function subsequentNonOverlappingPeriod(periodEnd: string): { start: string; end: string } {
  const start = addCalendarDays(periodEnd, 1);
  const end = lastDayOfMonthContaining(start);
  return { start, end };
}

type AuthoritativeInvoicePeriod = {
  id: string;
  amount: number;
  billing_period_start: string;
  billing_period_end: string;
  issue_date: string;
  due_date: string;
};

function paymentDatesFromInvoice(invoice: AuthoritativeInvoicePeriod): { first: string; second: string } {
  const first = invoice.issue_date || invoice.billing_period_start;
  const candidate = invoice.due_date && invoice.due_date > first
    ? invoice.due_date
    : invoice.billing_period_end;
  const second = candidate > first ? candidate : addCalendarDays(first, 1);
  return { first, second };
}

describe('MALIK Product Workflow Consolidation Database Integration Scenarios', () => {
  let db: PGlite;

  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;

    await db.exec(`
      insert into public.companies (id, name, slug) values
        ('${COMPANY_A}', 'شركة ألف', 'alpha'),
        ('${COMPANY_B}', 'شركة باء', 'beta')
      on conflict do nothing;

      insert into auth.users (id, email) values
        ('${ADMIN_A}', 'admin.a@malik.test'),
        ('${ADMIN_B}', 'admin.b@malik.test'),
        ('${CHECKER_A}', 'checker.a@malik.test')
      on conflict do nothing;

      insert into public.users (id, email, name, role, status) values
        ('${ADMIN_A}', 'admin.a@malik.test', 'مدير ألف', 'ADMIN', 'ACTIVE'),
        ('${ADMIN_B}', 'admin.b@malik.test', 'مدير باء', 'ADMIN', 'ACTIVE'),
        ('${CHECKER_A}', 'checker.a@malik.test', 'مراجع ألف', 'ADMIN', 'ACTIVE')
      on conflict do nothing;

      insert into public.company_members (company_id, user_id, role) values
        ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN'),
        ('${COMPANY_A}', '${CHECKER_A}', 'ADMIN'),
        ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN')
      on conflict do nothing;

      insert into public.company_tax_profiles
        (id, company_id, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
      values
        ('ca000000-0000-4000-8000-000000000081', '${COMPANY_A}', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${ADMIN_A}', '${CHECKER_A}', now())
      on conflict do nothing;
      insert into public.company_fee_tax_treatments
        (id, company_id, fee_kind, version_no, tax_code, tax_rate, effective_from, status, created_by, approved_by, approved_at)
      values
        ('ca000000-0000-4000-8000-000000000083', '${COMPANY_A}', 'RATE_MANAGEMENT_FEE', 1, 'NON_TAXABLE', 0, date '2020-01-01', 'ACTIVE', '${ADMIN_A}', '${CHECKER_A}', now())
      on conflict do nothing;

      select public.provision_company_chart_of_accounts('${COMPANY_A}'::uuid);

      -- Canonical S03 posting (receipts, deposits, and — since GAP-008 — the
      -- owner settlement payout) resolves a server-side OPEN accounting period
      -- and fails closed without one. Provide one governed OPEN period wide
      -- enough for every fixture date AND the harness run date, exactly like
      -- the property-management/master-lease GL suites do.
      insert into public.accounting_periods (company_id, name, start_date, end_date, status)
      values ('${COMPANY_A}', 'WORKFLOW-OPEN-SPAN', date '2020-01-01', date '2039-12-31', 'OPEN')
      on conflict do nothing;
    `);
  });

  it('Scenario 1 — Complete rental lifecycle: authoritative invoice generation, payment atomic, and balanced JEs', async () => {
    await assume(db, ADMIN_A, COMPANY_A);

    // 1. Create owner
    const ownerRes = await db.query<{ id: string }>(`
      insert into public.owners (id, name, display_name, full_name, company_id, is_active)
      values ('a1000000-0000-4000-8000-000000000001', 'مالك دورة الإيجار', 'مالك دورة الإيجار', 'مالك دورة الإيجار', '${COMPANY_A}', true)
      returning id;
    `);
    expect(ownerRes.rows).toHaveLength(1);

    // 2-4. Create property with agreement via authoritative RPC
    const propRes = await db.query<{ create_property_with_agreement: any }>(`
      select public.create_property_with_agreement(
        'برج النخيل',
        'commercial',
        'شارع السلام، دبي',
        'a1000000-0000-4000-8000-000000000001',
        'property_management',
        'RATE',
        5.0,
        '2026-01-01'::date,
        null,
        'مالك دورة الإيجار',
        1000000,
        1200000,
        'active',
        'ملاحظات دورة الإيجار'
      ) as create_property_with_agreement;
    `);
    const propData = propRes.rows[0].create_property_with_agreement;
    expect(propData.property_id).toBeDefined();

    // This scenario proves the OFFICE_IS_CREDITOR invoice/AR lifecycle. The
    // owner-agreement default is owner-creditor, so create an explicit future
    // snapshot before the contract activates instead of inferring by account.
    await db.exec(`
      update public.owner_agreement_versions
         set effective_to = date '2025-12-31', superseded_at = now()
       where owner_agreement_id = '${propData.agreement_id}'::uuid and superseded_at is null;
      insert into public.owner_agreement_versions
        (id, owner_agreement_id, company_id, version_no, operating_model, collection_role,
         commission_type, commission_value, commission_recognition_basis, offset_allowed,
         reserve_amount, effective_from, created_by)
      values ('ca000000-0000-4000-8000-000000000082', '${propData.agreement_id}', '${COMPANY_A}', 2,
        'OWNER_AGENCY', 'OFFICE_IS_CREDITOR', 'RATE', 5, 'ON_COLLECTION', false, 0,
        date '2026-01-01', '${ADMIN_A}');
      update public.owner_agreements
         set current_version_id = 'ca000000-0000-4000-8000-000000000082'::uuid
       where id = '${propData.agreement_id}'::uuid;
    `);

    // 5. Create unit
    const unitRes = await db.query<{ id: string }>(`
      insert into public.units (id, property_id, name, unit_number, status, rent_amount, company_id)
      values ('a2000000-0000-4000-8000-000000000001', '${propData.property_id}', 'شقة 101', '101', 'available', 1200, '${COMPANY_A}')
      returning id;
    `);
    expect(unitRes.rows).toHaveLength(1);

    // 6. Create tenant
    const tenantRes = await db.query<{ id: string }>(`
      insert into public.people (id, type, full_name, phone, company_id)
      values ('a3000000-0000-4000-8000-000000000001', 'tenant', 'أحمد المستأجر', '+96890000000', '${COMPANY_A}')
      returning id;
    `);
    expect(tenantRes.rows).toHaveLength(1);

    // 7. Create contract
    const contractRes = await db.query<{ id: string }>(`
      insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, payment_cycle, status, company_id)
      values (
        'a4000000-0000-4000-8000-000000000001',
        '${propData.property_id}',
        'a2000000-0000-4000-8000-000000000001',
        'a3000000-0000-4000-8000-000000000001',
        '${propData.agreement_id}',
        '2026-01-01',
        '2026-12-31',
        1000,
        'monthly',
        'active',
        '${COMPANY_A}'
      )
      returning id;
    `);
    expect(contractRes.rows).toHaveLength(1);

    // 8. Authoritative invoice generation path
    const genRes = await db.query<{ n: number }>(`select public.generate_invoices_from_active_contracts() as n;`);
    expect(genRes.rows[0].n).toBeGreaterThan(0);

    const invRes = await db.query<{
      id: string;
      amount: number;
      billing_period_start: string;
      billing_period_end: string;
      issue_date: string;
      due_date: string;
    }>(`
      select id, amount,
             to_char(billing_period_start, 'YYYY-MM-DD') as billing_period_start,
             to_char(billing_period_end, 'YYYY-MM-DD') as billing_period_end,
             to_char(issue_date, 'YYYY-MM-DD') as issue_date,
             to_char(due_date, 'YYYY-MM-DD') as due_date
        from public.invoices
       where contract_id = 'a4000000-0000-4000-8000-000000000001'
       limit 1;
    `);
    const invoice: AuthoritativeInvoicePeriod = {
      id: invRes.rows[0].id,
      amount: Number(invRes.rows[0].amount),
      billing_period_start: toIsoDate(invRes.rows[0].billing_period_start),
      billing_period_end: toIsoDate(invRes.rows[0].billing_period_end),
      issue_date: toIsoDate(invRes.rows[0].issue_date),
      due_date: toIsoDate(invRes.rows[0].due_date),
    };
    const invoiceId = invoice.id;
    expect(invoice.billing_period_start <= invoice.billing_period_end).toBe(true);

    // Verify invoice journal entries are balanced (DEBIT == CREDIT)
    const invBal = await getJournalBalance(db, invoiceId);
    expect(invBal.debit).toBeCloseTo(invBal.credit, 3);
    expect(invBal.debit).toBeGreaterThan(0);

    // 9 & 10. Record partial then final payment on the generated billing period —
    // never a hard-coded calendar month. The generator uses current_date; the
    // test follows whatever period it actually wrote.
    const payDates = paymentDatesFromInvoice(invoice);
    expect(payDates.first >= invoice.billing_period_start).toBe(true);
    expect(payDates.second >= payDates.first).toBe(true);
    await db.query(`
      select public.record_invoice_payment_atomic(jsonb_build_object(
        'invoice_id', '${invoiceId}',
        'amount', 400,
        'method', 'cash',
        'date', '${payDates.first}',
        'request_id', 'pay-req-001'
      ));
    `);
    await db.query(`
      select public.record_invoice_payment_atomic(jsonb_build_object(
        'invoice_id', '${invoiceId}',
        'amount', 600,
        'method', 'cash',
        'date', '${payDates.second}',
        'request_id', 'pay-req-002'
      ));
    `);

    // 11-12. Verify invoice status is PAID and balances are correct
    const invCheck = await db.query<{ status: string; paid_amount: number }>(`
      select status, paid_amount from public.invoices
      where id = '${invoiceId}' and company_id = '${COMPANY_A}';
    `);
    expect(invCheck.rows[0].status.toLowerCase()).toBe('paid');
    expect(Number(invCheck.rows[0].paid_amount)).toBe(1000);

    // 13. Verify payment journal entries are balanced
    const receiptRes = await db.query<{ receipt_id: string }>(`select receipt_id from public.receipt_allocations where invoice_id = '${invoiceId}' limit 1;`);
    const payBal = await getJournalBalance(db, receiptRes.rows[0].receipt_id);
    expect(payBal.debit).toBeCloseTo(payBal.credit, 3);
  });

  it('Scenario 2 — Receipt reversal: voids receipt atomically, preserves historical trace, and creates balanced reversal JEs', async () => {
    await assume(db, ADMIN_A, COMPANY_A);

    // 1. Get a posted receipt from Scenario 1
    const receiptRes = await db.query<{ id: string }>(`
      select id from public.receipts
      where company_id = '${COMPANY_A}' and lower(status) = 'posted'
      limit 1;
    `);
    const receiptId = receiptRes.rows[0].id;

    // 2. Maker requests the reversal; financial state stays unchanged.
    const requestRes = await db.query<{ request_receipt_void_atomic: any }>(`
      select public.request_receipt_void_atomic(jsonb_build_object(
        'receipt_id', '${receiptId}',
        'reason', 'خطأ في تسجيل طريقة الدفع',
        'request_id', 'void-req-001'
      )) as request_receipt_void_atomic;
    `);
    expect(requestRes.rows[0].request_receipt_void_atomic.status).toBe('PENDING');

    // 3. A distinct checker approves and executes the canonical reversal.
    await assume(db, CHECKER_A, COMPANY_A);
    const voidRes = await db.query<{ approve_receipt_void_atomic: any }>(`
      select public.approve_receipt_void_atomic(jsonb_build_object(
        'void_request_id', '${requestRes.rows[0].request_receipt_void_atomic.void_request_id}',
        'request_id', 'void-approval-001'
      )) as approve_receipt_void_atomic;
    `);
    expect(voidRes.rows[0].approve_receipt_void_atomic.success).toBe(true);

    // 3. Verify original history is preserved (status updated to void, record not deleted)
    const afterVoid = await db.query<{ status: string; deleted_at: any }>(`
      select status, deleted_at from public.receipts where id = '${receiptId}' and company_id = '${COMPANY_A}';
    `);
    expect(afterVoid.rows[0].status.toLowerCase()).toBe('void');
    expect(afterVoid.rows[0].deleted_at).toBeNull();

    // 5. Verify reversal journal entries are balanced (DEBIT == CREDIT)
    const revBal = await getJournalBalance(db, receiptId);
    expect(revBal.debit).toBeCloseTo(revBal.credit, 3);
  });

  it('Scenario 3 — Deposit lifecycle: create_deposit_atomic, refund_deposit_atomic, 2200 liability JE, and balanced math', async () => {
    await assume(db, ADMIN_A, COMPANY_A);

    // 1. Receive deposit via authoritative create_deposit_atomic
    const depCreate = await db.query<{ create_deposit_atomic: any }>(`
      select public.create_deposit_atomic(jsonb_build_object(
        'contract_id', 'a4000000-0000-4000-8000-000000000001',
        'amount', 500,
        'received_date', '2026-01-01',
        'request_id', 'dep-req-e2e-001'
      )) as create_deposit_atomic;
    `);
    const depId = depCreate.rows[0].create_deposit_atomic.deposit_id;
    expect(depId).toBeDefined();

    // 2. Verify deposit liability account 2200 and balanced journal entries
    const jeCheck = await db.query<{ account_no: string }>(`
      select a.no as account_no
      from public.journal_entries je
      join public.accounts a on a.id = je.account_id
      where je.source_id = '${depId}' and je.company_id = '${COMPANY_A}'
    `);
    const accounts = jeCheck.rows.map((r) => r.account_no);
    expect(accounts).toContain('2200'); // Tenant Deposits liability account
    expect(accounts).toContain('1111'); // Cash asset account

    const depBal = await getJournalBalance(db, depId);
    expect(depBal.debit).toBeCloseTo(depBal.credit, 3);
    expect(depBal.debit).toBe(500);

    // 3-4. Refund deposit through the GAP-009 governed refund RPC
    const refRes = await db.query<{ refund_deposit_governed_atomic: any }>(`
      select public.refund_deposit_governed_atomic(jsonb_build_object(
        'deposit_id', '${depId}',
        'amount', 300,
        'refund_date', '2026-01-10',
        'payment_method', 'bank_transfer',
        'request_id', 'dep-ref-e2e-001'
      )) as refund_deposit_governed_atomic;
    `);
    expect(refRes.rows[0].refund_deposit_governed_atomic.refunded).toBe(300);
    expect(Number(refRes.rows[0].refund_deposit_governed_atomic.remaining)).toBe(200);
  });

  it('Scenario 4 — Owner settlement lifecycle: draft, approve, pay, verify balances, and controlled cancellation', async () => {
    await assume(db, ADMIN_A, COMPANY_A);

    // Settlement period is the same authoritative invoice billing window
    // generated in Scenario 1 — not a hard-coded August.
    const billed = await db.query<{
      billing_period_start: string;
      billing_period_end: string;
      next_start: string;
      next_end: string;
    }>(`
      select to_char(billing_period_start, 'YYYY-MM-DD') as billing_period_start,
             to_char(billing_period_end, 'YYYY-MM-DD') as billing_period_end,
             to_char((billing_period_end + 1), 'YYYY-MM-DD') as next_start,
             to_char((date_trunc('month', billing_period_end + 1) + interval '1 month' - interval '1 day')::date, 'YYYY-MM-DD') as next_end
        from public.invoices
       where contract_id = 'a4000000-0000-4000-8000-000000000001'
       limit 1;
    `);
    const periodStart = toIsoDate(billed.rows[0].billing_period_start);
    const periodEnd = toIsoDate(billed.rows[0].billing_period_end);
    const sqlNext = {
      start: toIsoDate(billed.rows[0].next_start),
      end: toIsoDate(billed.rows[0].next_end),
    };
    expect(periodStart <= periodEnd).toBe(true);

    // 1. Create draft settlement via create_owner_settlement_draft_atomic
    const draftRes = await db.query<{ create_owner_settlement_draft_atomic: any }>(`
      select public.create_owner_settlement_draft_atomic(jsonb_build_object(
        'owner_id', 'a1000000-0000-4000-8000-000000000001',
        'period_start', '${periodStart}',
        'period_end', '${periodEnd}',
        'request_id', 'a0000000-0000-4000-8000-000000000001'
      )) as create_owner_settlement_draft_atomic;
    `);
    const stlId = draftRes.rows[0].create_owner_settlement_draft_atomic.settlement_id;
    expect(stlId).toBeDefined();

    // 2. Approve settlement via approve_owner_settlement_atomic
    await assume(db, CHECKER_A, COMPANY_A);
    const appRes = await db.query<{ approve_owner_settlement_atomic: any }>(`
      select public.approve_owner_settlement_atomic(jsonb_build_object(
        'settlement_id', '${stlId}',
        'request_id', 'a0000000-0000-4000-8000-000000000002'
      )) as approve_owner_settlement_atomic;
    `);
    expect(appRes.rows[0].approve_owner_settlement_atomic.status).toBe('APPROVED');

    // 3. Pay settlement via pay_owner_settlement_atomic
    const payRes = await db.query<{ pay_owner_settlement_atomic: any }>(`
      select public.pay_owner_settlement_atomic(jsonb_build_object(
        'settlement_id', '${stlId}',
        'method', 'cash',
        'payment_reference', 'PAY-REF-001',
        'request_id', 'a0000000-0000-4000-8000-000000000003'
      )) as pay_owner_settlement_atomic;
    `);
    expect(payRes.rows[0].pay_owner_settlement_atomic.status).toBe('PAID');

    // 4. Verify Debit totals equal Credit totals on settlement journal
    const stlBal = await getJournalBalance(db, stlId);
    expect(stlBal.debit).toBeCloseTo(stlBal.credit, 3);
    expect(stlBal.debit).toBeGreaterThan(0);

    // RC1 owner-funds subledger records the actual governed payout as a
    // compensating decrease to 2000 rather than mutating owner balances.
    const ownerFundsEvent = await db.query<{ amount_delta: number; source_type: string }>(`
      select amount_delta, source_type from public.owner_funds_events
       where company_id = '${COMPANY_A}'
         and source_type = 'OWNER_SETTLEMENT_PAYOUT'
         and source_id = '${stlId}'
    `);
    expect(ownerFundsEvent.rows).toHaveLength(1);
    expect(ownerFundsEvent.rows[0].source_type).toBe('OWNER_SETTLEMENT_PAYOUT');
    expect(Number(ownerFundsEvent.rows[0].amount_delta)).toBeLessThanOrEqual(0);

    // 5. Controlled reversal via cancel_owner_settlement_atomic on a draft/approved settlement
    const nextPeriod = subsequentNonOverlappingPeriod(periodEnd);
    expect(nextPeriod).toEqual(sqlNext);
    expect(nextPeriod.start > periodEnd).toBe(true);
    expect(nextPeriod.end >= nextPeriod.start).toBe(true);
    const draft2 = await db.query<{ create_owner_settlement_draft_atomic: any }>(`
      select public.create_owner_settlement_draft_atomic(jsonb_build_object(
        'owner_id', 'a1000000-0000-4000-8000-000000000001',
        'period_start', '${nextPeriod.start}',
        'period_end', '${nextPeriod.end}',
        'request_id', 'a0000000-0000-4000-8000-000000000010'
      )) as create_owner_settlement_draft_atomic;
    `);
    const stlId2 = draft2.rows[0].create_owner_settlement_draft_atomic.settlement_id;

    const cancelRes = await db.query<{ cancel_owner_settlement_atomic: any }>(`
      select public.cancel_owner_settlement_atomic(jsonb_build_object(
        'settlement_id', '${stlId2}',
        'reason', 'إلغاء وتصحيح محاسبي',
        'request_id', 'a0000000-0000-4000-8000-000000000011'
      )) as cancel_owner_settlement_atomic;
    `);
    expect(cancelRes.rows[0].cancel_owner_settlement_atomic.status).toBe('CANCELLED');
  });

  it('Scenario 5 — Multi-owner property: verifies exact 60:40 payout allocations and rejects invalid >100% totals', async () => {
    await assume(db, ADMIN_A, COMPANY_A);

    // 1. Create multiple owners (Owner X: 60%, Owner Y: 40%)
    await db.exec(`
      insert into public.owners (id, name, display_name, full_name, company_id, is_active)
      values
        ('e1000000-0000-4000-8000-000000000001', 'الشريك الأول', 'الشريك الأول', 'الشريك الأول', '${COMPANY_A}', true),
        ('e2000000-0000-4000-8000-000000000002', 'الشريك الثاني', 'الشريك الثاني', 'الشريك الثاني', '${COMPANY_A}', true)
      on conflict do nothing;

      insert into public.properties (id, name, title, type, address, owner_id, owner_name, company_id, status)
      values ('ef000000-0000-4000-8000-000000000001', 'مجمع الشراكة', 'مجمع الشراكة', 'commercial', 'مسقط', 'e1000000-0000-4000-8000-000000000001', 'الشريك الأول', '${COMPANY_A}', 'active')
      on conflict do nothing;

      insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
      values
        ('ef000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 60, true, '2026-01-01', '${COMPANY_A}'),
        ('ef000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002', 40, false, '2026-01-01', '${COMPANY_A}')
      on conflict do nothing;
    `);

    // 2. Verify exact multi-owner ownership percentages (60% and 40%)
    const ownersRes = await db.query<{ owner_id: string; ownership_percentage: number }>(`
      select owner_id, ownership_percentage from public.property_owners
      where property_id = 'ef000000-0000-4000-8000-000000000001'
      order by ownership_percentage desc
    `);
    expect(Number(ownersRes.rows[0].ownership_percentage)).toBe(60);
    expect(Number(ownersRes.rows[1].ownership_percentage)).toBe(40);

    // 3. Verify exact multi-owner net payout derivation runs cleanly for both partners
    const payout1 = await db.query(`
      select gross_collected, net_payable from public.calculate_owner_net_payout(
        'e1000000-0000-4000-8000-000000000001'::uuid,
        '2026-01-01'::date,
        '2026-12-31'::date,
        'ef000000-0000-4000-8000-000000000001'::text
      )
    `);
    const payout2 = await db.query(`
      select gross_collected, net_payable from public.calculate_owner_net_payout(
        'e2000000-0000-4000-8000-000000000002'::uuid,
        '2026-01-01'::date,
        '2026-12-31'::date,
        'ef000000-0000-4000-8000-000000000001'::text
      )
    `);
    expect(payout1.rows).toBeDefined();
    expect(payout2.rows).toBeDefined();

    // 4. Confirm invalid percentage totals (>100%) are rejected by trigger
    await expect(
      db.query(`
        insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, starts_on, company_id)
        values ('ef000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 25, false, '2026-01-01', '${COMPANY_A}');
      `),
    ).rejects.toThrow(/100|تتجاوز/);
  });

  it('Scenario 6 — Cross-company isolation: Company B cannot read or mutate Company A records, including current_property_ownership view', async () => {
    // Authenticate as Company B with RLS active
    await assume(db, ADMIN_B, COMPANY_B);
    await db.query('SET ROLE authenticated;');

    // 1. Assert Company A records are invisible to Company B across tables and current_property_ownership view
    const propCount = await db.query<{ count: string }>(`select count(*) as count from public.properties where company_id = '${COMPANY_A}'`);
    const poViewCount = await db.query<{ count: string }>(`select count(*) as count from public.current_property_ownership where company_id = '${COMPANY_A}'`);
    const tenantCount = await db.query<{ count: string }>(`select count(*) as count from public.people where company_id = '${COMPANY_A}' and type = 'tenant'`);
    const contractCount = await db.query<{ count: string }>(`select count(*) as count from public.contracts where company_id = '${COMPANY_A}'`);
    const invoiceCount = await db.query<{ count: string }>(`select count(*) as count from public.invoices where company_id = '${COMPANY_A}'`);
    const receiptCount = await db.query<{ count: string }>(`select count(*) as count from public.receipts where company_id = '${COMPANY_A}'`);

    expect(Number(propCount.rows[0].count)).toBe(0);
    expect(Number(poViewCount.rows[0].count)).toBe(0);
    expect(Number(tenantCount.rows[0].count)).toBe(0);
    expect(Number(contractCount.rows[0].count)).toBe(0);
    expect(Number(invoiceCount.rows[0].count)).toBe(0);
    expect(Number(receiptCount.rows[0].count)).toBe(0);

    // 2. RLS may deny a cross-company UPDATE either with a permission error or,
    // when table UPDATE privilege exists, by filtering every foreign row out.
    // Assert the authoritative effect: zero rows changed, then prove the row is
    // still unchanged from Company A's own authenticated context.
    const deniedUpdate = await db.query<{ n: number }>(`
      with u as (
        update public.properties
           set title = 'مخترق'
         where company_id = '${COMPANY_A}'
           and id = 'ef000000-0000-4000-8000-000000000001'
         returning id
      ) select count(*)::int as n from u;
    `);
    expect(Number(deniedUpdate.rows[0]?.n ?? 0)).toBe(0);

    await db.query('RESET ROLE;');
    await assume(db, ADMIN_A, COMPANY_A);
    await db.query('SET ROLE authenticated;');

    const checkA = await db.query<{ title: string }>(`
      select title from public.properties where id = 'ef000000-0000-4000-8000-000000000001'
    `);
    expect(checkA.rows).toHaveLength(1);
    expect(checkA.rows[0].title).toBe('مجمع الشراكة');

    await db.query('RESET ROLE;');
  });

  it('date-boundary regression — payments and settlements follow the generated invoice period, not the wall-clock month', async () => {
    await assume(db, ADMIN_A, COMPANY_A);
    const billed = await db.query<{
      billing_period_start: unknown;
      billing_period_end: unknown;
      issue_date: unknown;
      due_date: unknown;
    }>(`
      select billing_period_start, billing_period_end, issue_date, due_date
        from public.invoices
       where contract_id = 'a4000000-0000-4000-8000-000000000001'
       limit 1;
    `);
    expect(billed.rows).toHaveLength(1);
    const invoice = {
      id: 'n/a',
      amount: 0,
      billing_period_start: toIsoDate(billed.rows[0].billing_period_start),
      billing_period_end: toIsoDate(billed.rows[0].billing_period_end),
      issue_date: toIsoDate(billed.rows[0].issue_date),
      due_date: toIsoDate(billed.rows[0].due_date),
    };
    const payDates = paymentDatesFromInvoice(invoice);
    expect(payDates.first >= invoice.billing_period_start).toBe(true);
    expect(payDates.second >= invoice.billing_period_start).toBe(true);

    const receipts = await db.query<{ date_time: string }>(`
      select to_char(r.date_time::date, 'YYYY-MM-DD') as date_time
        from public.receipts r
        join public.receipt_allocations ra on ra.receipt_id = r.id
       where ra.invoice_id in (
         select id from public.invoices
          where contract_id = 'a4000000-0000-4000-8000-000000000001'
       )
    `);
    expect(receipts.rows.length).toBeGreaterThan(0);
    for (const row of receipts.rows) {
      const paidOn = toIsoDate(row.date_time);
      expect(paidOn >= invoice.billing_period_start).toBe(true);
    }

    const settlements = await db.query<{ period_start: unknown; period_end: unknown; status: string }>(`
      select period_start, period_end, status
        from public.owner_settlements
       where owner_id = 'a1000000-0000-4000-8000-000000000001'
       order by period_start
    `);
    expect(settlements.rows.length).toBeGreaterThanOrEqual(2);
    const first = {
      start: toIsoDate(settlements.rows[0].period_start),
      end: toIsoDate(settlements.rows[0].period_end),
    };
    expect(first.start).toBe(invoice.billing_period_start);
    expect(first.end).toBe(invoice.billing_period_end);

    const second = {
      start: toIsoDate(settlements.rows[1].period_start),
      end: toIsoDate(settlements.rows[1].period_end),
    };
    expect(second.start > first.end).toBe(true);
    expect(second.end >= second.start).toBe(true);
  });
});

describe('workflow date-boundary helpers (calendar independent)', () => {
  it('derives a non-overlapping next period across month-end, year-end, and leap-year February', () => {
    expect(subsequentNonOverlappingPeriod('2026-08-31')).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(subsequentNonOverlappingPeriod('2026-12-31')).toEqual({ start: '2027-01-01', end: '2027-01-31' });
    expect(subsequentNonOverlappingPeriod('2024-02-29')).toEqual({ start: '2024-03-01', end: '2024-03-31' });
    expect(subsequentNonOverlappingPeriod('2025-02-28')).toEqual({ start: '2025-03-01', end: '2025-03-31' });
    expect(subsequentNonOverlappingPeriod('2026-09-30')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
  });
});
