import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { COMPANY, MAKER, OTHER, OTHER_COMPANY, CONTRACT, createOfficeCreditorFixture } from '../../../test/office-creditor-fixture';
import { assumeIdentity } from '../../../p1/replay-bootstrap';
import { createTenantDeposit, refundDepositGoverned, createDepositClaim, approveDepositClaim, applyDepositClaim, reverseDepositClaim, reverseDepositRefund } from './deposit-service';
import { RetryableCommandStore } from '@/lib/retryable-command';

const backend = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: backend }));
let db: PGlite;
let invoiceId: string;
let loseNextResponse = false;
const CHECKER = 'c2000000-0000-4000-8000-000000000099';
const today = '2026-09-09';

async function call(name: string, payload: Record<string, unknown>) {
  if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid test RPC');
  const { rows } = await db.query<{ result: Record<string, unknown> }>(`select public.${name}($1::jsonb) as result`, [JSON.stringify(payload)]);
  return rows[0].result;
}
async function deposit(amount = 500) {
  return createTenantDeposit({ contract_id: CONTRACT, amount, received_date: today, request_id: crypto.randomUUID() });
}
async function balance(id: string) {
  return (await db.query<{ remaining_amount: string; refunded_amount: string }>('select remaining_amount::text, refunded_amount::text from public.tenant_deposits where id=$1', [id])).rows[0];
}

beforeAll(async () => {
  ({ db, invoiceId } = await createOfficeCreditorFixture());
  await db.exec(`insert into auth.users(id,email) values ('${CHECKER}','checker@deposit.test');
    insert into public.users(id,email,name,role,status,is_active) values ('${CHECKER}','checker@deposit.test','Checker','ADMIN','ACTIVE',true);
    insert into public.company_members(company_id,user_id,role) values ('${COMPANY}','${CHECKER}','ADMIN');`);
  // Replace only transport. Every command below executes the actual replayed
  // SQL function, under authenticated role + claims, against persisted rows.
  backend.rpc.mockImplementation(async (name: string, args: { p_payload: Record<string, unknown> }) => {
    try {
      const data = await call(name, args.p_payload);
      if (loseNextResponse) { loseNextResponse = false; return { data: null, error: new Error('response lost after commit') }; }
      return { data, error: null };
    } catch (error) { return { data: null, error }; }
  });
  backend.from.mockImplementation(() => { throw new Error('Command must not depend on post-commit read transport'); });
}, 420_000);
beforeEach(async () => {
  await db.exec('reset role');
  await assumeIdentity(db, MAKER, COMPANY);
  await db.exec('set role authenticated');
});
afterAll(async () => { await db?.close(); });

it('retries a committed deposit after response loss without a second liability posting', async () => {
  const commands = new RetryableCommandStore();
  const payload = { contract_id: CONTRACT, amount: 123.456, received_date: today };
  const send = () => commands.run('deposit', payload, (request_id) => createTenantDeposit({ ...payload, request_id }));
  loseNextResponse = true;
  await expect(send()).rejects.toThrow();
  const ack = await send();
  expect(Number((await balance(ack.deposit_id)).remaining_amount)).toBe(123.456);
  const rows = await db.query<{ count: string }>('select count(*)::text from public.deposit_transactions where deposit_id=$1', [ack.deposit_id]);
  expect(rows.rows[0].count).toBe('1');
});

it('refund replay preserves one event and reversal restores liability with balanced journals', async () => {
  const { deposit_id } = await deposit();
  const payload = { deposit_id, refund_amount: 125.125, payment_method: 'cash' as const, refund_date: today, request_id: crypto.randomUUID() };
  const first = await refundDepositGoverned(payload);
  const replay = await refundDepositGoverned(payload);
  expect(replay.refund_event_id).toBe(first.refund_event_id);
  expect(replay.remaining).toBeUndefined();
  expect(Number((await balance(deposit_id)).remaining_amount)).toBe(374.875);
  await reverseDepositRefund(first.refund_event_id, 'تصحيح استرداد', crypto.randomUUID());
  expect(Number((await balance(deposit_id)).remaining_amount)).toBe(500);
  const { rows } = await db.query<{ count: string }>(`select count(*)::text from (select batch_id from public.journal_lines group by batch_id having round(sum(debit-credit),3) <> 0) bad`);
  expect(rows[0].count).toBe('0');
});

it('denies cross-company reads and financial mutation under real RLS', async () => {
  const { deposit_id } = await deposit();
  await assumeIdentity(db, OTHER, OTHER_COMPANY);
  expect((await db.query('select id from public.tenant_deposits where id=$1', [deposit_id])).rows).toEqual([]);
  await expect(refundDepositGoverned({ deposit_id, refund_amount: 1, payment_method: 'cash', refund_date: today, request_id: crypto.randomUUID() })).rejects.toThrow();
});

it('fails closed for a disabled identity despite an ADMIN claim and membership', async () => {
  await db.exec('reset role');
  await db.query('update public.users set is_active=false where id=$1::uuid', [MAKER]);
  await db.exec('set role authenticated');
  try { await expect(deposit()).rejects.toThrow(); } finally {
    await db.exec('reset role');
    await db.query('update public.users set is_active=true where id=$1::uuid', [MAKER]);
  }
});

it('rejects a claim exceeding credited outstanding and rechecks a stale approved claim at apply', async () => {
  const { deposit_id } = await deposit(1000);
  const claim = await createDepositClaim({ deposit_id, claim_kind: 'INVOICE_ARREARS', invoice_id: invoiceId, allocation_amount: 300, evidence_uri: 'evidence://deposit', request_id: crypto.randomUUID() });
  await expect(approveDepositClaim(claim.claim_id)).rejects.toThrow(); // maker cannot check
  await assumeIdentity(db, CHECKER, COMPANY);
  await approveDepositClaim(claim.claim_id);
  await assumeIdentity(db, MAKER, COMPANY);
  await call('create_invoice_credit_atomic', { invoice_id: invoiceId, amount: 800, credit_type: 'PARTIAL', reason: 'تخفيض متفق عليه', request_id: crypto.randomUUID() });
  await expect(createDepositClaim({ deposit_id, claim_kind: 'INVOICE_ARREARS', invoice_id: invoiceId, allocation_amount: 300, evidence_uri: 'evidence://deposit', request_id: crypto.randomUUID() })).rejects.toThrow();
  await expect(applyDepositClaim(claim.claim_id, crypto.randomUUID(), today)).rejects.toThrow();
  expect(Number((await balance(deposit_id)).remaining_amount)).toBe(1000);
});

it('derives deposit relationships from its contract and rejects forged party context', async () => {
  const { deposit_id } = await deposit();
  const { rows } = await db.query<{ tenant_id: string; property_id: string; unit_id: string }>('select tenant_id,property_id,unit_id from public.tenant_deposits where id=$1', [deposit_id]);
  const contract = (await db.query<{ tenant_id: string; property_id: string; unit_id: string }>('select tenant_id,property_id,unit_id from public.contracts where id=$1::uuid', [CONTRACT])).rows[0];
  expect(rows[0]).toEqual(contract);
  await expect(createTenantDeposit({ contract_id: CONTRACT, tenant_id: OTHER, amount: 20, received_date: today, request_id: crypto.randomUUID() })).rejects.toThrow();
});

it('rejects a reused deposit request identity with a different amount', async () => {
  const payload = { contract_id: CONTRACT, amount: 100, received_date: today, request_id: crypto.randomUUID() };
  const ack = await createTenantDeposit(payload);
  await expect(createTenantDeposit({ ...payload, amount: 200 })).rejects.toThrow();
  expect(Number((await balance(ack.deposit_id)).remaining_amount)).toBe(100);
});

it.each(['no-company', 'no-identity', 'inactive-member', 'inactive-company'] as const)('all shared role predicates return false, never NULL: %s', async (scenario) => {
  await db.exec('reset role');
  if (scenario === 'no-company') await assumeIdentity(db, MAKER, null);
  if (scenario === 'no-identity') await assumeIdentity(db, null, COMPANY);
  if (scenario === 'inactive-member') await db.query('update public.company_members set is_active=false where company_id=$1::uuid and user_id=$2::uuid', [COMPANY, MAKER]);
  if (scenario === 'inactive-company') await db.query('update public.companies set is_active=false where id=$1::uuid', [COMPANY]);
  await db.exec('set role authenticated');
  try {
    const { rows } = await db.query<Record<string, boolean>>('select public.is_admin() as admin, public.is_admin_or_manager() as manager, public.is_accountant() as accountant, public.is_operations() as operations, public.is_viewer() as viewer');
    expect(Object.values(rows[0])).toEqual([false, false, false, false, false]);
    await expect(deposit()).rejects.toThrow();
  } finally {
    await db.exec('reset role');
    await db.query('update public.company_members set is_active=true where company_id=$1::uuid and user_id=$2::uuid', [COMPANY, MAKER]);
    await db.query('update public.companies set is_active=true where id=$1::uuid', [COMPANY]);
  }
});

it('settles only the credited remainder and reconciles the deposit liability and AR reports', async () => {
  const { deposit_id } = await deposit(500);
  // Earlier persisted credit reduced 1000 to 200; no fixture edits to invoices.
  const claim = await createDepositClaim({ deposit_id, claim_kind: 'INVOICE_ARREARS', invoice_id: invoiceId, allocation_amount: 200, evidence_uri: 'evidence://remaining', request_id: crypto.randomUUID() });
  await assumeIdentity(db, CHECKER, COMPANY);
  await approveDepositClaim(claim.claim_id);
  const request = crypto.randomUUID();
  const applied = await applyDepositClaim(claim.claim_id, request, today);
  expect((await applyDepositClaim(claim.claim_id, request, today)).batch_id).toBe(applied.batch_id);
  expect(Number((await balance(deposit_id)).remaining_amount)).toBe(300);
  const { rows } = await db.query<{ remaining: string }>('select (amount+tax_amount-paid_amount-credited_amount)::text as remaining from public.invoices where id=$1::uuid', [invoiceId]);
  expect(Number(rows[0].remaining)).toBe(0);
  const report = await db.query<{ control: string; subledger: string }>(`select
    (select coalesce(sum(l.credit-l.debit),0)::text from public.journal_lines l join public.accounts a on a.id=l.account_id where a.no='2200') as control,
    (select coalesce(sum(remaining_amount),0)::text from public.tenant_deposits) as subledger`);
  expect(Number(report.rows[0].control)).toBeCloseTo(Number(report.rows[0].subledger), 3);
  await expect(db.query('update public.tenant_deposits set remaining_amount=0 where id=$1', [deposit_id])).rejects.toThrow();
});


it('tenant statement includes deposit settlement and its reversal without inventing cash', async () => {
  const report = async () => (await db.query<{ result: { final_balance: number; lines: Array<{ type: string; credit: number; debit: number }> } }>('select public.rpt_tenant_statement($1::uuid) as result', [CONTRACT])).rows[0].result;
  const settled = await report();
  expect(settled.final_balance).toBe(0);
  expect(settled.lines).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'invoice_credit', credit: 800 }),
    expect.objectContaining({ type: 'deposit_application', credit: 200 }),
  ]));
  expect(settled.lines.filter(line => line.type === 'receipt')).toEqual([]);
  const { rows } = await db.query<{ id: string }>("select id from public.deposit_application_claims where invoice_id=$1 and status='APPLIED'", [invoiceId]);
  await reverseDepositClaim(rows[0].id, 'تصحيح تسوية التأمين', crypto.randomUUID());
  const reversed = await report();
  expect(reversed.final_balance).toBe(200);
  expect(reversed.lines).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'deposit_application', credit: 200 }),
    expect.objectContaining({ type: 'deposit_application_reversal', debit: 200 }),
  ]));
});
