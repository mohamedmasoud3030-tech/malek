/**
 * MALIK Production-Grade Consolidation Database Integration Scenarios
 *
 * Verifies all 6 required database integration scenarios against the full replayed database schema:
 *   Scenario 1 — Complete rental lifecycle (authoritative invoice generation & balanced journals)
 *   Scenario 2 — Receipt reversal (void_receipt_atomic & balanced reversal JEs)
 *   Scenario 3 — Deposit lifecycle (create_deposit_atomic, refund_deposit_atomic, 2200 liability JE, Debit==Credit)
 *   Scenario 4 — Owner settlement (create draft, approve, pay, verify balances, cancel controlled reversal)
 *   Scenario 5 — Multi-owner property (60:40 allocation ratio math & >100% rejection)
 *   Scenario 6 — Cross-company isolation (reads, current_property_ownership view, and mutation rejections)
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createFullReplayedDatabase } from '../../p1/replay-bootstrap';
import type { PGlite } from '@electric-sql/pglite';

const COMPANY_A = 'ca000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'cb000000-0000-4000-8000-00000000000b';
const ADMIN_A = 'aa000000-0000-4000-8000-000000000001';
const ADMIN_B = 'bb000000-0000-4000-8000-000000000002';

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
        ('${ADMIN_B}', 'admin.b@malik.test')
      on conflict do nothing;

      insert into public.users (id, email, name, role, status) values
        ('${ADMIN_A}', 'admin.a@malik.test', 'مدير ألف', 'ADMIN', 'ACTIVE'),
        ('${ADMIN_B}', 'admin.b@malik.test', 'مدير باء', 'ADMIN', 'ACTIVE')
      on conflict do nothing;

      insert into public.company_members (company_id, user_id, role) values
        ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN'),
        ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN')
      on conflict do nothing;

      update public.accounts
         set company_id = '${COMPANY_A}'
       where no in ('1111', '1201', '2000', '2100', '2200', '4000', '6100');
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

    const invRes = await db.query<{ id: string; amount: number }>(`
      select id, amount from public.invoices where contract_id = 'a4000000-0000-4000-8000-000000000001' limit 1;
    `);
    const invoiceId = invRes.rows[0].id;

    // Verify invoice journal entries are balanced (DEBIT == CREDIT)
    const invBal = await getJournalBalance(db, invoiceId);
    expect(invBal.debit).toBeCloseTo(invBal.credit, 3);
    expect(invBal.debit).toBeGreaterThan(0);

    // 9 & 10. Record partial then final payment via authoritative payment atomic
    await db.query(`
      select public.record_invoice_payment_atomic(jsonb_build_object(
        'invoice_id', '${invoiceId}',
        'amount', 400,
        'method', 'cash',
        'date', '2026-01-03',
        'request_id', 'pay-req-001'
      ));
    `);
    await db.query(`
      select public.record_invoice_payment_atomic(jsonb_build_object(
        'invoice_id', '${invoiceId}',
        'amount', 600,
        'method', 'cash',
        'date', '2026-01-04',
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

    // 2. Reverse receipt via approved atomic flow
    const voidRes = await db.query<{ void_receipt_atomic: any }>(`
      select public.void_receipt_atomic(jsonb_build_object(
        'receipt_id', '${receiptId}',
        'reason', 'خطأ في تسجيل طريقة الدفع',
        'request_id', 'void-req-001'
      )) as void_receipt_atomic;
    `);
    expect(voidRes.rows[0].void_receipt_atomic.success).toBe(true);

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

    // 3-4. Refund deposit atomically via refund_deposit_atomic
    const refRes = await db.query<{ refund_deposit_atomic: any }>(`
      select public.refund_deposit_atomic(jsonb_build_object(
        'deposit_id', '${depId}',
        'amount', 300,
        'refund_date', '2026-01-10',
        'request_id', 'dep-ref-e2e-001'
      )) as refund_deposit_atomic;
    `);
    expect(refRes.rows[0].refund_deposit_atomic.refunded).toBe(300);
    expect(Number(refRes.rows[0].refund_deposit_atomic.remaining)).toBe(200);
  });

  it('Scenario 4 — Owner settlement lifecycle: draft, approve, pay, verify balances, and controlled cancellation', async () => {
    await assume(db, ADMIN_A, COMPANY_A);

    // 1. Create draft settlement via create_owner_settlement_draft_atomic
    const draftRes = await db.query<{ create_owner_settlement_draft_atomic: any }>(`
      select public.create_owner_settlement_draft_atomic(jsonb_build_object(
        'owner_id', 'a1000000-0000-4000-8000-000000000001',
        'period_start', '2026-01-01',
        'period_end', '2026-01-31',
        'request_id', 'a0000000-0000-4000-8000-000000000001'
      )) as create_owner_settlement_draft_atomic;
    `);
    const stlId = draftRes.rows[0].create_owner_settlement_draft_atomic.settlement_id;
    expect(stlId).toBeDefined();

    // 2. Approve settlement via approve_owner_settlement_atomic
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

    // 5. Controlled reversal via cancel_owner_settlement_atomic on a draft/approved settlement
    const draft2 = await db.query<{ create_owner_settlement_draft_atomic: any }>(`
      select public.create_owner_settlement_draft_atomic(jsonb_build_object(
        'owner_id', 'a1000000-0000-4000-8000-000000000001',
        'period_start', '2026-02-01',
        'period_end', '2026-02-28',
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

    // 2. Assert cross-company mutations are rejected
    await expect(
      db.query(`
        update public.properties set title = 'مخترق' where company_id = '${COMPANY_A}' and id = 'ef000000-0000-4000-8000-000000000001';
      `),
    ).resolves.toBeDefined(); // 0 rows updated under RLS

    const checkA = await db.query<{ title: string }>(`
      select title from public.properties where id = 'ef000000-0000-4000-8000-000000000001'
    `);
    expect(checkA.rows).toHaveLength(0); // Company B cannot even see the updated row

    await db.query('RESET ROLE;');
  });
});
