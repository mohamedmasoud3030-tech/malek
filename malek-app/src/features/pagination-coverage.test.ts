import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase', () => ({ supabase: supabaseMock }));

const pageSize = 1000;

function rows<T>(makeRow: (index: number) => T): T[] {
  return Array.from({ length: pageSize + 1 }, (_, index) => makeRow(index));
}

function pagedQuery<T>(allRows: T[]) {
  const query: any = {
    eq: vi.fn(() => query),
    ilike: vi.fn(() => query),
    is: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn((from: number, to: number) => Promise.resolve({ data: allRows.slice(from, to + 1), error: null })),
    select: vi.fn(() => query),
  };
  return query;
}

function useRows<T>(allRows: T[]) {
  const query = pagedQuery(allRows);
  supabaseMock.from.mockReturnValue(query);
  return query;
}

describe('app-wide paginated list coverage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listLands returns every row beyond the first PostgREST page', async () => {
    const source = rows((index) => ({ id: `land-${index}`, created_at: String(index) }));
    const query = useRows(source);
    const { listLands } = await import('./lands/services/lands-service');
    await expect(listLands({ query: '', status: 'all' })).resolves.toHaveLength(1001);
    expect(query.range).toHaveBeenCalledTimes(2);
  });

  it('listCommunicationRecords returns every row beyond the first PostgREST page', async () => {
    const source = rows((index) => ({ id: `communication-${index}`, created_at: String(index) }));
    const query = useRows(source);
    const { listCommunicationRecords } = await import('./communication/services/communication-service');
    await expect(listCommunicationRecords({ query: '', channel: 'all', status: 'all' })).resolves.toHaveLength(1001);
    expect(query.range).toHaveBeenCalledTimes(2);
  });

  it('listLeads returns every row beyond the first PostgREST page', async () => {
    const source = rows((index) => ({ id: `lead-${index}`, created_at: String(index) }));
    const query = useRows(source);
    const { listLeads } = await import('./leads/services/leads-service');
    await expect(listLeads({ query: '', source: 'all', status: 'all' })).resolves.toHaveLength(1001);
    expect(query.range).toHaveBeenCalledTimes(2);
  });

  it('listCommissions returns every row beyond the first PostgREST page', async () => {
    const source = rows((index) => ({ id: `commission-${index}`, created_at: String(index) }));
    const query = useRows(source);
    const { listCommissions } = await import('./commissions/services/commissions-service');
    await expect(listCommissions({ query: '', type: 'all', status: 'all' })).resolves.toHaveLength(1001);
    expect(query.range).toHaveBeenCalledTimes(2);
  });

  it('listVaultDocuments returns every row beyond the old 100-document cap', async () => {
    const source = rows((index) => ({
      id: `document-${index}`, title: `Document ${index}`, category: 'other', file_name: `file-${index}.pdf`,
      file_url: `https://example.test/${index}`, storage_path: `vault/${index}.pdf`, created_at: String(index),
    }));
    const query = useRows(source);
    const { listVaultDocuments } = await import('./documents-vault/documents-vault-service');
    await expect(listVaultDocuments()).resolves.toHaveLength(1001);
    expect(query.range).toHaveBeenCalledTimes(2);
  });

  it('listUtilityMeters returns every row beyond the first PostgREST page', async () => {
    const source = rows((index) => ({
      id: `meter-${index}`, property_id: 'property-1', utility_type: 'water', meter_number: String(index), account_number: String(index), created_at: String(index),
    }));
    const query = useRows(source);
    const { listUtilityMeters } = await import('./utilities/utilities-service');
    await expect(listUtilityMeters()).resolves.toHaveLength(1001);
    expect(query.range).toHaveBeenCalledTimes(2);
  });

  it('listUtilityBills returns every row beyond the old 200-bill cap', async () => {
    const source = rows((index) => ({
      id: `bill-${index}`, property_id: 'property-1', amount: 10, paid_amount: 0, due_date: '2026-07-01', status: 'UNPAID', created_at: String(index),
    }));
    const query = useRows(source);
    const { listUtilityBills } = await import('./utilities/utilities-service');
    await expect(listUtilityBills()).resolves.toHaveLength(1001);
    expect(query.range).toHaveBeenCalledTimes(2);
  });
});
