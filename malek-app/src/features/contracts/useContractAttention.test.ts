// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { contractRowFixtureDefaults } from '@/test/contractRowFixture';
import { useContractAttention } from './useContractAttention';
import type { ContractListItem } from './services/contractService';

/**
 * The hook is exercised against a mocked invoice query seam so the real
 * derivation runs while the batched read stays observable — which is what makes
 * "one read per page, never one per row" a testable claim.
 */
const invoiceQueryMock = vi.hoisted(() => ({
  hook: vi.fn(),
}));

vi.mock('@/features/financials/invoices/useInvoices', () => ({
  useDossierInvoicesForContracts: invoiceQueryMock.hook,
}));

const TODAY = '2026-08-27';

function contract(overrides: Partial<ContractListItem> = {}): ContractListItem {
  return {
    ...contractRowFixtureDefaults,
    id: 'contract-1',
    property_id: 'property-1',
    unit_id: 'unit-1',
    tenant_id: 'tenant-1',
    start_date: '2026-01-01',
    end_date: '2027-08-27',
    rent_amount: 1000,
    payment_cycle: 'monthly',
    payment_terms_id: null,
    status: 'active',
    cancellation_reason: null,
    renewed_from_id: null,
    notes: null,
    attachment_url: null,
    agreement_id: null,
    deleted_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    properties: null,
    units: null,
    people: null,
    ...overrides,
  } as ContractListItem;
}

function settledQuery(rows: unknown[] = [], isError = false) {
  invoiceQueryMock.hook.mockReturnValue({
    data: rows,
    error: isError ? new Error('تعذر تحميل الفواتير') : null,
    isError,
    isPending: false,
    isLoading: false,
  });
}

describe('useContractAttention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests invoice context once for the whole loaded set, with deduplicated ids', () => {
    settledQuery([]);
    const contracts = [contract({ id: 'a' }), contract({ id: 'b' })];

    renderHook(() => useContractAttention(contracts, { today: TODAY }));

    expect(invoiceQueryMock.hook).toHaveBeenCalledTimes(1);
    expect(invoiceQueryMock.hook).toHaveBeenCalledWith(['a', 'b']);
  });

  it('does not read invoices when no contracts are loaded', () => {
    settledQuery([]);

    const { result } = renderHook(() => useContractAttention([], { today: TODAY }));

    expect(invoiceQueryMock.hook).toHaveBeenCalledWith([]);
    expect(result.current.attentionByContractId.size).toBe(0);
    expect(result.current.summary.needingAttention).toBe(0);
    expect(result.current.isLoadingInvoiceContext).toBe(false);
  });

  it('derives attention per contract and exposes decision-support counts', () => {
    settledQuery([
      {
        id: 'i-1',
        reference: null,
        contract_id: 'a',
        status: 'UNPAID',
        amount: 1000,
        paid_amount: 0,
        due_date: '2026-08-01',
      },
    ]);
    const contracts = [contract({ id: 'a' }), contract({ id: 'b', end_date: '2026-09-05' })];

    const { result } = renderHook(() => useContractAttention(contracts, { today: TODAY }));

    expect(result.current.attentionByContractId.get('a')?.primaryReason?.flag).toBe('overdue_invoice');
    expect(result.current.attentionByContractId.get('b')?.primaryReason?.flag).toBe('expiring_soon');
    expect(result.current.summary.needingAttention).toBe(2);
    expect(result.current.summary.paymentAttention).toBe(1);
    expect(result.current.summary.expiryAttention).toBe(1);
    expect(result.current.summary.overdueAmount).toBe(1000);
  });

  it('reports unverified payment context instead of claiming a clean register', () => {
    settledQuery([], true);

    const { result } = renderHook(() => useContractAttention([contract({ id: 'a' })], { today: TODAY }));

    expect(result.current.hasInvoiceContextError).toBe(true);
    expect(result.current.attentionByContractId.get('a')?.invoiceContextLoaded).toBe(false);
  });

  it('treats an in-flight invoice read as loading, not clean', () => {
    invoiceQueryMock.hook.mockReturnValue({ data: undefined, error: null, isError: false, isPending: true, isLoading: true });

    const { result } = renderHook(() => useContractAttention([contract({ id: 'a' })], { today: TODAY }));

    expect(result.current.isLoadingInvoiceContext).toBe(true);
    expect(result.current.attentionByContractId.get('a')?.invoiceContextLoaded).toBe(false);
  });
});
