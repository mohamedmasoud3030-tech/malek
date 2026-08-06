import { FileText, WalletCards } from 'lucide-react';
import type { InvoiceSummary, InvoiceStatusFilter } from '../invoices/invoiceService';
import { formatMoney } from './financials-formatters';
import { FinanceKpiGrid, FinanceKpiCard } from './finance-reporting-visual-foundations';

type InvoiceSummaryCardsProps = {
  summary: InvoiceSummary;
  // For drill-down preservation
  currentFilters?: {
    dateFrom?: string;
    dateTo?: string;
    tenantId?: string;
    propertyId?: string;
  };
  onStatusDrill?: (status: InvoiceStatusFilter) => void;
};

export function InvoiceSummaryCards({ summary, currentFilters, onStatusDrill }: InvoiceSummaryCardsProps) {
  return (
    <FinanceKpiGrid desktopColumns={5} aria-label="ملخص الفواتير">
      <FinanceKpiCard
        label="عدد الفواتير"
        value={summary.count}
        sub="ضمن الفلاتر الحالية"
        icon={FileText}
        accent="primary"
        drillAriaLabel={`عدد الفواتير ${summary.count} — عرض كل الفواتير`}
        onDrill={onStatusDrill ? () => onStatusDrill('all') : undefined}
      />
      <FinanceKpiCard
        label="إجمالي الفواتير شامل VAT"
        value={formatMoney(summary.totalAmount)}
        sub="قبل التخصيص"
        icon={WalletCards}
        accent="primary"
        drillAriaLabel={`إجمالي الفواتير ${summary.totalAmount} — عرض التفاصيل`}
        onDrill={onStatusDrill ? () => onStatusDrill('all') : undefined}
        unit="OMR"
      />
      <FinanceKpiCard
        label="إجمالي VAT"
        value={formatMoney(summary.totalTax)}
        sub="ضريبة القيمة المضافة"
        icon={WalletCards}
        accent="primary"
        drillAriaLabel={`إجمالي VAT ${summary.totalTax}`}
        onDrill={onStatusDrill ? () => onStatusDrill('all') : undefined}
        unit="OMR"
      />
      <FinanceKpiCard
        label="إجمالي المدفوع"
        value={formatMoney(summary.totalPaid)}
        sub="محصّل فعلي"
        icon={WalletCards}
        accent="primary"
        trend="up"
        trendValue="مدفوع"
        drillAriaLabel={`إجمالي المدفوع ${summary.totalPaid} — عرض المدفوعات`}
        onDrill={onStatusDrill ? () => onStatusDrill('paid') : undefined}
        unit="OMR"
      />
      <FinanceKpiCard
        label="إجمالي المتبقي"
        value={formatMoney(summary.totalRemaining)}
        sub="يحتاج متابعة"
        icon={WalletCards}
        accent="primary"
        trend={summary.totalRemaining > 0 ? 'down' : 'neutral'}
        trendValue={summary.totalRemaining > 0 ? 'مستحق' : 'مكتمل'}
        drillAriaLabel={`إجمالي المتبقي ${summary.totalRemaining} — عرض المتأخرات`}
        onDrill={onStatusDrill ? () => onStatusDrill('unpaid') : undefined}
        unit="OMR"
      />
    </FinanceKpiGrid>
  );
}
