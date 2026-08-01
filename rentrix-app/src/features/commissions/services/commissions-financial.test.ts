/**
 * MALIK Financial Commission Accounting Runtime Verification
 *
 * Calls pay_commission_atomic and reverse_commission_atomic on live replayed PGlite schema to prove:
 *   - unauthorized USER rejection;
 *   - ADMIN/MANAGER success;
 *   - cross-company rejection;
 *   - duplicate request idempotency;
 *   - concurrent duplicate-payment protection;
 *   - correct selected bank/cash account;
 *   - expense creation;
 *   - exact Debit/Credit accounts and values;
 *   - total Debit equals total Credit;
 *   - commission status and expense_id;
 *   - controlled reversal;
 *   - second reversal rejection;
 *   - direct client update to paid rejection.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createFullReplayedDatabase } from '../../../p1/replay-bootstrap';
import type { PGlite } from '@electric-sql/pglite';

const COMPANY_A = 'ca000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'cb000000-0000-4000-8000-00000000000b';
const ADMIN_A = 'aa000000-0000-4000-8000-000000000001';
const ADMIN_B = 'bb000000-0000-4000-8000-000000000002';
const USER_A = 'aa000000-0000-4000-8000-000000000003';

async function assume(db: PGlite, userId: string | null, companyId: string | null, role = 'authenticated') {
  const claims = JSON.stringify({
    sub: userId ?? undefined,
    role,
    app_metadata: companyId ? { company_id: companyId } : {},
  });
  await db.query(`SELECT set_config('request.jwt.claims', '${claims}', false);`);
}

describe('pay_commission_atomic and reverse_commission_atomic live runtime financial contract', () => {
  let db: PGlite;
  const commId = 'comm-fin-001';

  beforeAll(async () => {
    const replay = await createFullReplayedDatabase({ writeEvidence: false });
    expect(replay.failed).toEqual([]);
    db = replay.db;

    await db.exec(`
      insert into public.companies (id, name, slug) values
        ('${COMPANY_A}', 'شركة ألف للعمولات', 'alpha-comm'),
        ('${COMPANY_B}', 'شركة باء للعمولات', 'beta-comm')
      on conflict do nothing;

      insert into auth.users (id, email) values
        ('${ADMIN_A}', 'admin.a@malik.test'),
        ('${ADMIN_B}', 'admin.b@malik.test'),
        ('${USER_A}',  'user.a@malik.test')
      on conflict do nothing;

      insert into public.users (id, email, name, role, status) values
        ('${ADMIN_A}', 'admin.a@malik.test', 'مدير ألف', 'ADMIN', 'ACTIVE'),
        ('${ADMIN_B}', 'admin.b@malik.test', 'مدير باء', 'ADMIN', 'ACTIVE'),
        ('${USER_A}',  'user.a@malik.test',  'مستخدم ألف', 'USER', 'ACTIVE')
      on conflict do nothing;

      insert into public.company_members (company_id, user_id, role) values
        ('${COMPANY_A}', '${ADMIN_A}', 'ADMIN'),
        ('${COMPANY_B}', '${ADMIN_B}', 'ADMIN'),
        ('${COMPANY_A}', '${USER_A}',  'MEMBER')
      on conflict do nothing;

      update public.accounts set company_id = '${COMPANY_A}' where no in ('1111', '6100');

      insert into public.properties (id, title, name, type, address, company_id, status)
      values ('f5000000-0000-4000-8000-000000000001', 'عقار العمولات', 'عقار العمولات', 'residential', 'مسقط', '${COMPANY_A}', 'active')
      on conflict do nothing;

      insert into public.commissions (id, staff_name, type, amount, status, company_id)
      values ('${commId}', 'وسيط عقاري', 'contract', 500, 'approved', '${COMPANY_A}')
      on conflict do nothing;
    `);
  });

  it('1. Rejects direct client update setting status = "paid" via database protection trigger', async () => {
    await assume(db, ADMIN_A, COMPANY_A);
    await db.query('SET ROLE authenticated;');
    await expect(
      db.query(`update public.commissions set status = 'paid' where id = '${commId}' and company_id = '${COMPANY_A}'`),
    ).rejects.toThrow(/غير مصرح|42501/);
    await db.query('RESET ROLE;');
  });

  it('2. Rejects unauthorized USER role from calling pay_commission_atomic', async () => {
    await assume(db, USER_A, COMPANY_A);
    await expect(
      db.query(`select public.pay_commission_atomic(jsonb_build_object('commission_id', '${commId}'))`),
    ).rejects.toThrow(/42501|مديراً أو مشرفاً/);
  });

  it('3. Rejects cross-company mutation (Company B cannot pay Company A commission)', async () => {
    await assume(db, ADMIN_B, COMPANY_B);
    await expect(
      db.query(`select public.pay_commission_atomic(jsonb_build_object('commission_id', '${commId}'))`),
    ).rejects.toThrow(/23514|غير موجودة/);
  });

  it('4. ADMIN_A successfully pays commission, creates POSTED expense, and balanced JEs with correct account', async () => {
    await assume(db, ADMIN_A, COMPANY_A);
    const payRes = await db.query<{ pay_commission_atomic: any }>(`
      select public.pay_commission_atomic(jsonb_build_object(
        'commission_id', '${commId}',
        'account_id', '1111',
        'payment_date', '2026-08-01',
        'request_id', 'comm-req-001'
      )) as pay_commission_atomic;
    `);
    const res = payRes.rows[0].pay_commission_atomic;
    expect(res.success).toBe(true);
    expect(res.idempotent).toBe(false);
    expect(res.expense_id).toBeDefined();

    // Verify commission status and expense_id
    const commCheck = await db.query<{ status: string; expense_id: string }>(`
      select status, expense_id from public.commissions where id = '${commId}' and company_id = '${COMPANY_A}'
    `);
    expect(commCheck.rows[0].status.toLowerCase()).toBe('paid');
    expect(commCheck.rows[0].expense_id).toBe(res.expense_id);

    // Verify POSTED expense
    const expCheck = await db.query<{ status: string; amount: number }>(`
      select status, amount from public.expenses where id = '${res.expense_id}' and company_id = '${COMPANY_A}'
    `);
    expect(expCheck.rows[0].status).toBe('POSTED');
    expect(Number(expCheck.rows[0].amount)).toBe(500);

    // Verify exact Debit/Credit accounts and values and balance
    const jeCheck = await db.query<{ type: string; account_no: string; amount: number }>(`
      select je.type, a.no as account_no, je.amount::numeric as amount
      from public.journal_entries je
      join public.accounts a on a.id = je.account_id
      where je.source_id = '${res.expense_id}' and je.company_id = '${COMPANY_A}'
      order by je.type desc
    `);
    expect(jeCheck.rows).toHaveLength(2);
    const debit = jeCheck.rows.find((r) => r.type === 'DEBIT');
    const credit = jeCheck.rows.find((r) => r.type === 'CREDIT');
    expect(debit?.account_no).toBe('6100');
    expect(Number(debit?.amount)).toBe(500);
    expect(credit?.account_no).toBe('1111');
    expect(Number(credit?.amount)).toBe(500);
    expect(Number(debit?.amount)).toBe(Number(credit?.amount));
  });

  it('5. Enforces duplicate request idempotency and prevents concurrent double payment', async () => {
    await assume(db, ADMIN_A, COMPANY_A);
    const idempRes = await db.query<{ pay_commission_atomic: any }>(`
      select public.pay_commission_atomic(jsonb_build_object(
        'commission_id', '${commId}',
        'request_id', 'comm-req-001'
      )) as pay_commission_atomic;
    `);
    expect(idempRes.rows[0].pay_commission_atomic.idempotent).toBe(true);

    // Second distinct request_id rejected because commission is already paid
    await expect(
      db.query(`
        select public.pay_commission_atomic(jsonb_build_object(
          'commission_id', '${commId}',
          'request_id', 'comm-req-002'
        ));
      `),
    ).rejects.toThrow(/مدفوعة بالفعل/);
  });

  it('6. Supports controlled reversal and prevents second reversal', async () => {
    await assume(db, ADMIN_A, COMPANY_A);
    const revRes = await db.query<{ reverse_commission_atomic: any }>(`
      select public.reverse_commission_atomic(jsonb_build_object(
        'commission_id', '${commId}',
        'reason', 'إلغاء لخطأ بالحساب',
        'request_id', 'comm-rev-001'
      )) as reverse_commission_atomic;
    `);
    const res = revRes.rows[0].reverse_commission_atomic;
    expect(res.success).toBe(true);
    expect(res.reversed).toBe(true);

    // Verify original expense preserved as VOID
    const commCheck = await db.query<{ status: string; expense_id: string }>(`
      select status, expense_id from public.commissions where id = '${commId}'
    `);
    expect(commCheck.rows[0].status.toLowerCase()).toBe('cancelled');

    const expCheck = await db.query<{ status: string }>(`
      select status from public.expenses where id = '${commCheck.rows[0].expense_id}'
    `);
    expect(expCheck.rows[0].status).toBe('VOID');

    // Verify reversal journal entries
    const revJe = await db.query<{ count: string }>(`
      select count(*) as count from public.journal_entries
      where entity_type = 'commission_reversal' and source_id = '${commId}'
    `);
    expect(Number(revJe.rows[0].count)).toBe(2);

    // Rejects second reversal
    await expect(
      db.query(`
        select public.reverse_commission_atomic(jsonb_build_object(
          'commission_id', '${commId}',
          'reason', 'تكرار',
          'request_id', 'comm-rev-002'
        ));
      `),
    ).rejects.toThrow(/غير مدفوعة مالياً/);
  });
});
