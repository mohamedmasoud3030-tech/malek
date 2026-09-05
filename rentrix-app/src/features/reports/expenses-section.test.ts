import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ExpensesSection — Phase 2B semantic contracts', () => {
  const src = readFileSync(
    resolve(
      process.cwd(),
      'src/features/reports/components/ExpensesSection.tsx',
    ),
    'utf8',
  ).replaceAll('"', "'");
  const dispatcher = readFileSync(
    resolve(
      process.cwd(),
      'src/features/reports/components/report-view-panel.tsx',
    ),
    'utf8',
  ).replaceAll('"', "'");

  it('uses the selected report period for documents and share targets', () => {
    expect(src).toContain('from: string;');
    expect(src).toContain('to: string;');
    expect(src).toContain('periodFrom: from,');
    expect(src).toContain('periodTo: to,');
    expect(src).toContain('asOf: to,');
    expect(src).not.toContain('getTodayLocalDateString');
  });

  it('threads the active product filters and drill handler from the canonical dispatcher', () => {
    expect(dispatcher).toContain('from={filters.from}');
    expect(dispatcher).toContain('to={filters.to}');
    expect(dispatcher).toContain('onDrill={onDrill}');
  });

  it('does not invent a zero average when the period has no expense rows', () => {
    expect(src).toMatch(
      /const averageExpense =\s*expensesCount > 0 \? totalExpenses \/ expensesCount : undefined/,
    );
    expect(src).toContain(
      "averageExpense !== undefined ? formatMoney(averageExpense) : '—'",
    );
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
    expect(src).toMatch(
      /onDrill\(\s*'analytics',\s*'operations_overview',\s*\{\s*propertyId: row.propertyId/,
    );
  });
});
