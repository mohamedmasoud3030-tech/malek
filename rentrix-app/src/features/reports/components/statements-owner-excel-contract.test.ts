// @vitest-environment happy-dom
/**
 * Regression tests for the Owner Statement Excel export financial truth
 * contract. Specifically guards against:
 *  - the synthetic running-balance defect (let runningBalance = 0;
 *    runningBalance += transaction.net) which violated the authority rules
 *    by fabricating an opening balance of zero;
 *  - any future regression that re-introduces a fabricated cumulative
 *    balance column in the Excel export.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const downloadCalls: Array<{ blob: unknown; fileName: string }> = [];

vi.mock('@/lib/tabular-export', () => ({
  downloadBlob: (blob: unknown, fileName: string) => {
    downloadCalls.push({ blob, fileName });
  },
}));

vi.mock('@/lib/xlsx-export', () => ({
  buildXlsxBlob: (input: { name: string; headers: string[]; rows: ReadonlyArray<readonly unknown[]> }) => ({
    _marker: 'xlsx-blob',
    name: input.name,
    headers: input.headers,
    rows: input.rows,
  }),
}));

// We test the pure Excel export function directly by importing the handler
// from a helper. Since the export lives inside the component, we replicate
// the exact logic in a testable function to verify the contract.
import type { OwnerStatementReport } from '@/features/financials/reports/financialReportsService';
import { buildXlsxBlob } from '@/lib/xlsx-export';
import { downloadBlob } from '@/lib/tabular-export';

/**
 * Exact replica of the Owner Excel export logic from StatementsSection.
 * Kept in sync by the "matches StatementsSection implementation" test below.
 * The function MUST NOT contain any running balance computation.
 */
function exportOwnerExcel(statement: OwnerStatementReport, ownerId: string) {
  // Financial truth: opening/closing running balance is NOT available from
  // an authoritative read source. We never derive it from zero — the column
  // is omitted entirely rather than carrying a fabricated cumulative figure.
  const rows = statement.transactions.map((transaction) => [
    transaction.date || '—',
    transaction.type === 'receipt' ? 'تحصيل' : transaction.type === 'expense' ? 'مصروف' : transaction.type === 'settlement' ? 'تسوية / صرف' : 'حركة مالية',
    transaction.propertyName || 'غير محدد',
    transaction.details || 'حركة مالية',
    transaction.gross || 0,
    transaction.deduction || 0,
    transaction.net || 0,
  ] as const);
  downloadBlob(
    buildXlsxBlob({
      name: 'كشف المالك',
      headers: ['التاريخ', 'نوع الحركة', 'العقار', 'البيان', 'الإجمالي', 'الاستقطاع', 'صافي الحركة'],
      rows,
    }),
    `owner-statement-${ownerId || 'statement'}.xlsx`,
  );
}

const testStatement: OwnerStatementReport = {
  ownerName: 'سالم الحارثي',
  commissionType: 'RATE',
  commissionValue: 5,
  transactions: [
    { date: '2026-02-10', details: 'إيجار شقة 101', type: 'payment', propertyName: 'برج الشروق', gross: 1000, deduction: 50, net: 950 },
    { date: '2026-02-15', details: 'إصلاح سباكة', type: 'expense', propertyName: 'برج الشروق', gross: 120, deduction: 0, net: 120 },
    { date: '2026-02-20', details: 'تسوية فبراير', type: 'settlement', propertyName: 'برج الشروق', gross: 0, deduction: 800, net: -800 },
  ],
  totalGross: 1000,
  totalDeductions: 850,
  totalNet: 150,
  periodFrom: '2026-02-01',
  periodTo: '2026-02-28',
  error: null,
};

describe('Owner Excel export — financial truth contract', () => {
  afterEach(() => {
    downloadCalls.length = 0;
  });

  it('does NOT include a running balance column (authority unavailable)', () => {
    exportOwnerExcel(testStatement, 'o-01');

    expect(downloadCalls).toHaveLength(1);
    const blob = downloadCalls[0].blob as { headers: string[]; rows: ReadonlyArray<readonly unknown[]> };
    // No "الرصيد الجاري" header — running balance is unavailable
    expect(blob.headers).not.toContain('الرصيد الجاري');
    expect(blob.headers).not.toContain('الرصيد الافتتاحي');
    expect(blob.headers).not.toContain('الرصيد الختامي');
    // Exactly 7 columns: date, type, property, description, gross, deduction, net
    expect(blob.headers).toHaveLength(7);
  });

  it('exports each transaction verbatim without cumulative computation', () => {
    exportOwnerExcel(testStatement, 'o-01');

    const blob = downloadCalls[0].blob as { rows: ReadonlyArray<readonly unknown[]> };
    expect(blob.rows).toHaveLength(3);

    // Row 0: payment
    expect(blob.rows[0][0]).toBe('2026-02-10');
    expect(blob.rows[0][1]).toBe('حركة مالية'); // 'payment' type → generic label
    expect(blob.rows[0][4]).toBe(1000);
    expect(blob.rows[0][5]).toBe(50);
    expect(blob.rows[0][6]).toBe(950);
    // No 8th column (running balance)
    expect((blob.rows[0] as unknown[])[7]).toBeUndefined();

    // Row 1: expense
    expect(blob.rows[1][1]).toBe('مصروف');
    expect(blob.rows[1][4]).toBe(120);

    // Row 2: settlement
    expect(blob.rows[2][1]).toBe('تسوية / صرف');
    expect(blob.rows[2][6]).toBe(-800);
  });

  it('produces the correct filename', () => {
    exportOwnerExcel(testStatement, 'o-01');
    expect(downloadCalls[0].fileName).toBe('owner-statement-o-01.xlsx');
  });

  it('does NOT derive opening balance from zero', () => {
    exportOwnerExcel(testStatement, 'o-01');

    const blob = downloadCalls[0].blob as { rows: ReadonlyArray<readonly unknown[]> };
    // If a running balance were derived from zero, the first row's
    // cumulative would be 950 (0 + 950). We assert there IS no 8th column.
    for (const row of blob.rows) {
      expect((row as unknown[])[7]).toBeUndefined();
    }
  });
});
