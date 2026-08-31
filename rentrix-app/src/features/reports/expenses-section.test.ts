import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ExpensesSection — Phase 2B semantic contracts', () => {
  const src = readFileSync(
    resolve(process.cwd(), 'src/features/reports/components/ExpensesSection.tsx'),
    'utf8',
  );
  const adapter = readFileSync(
    resolve(process.cwd(), 'src/features/reports/workspace/adapters/AnalyticsReportsAdapter.tsx'),
    'utf8',
  );

  it('uses the selected report period for documents and share targets', () => {
    expect(src).toContain('from: string;');
    expect(src).toContain('to: string;');
    expect(src).toContain('periodFrom: from,');
    expect(src).toContain('periodTo: to,');
    expect(src).toContain('asOf: to,');
    expect(src).not.toContain('getTodayLocalDateString');
  });

  it('threads the active workspace filters and drill handler from the analytics adapter', () => {
    expect(adapter).toContain('from={filters.from}');
    expect(adapter).toContain('to={filters.to}');
    expect(adapter).toContain('onDrill={onDrill}');
  });

  it('does not invent a zero average when the period has no expense rows', () => {
    expect(src).toContain('const averageExpense = expensesCount > 0 ? totalExpenses / expensesCount : undefined');
    expect(src).toContain("averageExpense !== undefined ? formatMoney(averageExpense) : '—'");
  });

  it('uses canonical report primitives and Button for drill-through', () => {
    expect(src).toContain("import { Button } from '@/components/ui/button'");
    expect(src).toContain('ReportSummaryStrip');
    expect(src).toContain('ReportInsightNote');
    expect(src).toContain('ReportProgress');
    expect(src).toContain('ReportList');
    expect(src).toContain('ReportListRow');
    expect(src).toContain('ReportPanel');
    expect(src).toContain('ReportState');
    expect(src).toContain('ReportColumns');
    expect(src).not.toContain('<button');
  });

  it('preserves expense-domain semantics without profit or maintenance recomputation', () => {
    expect(src).not.toContain('ربح');
    expect(src).not.toContain('خسارة');
    expect(src).not.toContain('صافي الدخل');
    expect(src).not.toContain('صافي الربح');
    expect(src).not.toContain('maintenanceRecordedCost');
    expect(src).not.toContain('maintenance_cost');
  });

  it('keeps deterministic concentration insights and property drill-through', () => {
    expect(src).toContain('topCategoryShare > 60');
    expect(src).toContain('topPropertyShare > 65');
    expect(src).toContain('قراءة المصروفات');
    expect(src).toContain("onDrill('operations', 'operations_overview', { propertyId: row.propertyId })");
  });
});
