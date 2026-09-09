import { z } from 'zod';
import { reportMoneySchema, reportCountSchema } from '@/lib/report-value-schemas';
import { supabase } from '@/lib/supabase';

export type ReportPeriod = { from: string | null; to: string | null };

export type VatReturnReport = {
  period: ReportPeriod;
  totalSalesAmount: number;
  totalTaxAmount: number;
  invoiceCount: number;
};

export type StatementReportFilters = { dateFrom: string; dateTo: string };

const vatReportSchema = z.object({
  period: z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  total_sales_amount: reportMoneySchema,
  total_tax_amount: reportMoneySchema,
  invoice_count: reportCountSchema,
});

export function normalizeVatReturnReport(payload: unknown): VatReturnReport {
  const root = vatReportSchema.parse(payload);
  return {
    period: root.period,
    totalSalesAmount: root.total_sales_amount,
    totalTaxAmount: root.total_tax_amount,
    invoiceCount: root.invoice_count,
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
