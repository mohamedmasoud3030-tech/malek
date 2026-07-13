import { supabase } from '@/lib/supabase';
import { toFinancialNumber } from '../financialMath';

export type ReportPeriod = { from: string | null; to: string | null };

export type CashFlowStatementReport = {
  period: ReportPeriod;
  operating: {
    receipts: number;
    expenses: number;
    netOperating: number;
  };
  investing: { amount: number; note: string | null };
  financing: { amount: number; note: string | null };
  netChange: number;
};

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

export function normalizeCashFlowStatementReport(payload: unknown): CashFlowStatementReport {
  const root = asRecord(payload);
  const period = asRecord(root.period);
  const operating = asRecord(root.operating);
  const investing = asRecord(root.investing);
  const financing = asRecord(root.financing);

  return {
    period: { from: asString(period.from), to: asString(period.to) },
    operating: {
      receipts: asNumber(operating.receipts),
      expenses: asNumber(operating.expenses),
      netOperating: asNumber(operating.net_operating),
    },
    investing: { amount: asNumber(investing.amount), note: asString(investing.note) },
    financing: { amount: asNumber(financing.amount), note: asString(financing.note) },
    netChange: asNumber(root.net_change),
  };
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

export async function getCashFlowStatementReport(filters: StatementReportFilters): Promise<CashFlowStatementReport> {
  const { data, error } = await supabase.rpc('rpt_cash_flow', {
    p_from_date: filters.dateFrom,
    p_to_date: filters.dateTo,
  });
  if (error) throw error;
  return normalizeCashFlowStatementReport(data);
}

export async function getVatReturnReport(filters: StatementReportFilters): Promise<VatReturnReport> {
  const { data, error } = await supabase.rpc('rpt_vat_return', {
    p_from_date: filters.dateFrom,
    p_to_date: filters.dateTo,
  });
  if (error) throw error;
  return normalizeVatReturnReport(data);
}
