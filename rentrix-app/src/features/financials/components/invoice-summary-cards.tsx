import { FileText, WalletCards } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import type { InvoiceSummary } from '../invoices/invoiceService';
import { formatMoney } from './financials-formatters';

type InvoiceSummaryCardsProps = {
  summary: InvoiceSummary;
};

export function InvoiceSummaryCards({ summary }: InvoiceSummaryCardsProps) {
  return (
    <ResponsiveCardGrid desktopColumns={5}>
      <KpiCard label="عدد الفواتير" value={summary.count} icon={FileText} accent="primary" />
      <KpiCard label="إجمالي الفواتير شامل VAT" value={formatMoney(summary.totalAmount)} icon={WalletCards} accent="sky" />
      <KpiCard label="إجمالي VAT" value={formatMoney(summary.totalTax)} icon={WalletCards} accent="primary" />
      <KpiCard label="إجمالي المدفوع" value={formatMoney(summary.totalPaid)} icon={WalletCards} accent="emerald" />
      <KpiCard label="إجمالي المتبقي" value={formatMoney(summary.totalRemaining)} icon={WalletCards} accent="amber" />
    </ResponsiveCardGrid>
  );
}
