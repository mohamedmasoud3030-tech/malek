import { describe, expect, it } from 'vitest';
import {
  buildMonthlyCashflowChartRows,
  formatMonthLabel,
  getFinancialPerformanceRange,
} from './financial-performance';

describe('getFinancialPerformanceRange', () => {
  const today = new Date('2026-08-29T10:00:00');

  it('spans six calendar months for the default window', () => {
    const range = getFinancialPerformanceRange('six_months', today);
    expect(range.dateFrom).toBe('2026-03-01');
    expect(range.dateTo).toBe('2026-08-29');
  });

  it('spans twelve calendar months for the year window', () => {
    const range = getFinancialPerformanceRange('year', today);
    expect(range.dateFrom).toBe('2025-09-01');
    expect(range.dateTo).toBe('2026-08-29');
  });

  it('crosses year boundaries without drift', () => {
    const range = getFinancialPerformanceRange('six_months', new Date('2026-02-10T10:00:00'));
    expect(range.dateFrom).toBe('2025-09-01');
  });
});

describe('buildMonthlyCashflowChartRows', () => {
  it('renders only the months the authoritative service returns — no padding, no invention', () => {
    const rows = buildMonthlyCashflowChartRows([
      { month: '2026-07', revenue: 120, expenses: 30 },
      { month: '2026-03', revenue: 90, expenses: 25 },
    ]);
    expect(rows.map((row) => row.month)).toEqual(['2026-03', '2026-07']);
    expect(rows[0]).toMatchObject({ collected: 90, expenses: 25 });
    expect(rows[1]).toMatchObject({ collected: 120, expenses: 30 });
  });

  it('returns an empty chart for an empty service result so the UI shows the honest empty state', () => {
    expect(buildMonthlyCashflowChartRows([])).toEqual([]);
    expect(buildMonthlyCashflowChartRows(undefined)).toEqual([]);
  });

  it('labels months in Arabic without leaking implementation dates', () => {
    expect(formatMonthLabel('2026-03')).not.toBe('2026-03');
    expect(formatMonthLabel('not-a-month')).toBe('not-a-month');
  });
});
