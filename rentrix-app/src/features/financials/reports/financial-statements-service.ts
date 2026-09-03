import { supabase } from '@/lib/supabase';
import { toFinancialNumber } from '../financialMath';

export type ReportPeriod = { from: string | null; to: string | null };

export type VatReturnReport = {
  period: ReportPeriod;
  totalSalesAmount: number;
  totalTaxAmount: number;
  invoiceCount: number;
};

export type StatementReportFilters = { dateFrom: string; dateTo: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asNumber(value: unknown): number {
  return toFinancialNumber(typeof value === 'string' || typeof value === 'number' ? value : 0);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function normalizeVatReturnReport(payload: unknown): VatReturnReport {
  const root = asRecord(payload);
  const period = asRecord(root.period);
  return {
    period: { from: asString(period.from), to: asString(period.to) },
    totalSalesAmount: asNumber(root.total_sales_amount),
    totalTaxAmount: asNumber(root.total_tax_amount),
    invoiceCount: Math.trunc(asNumber(root.invoice_count)),
  };
}

export async function getVatReturnReport(filters: StatementReportFilters): Promise<VatReturnReport> {
  const { data, error } = await supabase.rpc('rpt_vat_return', {
    p_from_date: filters.dateFrom,
    p_to_date: filters.dateTo,
  });
  if (error) throw error;
  return normalizeVatReturnReport(data);
}
