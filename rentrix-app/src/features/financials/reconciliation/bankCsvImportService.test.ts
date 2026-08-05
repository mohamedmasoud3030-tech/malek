import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as parser from '@/lib/bankCsvParser';
import { toImportPayloadRows } from './bankCsvImportService';

// Mock supabase for import tests
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('bankCsvImportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('converts parsed rows to payload rows with required fields', () => {
    const parsed = parser.parseBankCsv(
      'date,description,reference,amount\n2026-01-01,Test,REF1,100.500\n2026-01-02,Another,REF2,200',
      'test.csv',
      100,
    );
    const payload = toImportPayloadRows(parsed);
    expect(payload.length).toBe(2);
    expect(payload[0]).toMatchObject({
      transaction_date: '2026-01-01',
      amount: 100.5,
      description: 'Test',
      reference: 'REF1',
      currency: 'OMR',
    });
  });

  it('refuses to build import payload when preview has any rejected row', () => {
    const parsed = parser.parseBankCsv(
      'date,description,reference,amount\n2026-01-01,Good,REF1,100.000\n2026-01-02,Bad,REF2,invalid',
      'test.csv',
      100,
    );

    expect(parsed.validRows.length).toBe(1);
    expect(parsed.rejectedRows.length).toBe(1);
    expect(() => toImportPayloadRows(parsed)).toThrow(/fail-closed/);
  });

  it('does not trust client-supplied company ID and uses fingerprint', async () => {
    const { supabase } = await import('@/lib/supabase');
    const mockRpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;
    mockRpc.mockResolvedValue({
      data: {
        id: 'import-id',
        reference: 'BNK-2026-000001',
        bank_account_id: 'account-1',
        file_name: 'test.csv',
        file_fingerprint: 'abc123',
        total_rows: 1,
        accepted_rows: 1,
        rejected_rows: 0,
        duplicate_rows: 0,
        possible_duplicate_rows: 0,
        status: 'completed',
        is_duplicate_file: false,
      },
      error: null,
    });

    const { importBankStatementBatch } = await import('./bankCsvImportService');
    const result = await importBankStatementBatch({
      bank_account_id: 'account-1',
      file_name: 'test.csv',
      file_fingerprint: 'abc123',
      file_size: 123,
      rows: [{ transaction_date: '2026-01-01', amount: 100, description: 'Test' }],
    });

    expect(mockRpc).toHaveBeenCalledWith('import_bank_statement_batch_atomic', expect.objectContaining({ payload: expect.any(Object) }));
    const calledPayload = mockRpc.mock.calls[0][1].payload;
    expect(calledPayload).not.toHaveProperty('company_id');
    expect(calledPayload).not.toHaveProperty('companyId');
    expect(calledPayload.file_fingerprint).toBe('abc123');
    expect(result.reference).toBe('BNK-2026-000001');
    expect(result.accepted_rows).toBe(1);
  });

  it('returns existing batch on duplicate file fingerprint (idempotent)', async () => {
    const { supabase } = await import('@/lib/supabase');
    const mockRpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;
    mockRpc.mockResolvedValue({
      data: {
        id: 'existing-id',
        reference: 'BNK-2026-000001',
        bank_account_id: 'account-1',
        file_name: 'test.csv',
        file_fingerprint: 'dup-fp',
        total_rows: 2,
        accepted_rows: 0,
        rejected_rows: 0,
        duplicate_rows: 2,
        possible_duplicate_rows: 0,
        status: 'duplicate',
        is_duplicate_file: true,
      },
      error: null,
    });

    const { importBankStatementBatch } = await import('./bankCsvImportService');
    const result = await importBankStatementBatch({
      bank_account_id: 'account-1',
      file_name: 'test.csv',
      file_fingerprint: 'dup-fp',
      file_size: 100,
      rows: [{ transaction_date: '2026-01-01', amount: 100, description: 'Test' }],
    });

    expect(result.is_duplicate_file).toBe(true);
    expect(result.id).toBe('existing-id');
  });
});
