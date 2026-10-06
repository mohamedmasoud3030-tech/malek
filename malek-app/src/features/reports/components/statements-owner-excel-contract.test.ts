// @vitest-environment happy-dom
/**
 * Regression tests for the Owner Statement Excel export financial truth
 * contract, exercised against the ONE production export
 * (`downloadOwnerStatementExcel`). Specifically guards against:
 *  - the synthetic running-balance defect (let runningBalance = 0;
 *    runningBalance += transaction.net) which violated the authority rules
 *    by fabricating an opening balance of zero;
 *  - any future regression that re-introduces a fabricated cumulative
 *    balance column in the Excel export;
 *  - authoritative `rpt_owner_statement` movement types ('payment' /
 *    'expense' / 'settlement') falling back to the generic label.
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

import type { OwnerStatementReport } from '@/features/financials/reports/financialReportsService';
import { downloadOwnerStatementExcel } from '../premium/statement-report-actions';
import {
  OWNER_STATEMENT_GENERIC_TRANSACTION_LABEL,
  ownerStatementTransactionTypeLabels,
} from '@/features/financials/reports/statement-ledger';

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
    downloadOwnerStatementExcel(testStatement, 'o-01');

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
    downloadOwnerStatementExcel(testStatement, 'o-01');

    const blob = downloadCalls[0].blob as { rows: ReadonlyArray<readonly unknown[]> };
    expect(blob.rows).toHaveLength(3);

    // Row 0: payment — the authoritative rpt_owner_statement rent-collection type
    expect(blob.rows[0][0]).toBe('2026-02-10');
    expect(blob.rows[0][1]).toBe(ownerStatementTransactionTypeLabels.payment);
    expect(blob.rows[0][1]).not.toBe(OWNER_STATEMENT_GENERIC_TRANSACTION_LABEL);
    expect(blob.rows[0][4]).toBe(1000);
    expect(blob.rows[0][5]).toBe(50);
    expect(blob.rows[0][6]).toBe(950);
    // No 8th column (running balance)
    expect((blob.rows[0] as unknown[])[7]).toBeUndefined();

    // Row 1: expense (statement authority only lists owner-charged expenses)
    expect(blob.rows[1][1]).toBe('مصروف مُحمَّل على المالك');
    expect(blob.rows[1][4]).toBe(120);

    // Row 2: settlement
    expect(blob.rows[2][1]).toBe('تسوية / صرف');
    expect(blob.rows[2][6]).toBe(-800);
  });

  it('labels an unknown movement type truthfully as a generic movement', () => {
    downloadOwnerStatementExcel({
      ...testStatement,
      transactions: [{ ...testStatement.transactions[0], type: 'legacy_adjustment' }],
    }, 'o-01');

    const blob = downloadCalls[0].blob as { rows: ReadonlyArray<readonly unknown[]> };
    expect(blob.rows[0][1]).toBe(OWNER_STATEMENT_GENERIC_TRANSACTION_LABEL);
  });

  it('refuses to emit a workbook without an authoritative statement', () => {
    downloadOwnerStatementExcel(null, 'o-01');
    downloadOwnerStatementExcel(undefined, 'o-01');
    expect(downloadCalls).toHaveLength(0);
  });

  it('produces the correct filename', () => {
    downloadOwnerStatementExcel(testStatement, 'o-01');
    expect(downloadCalls[0].fileName).toBe('owner-statement-o-01.xlsx');
  });

  it('does NOT derive opening balance from zero', () => {
    downloadOwnerStatementExcel(testStatement, 'o-01');

    const blob = downloadCalls[0].blob as { rows: ReadonlyArray<readonly unknown[]> };
    // If a running balance were derived from zero, the first row's
    // cumulative would be 950 (0 + 950). We assert there IS no 8th column.
    for (const row of blob.rows) {
      expect((row as unknown[])[7]).toBeUndefined();
    }
  });
});
