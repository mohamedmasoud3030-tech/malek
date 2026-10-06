/**
 * Stage 3 — accounting service-layer tests (mocked Supabase boundary) plus the
 * pure OMR monetary-contract helpers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  roundOmr3,
  OMR_PRECISION,
  REQUIRED_ACCOUNT_DEFINITIONS,
  type JournalEventInput,
} from './accountingDomain';
import { listChartOfAccounts, ensureRequiredAccounts } from './chartOfAccountsService';
import { listAccountingPeriods, createAccountingPeriod, updateAccountingPeriodStatus } from './accountingPeriodsService';
import { listJournalBatches, listJournalLines, buildJournalEventPayload, normalizeJournalLineInput } from './journalService';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), handleSupabaseError: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/lib/supabase-error', () => ({ handleSupabaseError: mocks.handleSupabaseError }));

const accountRow = {
  id: 'coa:company-1:1111',
  account_no: '1111',
  name: 'Cash',
  account_type: 'asset',
  normal_balance: 'debit',
  currency_code: 'OMR',
  precision: 3,
  is_active: true,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

describe('OMR monetary contract', () => {
  it('rounds to exactly three decimals (0.001 unit)', () => {
    expect(OMR_PRECISION).toBe(3);
    expect(roundOmr3(1.005)).toBe(1.005);
    expect(roundOmr3(1.0004)).toBe(1);
    expect(roundOmr3(0.0015)).toBe(0.002);
    expect(roundOmr3(0.1 + 0.2)).toBe(0.3);
  });

  it('declares the 18 required accounts with correct classification', () => {
    expect(REQUIRED_ACCOUNT_DEFINITIONS).toHaveLength(18);
    const cash = REQUIRED_ACCOUNT_DEFINITIONS.find((a) => a.accountNo === '1111');
    expect(cash).toMatchObject({ accountType: 'asset', normalBalance: 'debit' });
    const ownerPayable = REQUIRED_ACCOUNT_DEFINITIONS.find((a) => a.accountNo === '2000');
    expect(ownerPayable).toMatchObject({ accountType: 'liability', normalBalance: 'credit' });
    const feeRevenue = REQUIRED_ACCOUNT_DEFINITIONS.find((a) => a.accountNo === '4100');
    expect(feeRevenue).toMatchObject({ accountType: 'revenue', normalBalance: 'credit' });
  });
});

describe('chartOfAccountsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists the company chart through the authorized RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { company_id: 'company-1', accounts: [accountRow] },
      error: null,
    });
    const accounts = await listChartOfAccounts();
    expect(mocks.rpc).toHaveBeenCalledWith('list_chart_of_accounts');
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ no: '1111', name: 'Cash', precision: 3, currency_code: 'OMR' });
  });

  it('provisions the required accounts idempotently through the RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { success: true, company_id: 'company-1', created_count: 18, existing_count: 0, accounts: [accountRow] },
      error: null,
    });
    const result = await ensureRequiredAccounts();
    expect(mocks.rpc).toHaveBeenCalledWith('ensure_company_chart_of_accounts');
    expect(result?.created_count).toBe(18);
    expect(result?.accounts[0].precision).toBe(3);
  });

  it('surfaces errors through the shared error handler', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    const accounts = await listChartOfAccounts();
    expect(accounts).toEqual([]);
    expect(mocks.handleSupabaseError).toHaveBeenCalled();
  });
});

describe('accountingPeriodsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists periods and maps statuses', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { company_id: 'company-1', periods: [{ id: 'p1', company_id: 'company-1', name: '2026-07', start_date: '2026-07-01', end_date: '2026-07-31', status: 'OPEN', closed_at: null, closed_by: null, reopen_reason: null, created_at: 'x', created_by: null, updated_at: 'x' }] },
      error: null,
    });
    const periods = await listAccountingPeriods();
    expect(periods[0]).toMatchObject({ name: '2026-07', status: 'OPEN' });
  });

  it('creates a period with server-side company scope', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { success: true, id: 'p2', name: '2026-08', start_date: '2026-08-01', end_date: '2026-08-31', status: 'OPEN' },
      error: null,
    });
    const result = await createAccountingPeriod({ start_date: '2026-08-01', end_date: '2026-08-31' });
    expect(mocks.rpc).toHaveBeenCalledWith('create_accounting_period', { p_payload: { start_date: '2026-08-01', end_date: '2026-08-31' } });
    expect(result?.status).toBe('OPEN');
  });

  it('updates a period status with the audited RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { success: true, id: 'p2', status: 'HARD_CLOSED', changed: true, old_status: 'OPEN' },
      error: null,
    });
    const result = await updateAccountingPeriodStatus({ period_id: 'p2', status: 'HARD_CLOSED' });
    expect(result?.changed).toBe(true);
    expect(result?.old_status).toBe('OPEN');
  });
});

describe('journalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists batches with the company-scoped RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { company_id: 'company-1', batches: [{ id: 'b1', company_id: 'company-1', status: 'POSTED', source_type: 'expense', source_id: 'e1', event_id: 'e1', is_legacy_compat: false, effective_date: '2026-07-15', created_at: 'x', updated_at: 'x' }] },
      error: null,
    });
    const batches = await listJournalBatches({ status: 'POSTED', sourceType: 'expense' });
    expect(mocks.rpc).toHaveBeenCalledWith('list_journal_batches', { p_payload: { status: 'POSTED', source_type: 'expense' } });
    expect(batches[0]).toMatchObject({ status: 'POSTED', source_type: 'expense' });
  });

  it('lists lines for a batch', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { batch_id: 'b1', lines: [{ id: 'l1', batch_id: 'b1', company_id: 'company-1', account_id: 'a1', debit: 10, credit: 0, created_at: 'x' }] },
      error: null,
    });
    const lines = await listJournalLines('b1');
    expect(mocks.rpc).toHaveBeenCalledWith('list_journal_lines', { p_batch_id: 'b1' });
    expect(lines[0]).toMatchObject({ debit: 10, credit: 0 });
  });

  it('normalizes lines exactly like the engine (one positive side, 3dp)', () => {
    expect(normalizeJournalLineInput({ account_id: 'a1', debit: 1.0004 })).toEqual({ debit: 1, credit: 0 });
    expect(normalizeJournalLineInput({ account_id: 'a1', credit: 0.0015 })).toEqual({ debit: 0, credit: 0.002 });
    expect(() => normalizeJournalLineInput({ account_id: 'a1', debit: 1, credit: 1 })).toThrow(/JOURNAL_LINE_SIDE_INVALID/);
    expect(() => normalizeJournalLineInput({ account_id: 'a1', debit: -1 })).toThrow(/JOURNAL_LINE_NEGATIVE_INVALID/);
  });

  it('builds a valid idempotent event payload and rejects incomplete ones', () => {
    const event: JournalEventInput = {
      company_id: 'company-1',
      source_type: 'expense',
      source_id: 'e-1',
      event_id: 'evt-1',
      effective_date: '2026-07-15',
      lines: [{ account_id: 'a1', debit: 5 }, { account_id: 'a2', credit: 5 }],
    };
    expect(buildJournalEventPayload(event)).toBe(event);
    expect(() => buildJournalEventPayload({ ...event, event_id: '' })).toThrow(/GL_EVENT_METADATA_REQUIRED/);
    expect(() => buildJournalEventPayload({ ...event, lines: [] })).toThrow(/JOURNAL_BATCH_EMPTY/);
  });
});
