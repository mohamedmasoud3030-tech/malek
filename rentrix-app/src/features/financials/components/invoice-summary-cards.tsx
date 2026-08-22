import { FileText, WalletCards } from 'lucide-react';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
import type { InvoiceSummary, InvoiceStatusFilter } from '../invoices/invoiceService';
import { formatMoney } from './financials-formatters';

type InvoiceSummaryCardsProps = {
  summary: InvoiceSummary;
  currentFilters?: {
    dateFrom?: string;
    dateTo?: string;
    tenantId?: string;
    propertyId?: string;
  };
  onStatusDrill?: (status: InvoiceStatusFilter) => void;
};

export function InvoiceSummaryCards({ summary }: InvoiceSummaryCardsProps) {
  return (
    <RegisterMetricStrip
      aria-label="ملخص الفواتير"
      items={[
        { id: 'count', label: 'الفواتير', value: summary.count, icon: FileText, hideWhenEmpty: true },
        { id: 'total', label: 'الإجمالي', value: formatMoney(summary.totalAmount), icon: WalletCards },
        { id: 'paid', label: 'المدفوع', value: formatMoney(summary.totalPaid), icon: WalletCards, tone: 'success' },
        { id: 'remaining', label: 'المتبقي', value: formatMoney(summary.totalRemaining), icon: WalletCards, tone: summary.totalRemaining > 0 ? 'danger' : 'success', hideWhenEmpty: true },
      ]}
    />
  );
}
