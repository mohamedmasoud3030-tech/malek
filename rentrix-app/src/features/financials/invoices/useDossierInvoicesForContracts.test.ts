// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const queryMock = vi.hoisted(() => ({
  useQuery: vi.fn((options: unknown) => options),
  listDossierInvoicesForContracts: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn((options) => options),
  useQuery: queryMock.useQuery,
  useQueryClient: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('./invoiceService', () => ({
  generateInvoicesFromActiveContracts: vi.fn(),
  getInvoiceDetail: vi.fn(),
  listInvoices: vi.fn(),
  listInvoicesPaginated: vi.fn(),
  listDossierInvoicesForContracts: queryMock.listDossierInvoicesForContracts,
}));

type DossierQueryOptions = Readonly<{
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown[]>;
  enabled: boolean;
}>;

/** Runs the hook once and returns the options it handed to `useQuery`. */
async function captureOptions(contractIds: readonly string[]): Promise<DossierQueryOptions> {
  const { useDossierInvoicesForContracts } = await import('./useInvoices');
  const { result } = renderHook(() => useDossierInvoicesForContracts(contractIds));
  return result.current as unknown as DossierQueryOptions;
}

describe('useDossierInvoicesForContracts — bounded batched register read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds one deterministic, deduplicated query key per visible page', async () => {
    const options = await captureOptions(['c-2', 'c-1', 'c-2', '']);

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual(['invoices', 'list', 'dossier-for-contracts', ['c-1', 'c-2']]);

    // The same page arriving in a different order must hit the same cache entry.
    const reordered = await captureOptions(['c-1', 'c-2']);
    expect(reordered.queryKey).toEqual(options.queryKey);
  });

  it('never issues a read when there are no contract ids', async () => {
    const options = await captureOptions([]);

    expect(options.enabled).toBe(false);
    expect(queryMock.listDossierInvoicesForContracts).not.toHaveBeenCalled();
  });

  it('performs ONE batched read for a page — never one query per contract', async () => {
    queryMock.listDossierInvoicesForContracts.mockResolvedValue([]);

    const options = await captureOptions(['c-1', 'c-2', 'c-3']);
    await options.queryFn();

    expect(queryMock.listDossierInvoicesForContracts).toHaveBeenCalledTimes(1);
    expect(queryMock.listDossierInvoicesForContracts).toHaveBeenCalledWith(['c-1', 'c-2', 'c-3']);
  });

  it('chunks an oversized contract set instead of one unbounded filter', async () => {
    queryMock.listDossierInvoicesForContracts.mockResolvedValue([]);

    const ids = Array.from({ length: 600 }, (_, index) => `c-${index}`);
    const options = await captureOptions(ids);
    const rows = await options.queryFn();

    expect(queryMock.listDossierInvoicesForContracts).toHaveBeenCalledTimes(3);
    expect((queryMock.listDossierInvoicesForContracts.mock.calls[0]![0] as string[]).length).toBe(250);
    expect((queryMock.listDossierInvoicesForContracts.mock.calls[2]![0] as string[]).length).toBe(100);
    expect(rows).toEqual([]);
  });

  it('normalises ids through the exported helper so callers cannot skip it', async () => {
    const { normalizeContractInvoiceQueryIds } = await import('./useInvoices');

    expect(normalizeContractInvoiceQueryIds(['b', 'a', 'b', ''])).toEqual(['a', 'b']);
    expect(normalizeContractInvoiceQueryIds([])).toEqual([]);
  });
});
