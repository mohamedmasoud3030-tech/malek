import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { OverdueInvoicesReport } from '../reports/financialReportsService';
import { ArrearsSummaryCards } from './arrears-summary-cards';
import { ArrearsWorkflowSection } from './arrears-workflow-section';

const baseProps = {
  asOf: '2026-05-15',
  search: '',
  bucketFilter: 'all' as const,
  overdueReport: undefined,
  agedReceivablesReport: undefined,
  arrearsSummaryReport: undefined,
  isLoading: false,
  isError: false,
  error: undefined,
  onAsOfChange: vi.fn(),
  onSearchChange: vi.fn(),
  onBucketFilterChange: vi.fn(),
  onSelectInvoice: vi.fn(),
};

const overdueReport: OverdueInvoicesReport = {
  asOf: '2026-05-15',
  totalOverdue: 800,
  invoiceCount: 1,
  rows: [
    {
      invoiceId: 'invoice_alpha_123456',
      shortInvoiceId: 'invoice_',
      contractId: 'contract_alpha_123456',
      tenantId: 'tenant_alpha',
      tenantName: 'أحمد علي',
      propertyId: 'property_alpha',
      propertyTitle: 'برج النخيل',
      unitId: 'unit_alpha',
      unitNumber: 'A-101',
      dueDate: '2026-04-01',
      daysOverdue: 44,
      amount: 1000,
      paidAmount: 200,
      remainingAmount: 800,
      status: 'partial',
    },
  ],
};

describe('ArrearsWorkflowSection', () => {
  it('renders the loading state', () => {
    const html = renderToStaticMarkup(<ArrearsWorkflowSection {...baseProps} isLoading />);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="جارٍ تحميل بيانات المتأخرات"');
    expect(html).toContain('data-loading-state');
  });

  it('renders the error state', () => {
    const html = renderToStaticMarkup(<ArrearsWorkflowSection {...baseProps} isError error={new Error('تعذر تحميل الاختبار')} />);

    expect(html).toContain('تعذر تحميل الاختبار');
  });

  it('keeps invoice context and actions in one register without a duplicate detail card', () => {
    const html = renderToStaticMarkup(<ArrearsWorkflowSection {...baseProps} overdueReport={overdueReport} />);

    expect(html).toContain('جدول الفواتير المتأخرة');
    expect(html).toContain('أحمد علي');
    expect(html).not.toContain('تفاصيل التحصيل');
    expect(html).not.toContain('عرض الفاتورة في قسم الفواتير');
  });

  it('renders summary cards when aged receivables buckets are missing from report data', () => {
    const reportWithoutBuckets = { totalOutstanding: 50 } as Parameters<typeof ArrearsSummaryCards>[0]['agedReceivablesReport'];
    const html = renderToStaticMarkup(
      <ArrearsSummaryCards overdueReport={undefined} agedReceivablesReport={reportWithoutBuckets} arrearsSummaryReport={undefined} />,
    );

    expect(html).toContain('ملخص المتأخرات');
    expect(html).toContain('المتبقي');
    expect(html).toContain('50.000');
  });
});
