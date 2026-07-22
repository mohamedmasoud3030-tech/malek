import { useRouter } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import type { ArrearsBucketFilter } from './arrears-workflow-helpers';
import { ArrearsWorkflowSection } from './arrears-workflow-section';
import { createInvoiceCollectHref } from '../invoices/quick-collect';
import { getTodayLocalDateString } from '../financials-date-utils';
import { useAgedReceivablesReport, useArrearsSummaryReport, useOverdueInvoicesReport } from '../reports/useFinancialReports';

export function ArrearsWorkspaceSection() {
  const { authorization } = useAuth();
  const router = useRouter();
  const canCollectPayments = canAccess(authorization, financialOperationPermissions.createPayment);
  const onCollectInvoice = (invoiceId: string) => {
    if (!canCollectPayments) return;
    void router.navigate({ href: createInvoiceCollectHref(invoiceId) });
  };
  const [arrearsAsOf, setArrearsAsOf] = useState(() => getTodayLocalDateString());
  const [arrearsSearch, setArrearsSearch] = useState('');
  const [arrearsBucketFilter, setArrearsBucketFilter] = useState<ArrearsBucketFilter>('all');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const arrearsReportFilters = useMemo(() => ({ asOf: arrearsAsOf }), [arrearsAsOf]);
  const overdueInvoicesReport = useOverdueInvoicesReport(arrearsReportFilters);
  const agedReceivablesReport = useAgedReceivablesReport(arrearsReportFilters);
  const arrearsSummaryReport = useArrearsSummaryReport(arrearsReportFilters);

  const isLoading = overdueInvoicesReport.isLoading || agedReceivablesReport.isLoading || arrearsSummaryReport.isLoading;
  const isError = overdueInvoicesReport.isError || agedReceivablesReport.isError || arrearsSummaryReport.isError;
  const error = overdueInvoicesReport.error ?? agedReceivablesReport.error ?? arrearsSummaryReport.error;

  return (
    <ArrearsWorkflowSection
      asOf={arrearsAsOf}
      search={arrearsSearch}
      bucketFilter={arrearsBucketFilter}
      overdueReport={overdueInvoicesReport.data}
      agedReceivablesReport={agedReceivablesReport.data}
      arrearsSummaryReport={arrearsSummaryReport.data}
      selectedInvoiceId={selectedInvoiceId}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onAsOfChange={setArrearsAsOf}
      onSearchChange={setArrearsSearch}
      onBucketFilterChange={setArrearsBucketFilter}
      onSelectInvoice={setSelectedInvoiceId}
      onCollectInvoice={canCollectPayments ? onCollectInvoice : undefined}
    />
  );
}
