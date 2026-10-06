/**
 * Contract regression: the owner financial-authority PARSER must accept the
 * envelope the DATABASE actually returns.
 *
 * Why this file exists
 * --------------------
 * `owner-financial-service.test.ts` mocks the transport, and
 * `owner-paid-cash-position.test.ts` asserts SQL figures. Between those two
 * layers a real defect survived: the client read a root-level `owner_id`,
 * while `rpt_owner_financial_position` has always returned the owner under
 * `meta.owner_id`. Both suites stayed green and the owner dossier's financial
 * tab failed for every real response with
 * "استجابة الموقف المالي للمالك ناقصة المعرّف".
 *
 * This test closes that gap by feeding the parser the UNMODIFIED jsonb of the
 * real function, executed against the replayed migration chain. It is the
 * only place that proves DB output and client parsing agree.
 */
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createOwnerOffsetFixture, offsetFixtureCommand, offsetDate } from '@/test/owner-offset-fixture';
import { COMPANY, OWNER } from '@/test/office-creditor-fixture';
import { assumeIdentity } from '@/p1/replay-bootstrap';

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: rpcMock } }));

let f: Awaited<ReturnType<typeof createOwnerOffsetFixture>>;
const CHECKER = 'c2000000-0000-4000-8000-000000000099';
const FROM = offsetDate(1);
const TO = offsetDate(28);

/** Executes the real report function and returns its untouched jsonb. */
async function serverPosition(from = FROM, to = TO): Promise<unknown> {
  return (await f.db.query<{ data: unknown }>(
    'select public.rpt_owner_financial_position($1,$2::date,$3::date) as data',
    [OWNER, from, to],
  )).rows[0].data;
}

async function serverStatement(from = FROM, to = TO): Promise<unknown> {
  return (await f.db.query<{ data: unknown }>(
    'select public.rpt_owner_statement($1,$2::date,$3::date) as data',
    [OWNER, from, to],
  )).rows[0].data;
}

beforeAll(async () => {
  f = await createOwnerOffsetFixture();
  await offsetFixtureCommand(f.db, 'offset_owner_receivable_atomic', {
    due_from_owner_id: f.receivable, owner_settlement_id: f.settlement, amount: 25,
    effective_date: offsetDate(2), lawful_offset_evidence: 'Contract priority',
    request_id: 'contract-offset',
  });
  await assumeIdentity(f.db, CHECKER, COMPANY);
  await offsetFixtureCommand(f.db, 'pay_owner_settlement_atomic', {
    settlement_id: f.settlement, method: 'bank_transfer',
    payment_reference: 'Contract cash', request_id: 'contract-pay',
  });
}, 60_000);

afterAll(async () => { await f?.db.close(); });

it('the real server envelope carries owner identity under meta, not at the root', async () => {
  const data = await serverPosition() as Record<string, unknown>;
  const meta = data.meta as Record<string, unknown>;
  // Documents the actual contract so a future client change cannot "fix" the
  // parser back to a root-level field that the server does not emit.
  expect(meta.owner_id).toBe(OWNER);
  expect(data.owner_id).toBeUndefined();
});

it('parses the UNMODIFIED database response end to end', async () => {
  const { getOwnerFinancialAuthority } = await import(
    '@/features/financials/services/owner-financial-authority-service'
  );
  rpcMock.mockReset();
  rpcMock
    .mockResolvedValueOnce({ data: await serverPosition(), error: null })
    .mockResolvedValueOnce({ data: await serverStatement(), error: null });

  const authority = await getOwnerFinancialAuthority(OWNER, FROM, TO);

  // Identity resolves from the real envelope, so the cross-owner guard passes
  // on legitimate data instead of blocking the whole screen.
  expect(authority.position.owner_id).toBe(OWNER);
  // Settled entitlement and proven cash stay SEPARATE values, exactly as
  // migration 15/16 established: 1000 entitlement discharged by a 25 offset
  // plus 975 posted cash.
  expect(authority.position.lifecycle_all_time.paid_net).toBe(1000);
  expect(authority.position.lifecycle_all_time.paid_cash).toBe(975);
  expect(authority.position.lifecycle_all_time.paid_cash_proven_total).toBe(975);
  expect(authority.position.lifecycle_all_time.paid_cash_evidence_missing_count).toBe(0);
});

it('keeps the incomplete-evidence state parseable rather than collapsing it to zero', async () => {
  const { getOwnerFinancialAuthority } = await import(
    '@/features/financials/services/owner-financial-authority-service'
  );
  await f.db.exec('begin;reset role');
  try {
    // Explicit malformed historical import: PAID with no journal and no cached
    // payment acknowledgement. It must degrade to "unknown", never to 0.
    await f.db.query(
      "insert into public.owner_settlements(id,company_id,owner_id,status,gross_collected,net_payable,method,approved_at,approved_by,paid_at,paid_by)"
      + " values('contract-legacy-unknown',$1,$2,'PAID',100,100,'bank_transfer',now(),$3,now(),$3)",
      [COMPANY, OWNER, CHECKER],
    );
    await f.db.exec('set local role authenticated');
    rpcMock.mockReset();
    rpcMock
      .mockResolvedValueOnce({ data: await serverPosition(), error: null })
      .mockResolvedValueOnce({ data: await serverStatement(), error: null });

    const authority = await getOwnerFinancialAuthority(OWNER, FROM, TO);
    expect(authority.position.lifecycle_all_time.paid_cash).toBeNull();
    expect(authority.position.lifecycle_all_time.paid_cash_proven_total).toBe(975);
    expect(authority.position.lifecycle_all_time.paid_cash_evidence_missing_count).toBe(1);
    // The unproven settlement still counts as settled entitlement.
    expect(authority.position.lifecycle_all_time.paid_net).toBe(1100);
  } finally {
    await f.db.exec('rollback');
  }
});

it('lifetime cash stays all-time and is not rescoped to the requested period', async () => {
  const { getOwnerFinancialAuthority } = await import(
    '@/features/financials/services/owner-financial-authority-service'
  );
  rpcMock.mockReset();
  rpcMock
    .mockResolvedValueOnce({ data: await serverPosition('2025-01-01', '2025-01-31'), error: null })
    .mockResolvedValueOnce({ data: await serverStatement('2025-01-01', '2025-01-31'), error: null });

  const authority = await getOwnerFinancialAuthority(OWNER, '2025-01-01', '2025-01-31');
  expect(authority.position.lifecycle_all_time.paid_cash).toBe(975);
  // A period with no economics must not be reported as a period that consumed
  // the lifetime cash.
  expect(authority.position.period.net_payable).toBe(0);
});
