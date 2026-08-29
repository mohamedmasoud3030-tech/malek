/**
 * Command center — financial performance window helpers.
 *
 * The monthly series is produced by the canonical Reports service
 * (`getFinancialCashflowReport`): gross collections and recorded expenses
 * grouped by calendar month over a complete paged read. The dashboard only
 * chooses the window and labels the months the service returns — it never
 * pads, interpolates or recomputes money values.
 */
import type { FinancialCashflowReportRow } from '@/features/financials/reports/financial-reporting/report-types';
import { toDateInputValue } from './dashboard-utils';

export type FinancialPerformanceWindow = 'six_months' | 'year';

export const financialPerformanceWindowLabels: Record<FinancialPerformanceWindow, string> = {
  six_months: '6 أشهر',
  year: 'سنة',
};

export function getFinancialPerformanceRange(window: FinancialPerformanceWindow, today: Date): { dateFrom: string; dateTo: string } {
  const monthsBack = window === 'year' ? 11 : 5;
  const start = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
  return { dateFrom: toDateInputValue(start), dateTo: toDateInputValue(today) };
}

export type MonthlyCashflowChartRow = Readonly<{
  /** 'YYYY-MM' — stable chart key. */
  month: string;
  /** Short display label, e.g. «مايو». */
  label: string;
  /** Gross collections for the month as reported by the service. */
  collected: number;
  expenses: number;
}>;

const monthLabelFormatter = new Intl.DateTimeFormat('ar', { month: 'short' });

export function formatMonthLabel(month: string): string {
  const parsed = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return month;
  return monthLabelFormatter.format(parsed);
}

/**
 * Maps the authoritative service rows onto chart rows in calendar order.
 * Months the service does not return simply do not render — absence of
 * recorded movement is never repainted as a fabricated zero series.
 */
export function buildMonthlyCashflowChartRows(rows: readonly FinancialCashflowReportRow[] | undefined): MonthlyCashflowChartRow[] {
  const sorted = [...(rows ?? [])].sort((a, b) => a.month.localeCompare(b.month));
  return sorted.map((row) => ({
    month: row.month,
    label: formatMonthLabel(row.month),
    collected: Number(row.revenue ?? 0),
    expenses: Number(row.expenses ?? 0),
  }));
}
