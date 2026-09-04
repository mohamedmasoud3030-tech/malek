/**
 * Behavior regression for the bounded fan-out rewrite of getBillingReadiness:
 *
 *   - invoice existence resolves through ONE batched read (IN-chunked), never
 *     one round trip per contract;
 *   - invoices are keyed per (contract, billing period) so an invoice for a
 *     different period never counts as this period's invoice;
 *   - the tax authority probe is deduplicated to ONE call per distinct issue
 *     date and is never called for blocked obligations;
 *   - fail-closed tax semantics stay intact (TAX_PROFILE_MISSING → BLOCKED,
 *     any other failure → CHECK_FAILED);
 *   - zero active contracts → zero database round trips after the contract
 *     scan itself.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatLocalDate, getBillingPeriodForCycle } from './billing-schedule';

function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  const self = new Proxy(chain, {
    get: (target, prop: string) => {
      if (prop === 'then') return undefined;
      if (!(prop in target)) {
        if (prop === 'range') {
          target[prop] = vi.fn(() => Promise.resolve(result));
        } else {
          target[prop] = vi.fn(() => self);
        }
      }
      return target[prop];
    },
  });
  return self as Record<string, ReturnType<typeof vi.fn>> & { range: ReturnType<typeof vi.fn>; returns: ReturnType<typeof vi.fn> };
}

const supabaseMock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

type ContractRow = Record<string, unknown>;

function contract(overrides: Partial<ContractRow> & { id: string }): ContractRow {
  return {
    property_id: null,
    unit_id: null,
    tenant_id: 'tenant-x',
    rent_amount: 100,
    payment_cycle: 'monthly',
    billing_day: 1,
    grace_days: 0,
    payment_terms_id: null,
    agreement_id: 'agreement-x',
    collection_role_snapshot: 'OFFICE_IS_CREDITOR',
    operating_model_snapshot: 'OWNER_AGENCY',
    start_date: '2026-01-01',
    end_date: '2027-12-31',
    ...overrides,
  };
}

const COMPANY = 'company-under-test';

function currentPeriodStart(): string {
  const period = getBillingPeriodForCycle('monthly', new Date());
  return formatLocalDate(period.start);
}

async function readinessWith(contracts: ContractRow[], invoices: unknown[]) {
  const contractsChain = makeChain({ data: contracts, error: null });
  const invoicesChain = makeChain({ data: invoices, error: null });
  supabaseMock.from.mockImplementation((table: string) =>
    table === 'contracts' ? contractsChain : invoicesChain,
  );
  supabaseMock.rpc.mockResolvedValue({ data: [{ id: 'tax-profile' }], error: null });
  const { getBillingReadiness } = await import('./billing-readiness-service');
  const obligations = await getBillingReadiness(COMPANY);
  return { obligations, contractsChain, invoicesChain };
}

describe('billing readiness — batched fan-out contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('uses a single batched invoice read for all contracts, keyed by (contract, period)', async () => {
    const period = currentPeriodStart();
    const { obligations, invoicesChain } = await readinessWith(
      [
        contract({ id: 'c1' }),
        contract({ id: 'c2' }),
        contract({ id: 'c3' }),
      ],
      [
        { id: 'inv-1', contract_id: 'c1', billing_period_start: period },
        // c2 has an invoice in ANOTHER period only → must not count here.
        { id: 'inv-2', contract_id: 'c2', billing_period_start: '2020-05-01' },
      ],
    );

    // One IN-chunk per batch primitive: contract ids AND periods go through
    // .in(), and exactly one range() round trip resolves the whole set.
    expect(invoicesChain.in).toHaveBeenCalledWith('contract_id', ['c1', 'c2', 'c3']);
    expect(invoicesChain.in).toHaveBeenCalledWith('billing_period_start', [period]);
    expect(invoicesChain.range).toHaveBeenCalledTimes(1);

    const byId = new Map(obligations.map((o) => [o.contract_id, o]));
    expect(byId.get('c1')?.status).toBe('GENERATED');
    expect(byId.get('c1')?.invoice_id).toBe('inv-1');
    expect(byId.get('c2')?.status).toBe('DUE');
    expect(byId.get('c2')?.invoice_exists).toBe(false);
    expect(byId.get('c3')?.status).toBe('DUE');
  });

  it('probes the tax authority once per distinct issue date and never for blocked obligations', async () => {
    const { obligations } = await readinessWith(
      [
        // same cycle + same billing day → same issue date → one probe shared
        contract({ id: 'c1', billing_day: 1 }),
        contract({ id: 'c2', billing_day: 1 }),
        // different billing day → different issue date → its own probe
        contract({ id: 'c3', billing_day: 25 }),
        // blocked (no agreement) → never reaches the tax authority even with
        // a third distinct issue date
        contract({ id: 'c4', billing_day: 20, agreement_id: null }),
      ],
      [],
    );

    const dates = supabaseMock.rpc.mock.calls
      .filter(([name]) => name === 'resolve_active_tax_profile')
      .map(([, args]) => args.p_effective_date as string);
    expect(dates).toHaveLength(2);
    expect(new Set(dates).size).toBe(2);

    const byId = new Map(obligations.map((o) => [o.contract_id, o]));
    expect(byId.get('c4')?.status).toBe('BLOCKED');
    expect(byId.get('c4')?.blocked_reason).toContain('AGREEMENT_MISSING');
  });

  it('keeps fail-closed tax semantics: missing profile → BLOCKED, other error → CHECK_FAILED', async () => {
    const contractsChain = makeChain({ data: [contract({ id: 'c1' })], error: null });
    const invoicesChain = makeChain({ data: [], error: null });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'contracts' ? contractsChain : invoicesChain,
    );
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'TAX_PROFILE_MISSING: no active profile' },
    });
    vi.resetModules();
    const { getBillingReadiness } = await import('./billing-readiness-service');
    const missing = await getBillingReadiness(COMPANY);
    expect(missing[0]?.status).toBe('BLOCKED');
    expect(missing[0]?.blocked_reason).toContain('TAX_PROFILE_MISSING');

    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'connection reset' },
    });
    const failed = await getBillingReadiness(COMPANY);
    expect(failed[0]?.status).toBe('CHECK_FAILED');
    expect(failed[0]?.blocked_reason).toContain('TAX_CHECK_FAILED');
  });

  it('skips the invoice batch read entirely when there are no active contracts', async () => {
    const { contractsChain, invoicesChain } = await readinessWith([], []);
    expect(contractsChain.range).toHaveBeenCalledTimes(1);
    expect(supabaseMock.from).toHaveBeenCalledTimes(1); // contracts only
    expect(invoicesChain.range).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });
});
