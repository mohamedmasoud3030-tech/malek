import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as parser from '@/lib/bankCsvParser';
import {
  assertImportPreviewReady,
  importBankStatementBatch,
  toImportPayloadRows,
} from './bankCsvImportService';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

const sha256 = 'a'.repeat(64);

function validPreview() {
  return parser.parseBankCsv(
    'date,description,reference,amount\n2026-01-01,Test,REF1,100.500\n2026-01-02,Another,REF2,200',
    'test.csv',
    100,
  );
}

describe('bankCsvImportService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('converts a complete valid file to payload rows', () => {
    const parsed = validPreview();
    const payload = toImportPayloadRows(parsed);

    expect(payload).toHaveLength(2);
    expect(payload[0]).toMatchObject({
      transaction_date: '2026-01-01',
      amount: 100.5,
      description: 'Test',
      reference: 'REF1',
      currency: 'OMR',
    });
  });

  it('blocks partial import when any source row is rejected', () => {
    const parsed = parser.parseBankCsv(
      'date,description,amount\n2026-01-01,Good,1.000\ninvalid,Bad,2.000',
      'partial.csv',
      100,
    );

    expect(parsed.validRows).toHaveLength(1);
    expect(parsed.rejectedRows).toHaveLength(1);
    expect(() => assertImportPreviewReady(parsed)).toThrow('صف مرفوض');
    expect(() => toImportPayloadRows(parsed)).toThrow('صف مرفوض');
  });

  it('blocks headerless positional inference', () => {
    const parsed = parser.parseBankCsv(
      '2026-01-01,Description,REF,1.000',
      'headerless.csv',
      100,
    );

    expect(parsed.hasHeader).toBe(false);
    expect(() => assertImportPreviewReady(parsed)).toThrow('صف رؤوس');
  });

  it('sends source counts, no company ID, and a SHA-256 fingerprint', async () => {
    const { supabase } = await import('@/lib/supabase');
    const mockRpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;
    mockRpc.mockResolvedValue({
      data: {
        id: 'import-id',
        reference: 'BNK-2026-000001',
        bank_account_id: 'account-1',
        file_name: 'test.csv',
        file_fingerprint: sha256,
        normalized_payload_fingerprint: 'b'.repeat(64),
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

    const result = await importBankStatementBatch({
      bank_account_id: 'account-1',
      file_name: 'test.csv',
      file_fingerprint: sha256,
      file_size: 123,
      source_total_rows: 1,
      rejected_rows: 0,
      rows: [{ transaction_date: '2026-01-01', amount: 100, description: 'Test' }],
    });

    const calledPayload = mockRpc.mock.calls[0][1].payload;
    expect(calledPayload).not.toHaveProperty('company_id');
    expect(calledPayload.source_total_rows).toBe(1);
    expect(calledPayload.rejected_rows).toBe(0);
    expect(calledPayload.file_fingerprint).toBe(sha256);
    expect(result.accepted_rows).toBe(1);
  });

  it('rejects invalid fingerprint, oversized files, rejected rows, and count mismatch before RPC', async () => {
    const base = {
      bank_account_id: 'account-1',
      file_name: 'test.csv',
      file_fingerprint: sha256,
      file_size: 123,
      source_total_rows: 1,
      rejected_rows: 0,
      rows: [{ transaction_date: '2026-01-01', amount: 100, description: 'Test' }],
    };

    await expect(importBankStatementBatch({ ...base, file_fingerprint: 'fallback-1' })).rejects.toThrow('SHA-256');
    await expect(importBankStatementBatch({ ...base, file_size: 6 * 1024 * 1024 })).rejects.toThrow('5MB');
    await expect(importBankStatementBatch({ ...base, rejected_rows: 1 })).rejects.toThrow('مرفوضة');
    await expect(importBankStatementBatch({ ...base, source_total_rows: 2 })).rejects.toThrow('جزئي');
  });

  it('rejects an unbalanced server summary', async () => {
    const { supabase } = await import('@/lib/supabase');
    const mockRpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;
    mockRpc.mockResolvedValue({
      data: {
        id: 'import-id',
        bank_account_id: 'account-1',
        total_rows: 2,
        accepted_rows: 1,
        rejected_rows: 0,
        duplicate_rows: 0,
        possible_duplicate_rows: 0,
        status: 'completed',
        is_duplicate_file: false,
      },
      error: null,
    });

    await expect(importBankStatementBatch({
      bank_account_id: 'account-1',
      file_name: 'test.csv',
      file_fingerprint: sha256,
      file_size: 123,
      source_total_rows: 2,
      rejected_rows: 0,
      rows: [
        { transaction_date: '2026-01-01', amount: 100, description: 'One' },
        { transaction_date: '2026-01-02', amount: 200, description: 'Two' },
      ],
    })).rejects.toThrow('غير متوازن');
  });
});
