import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CollectionsSection } from './components/CollectionsSection';
import { OverdueSection } from './components/OverdueSection';

vi.mock('@/features/settings/useCompanySettings', () => ({
  useCompanySettings: () => ({ data: { company_name: 'مكتب الاختبار', currency: 'OMR' } }),
}));

vi.mock('@/app/router/background-location', () => ({
  useDialogNavigate: () => () => undefined,
}));

const collectionsProps = {
  summary: { invoiced: 1000, paid: 800, outstanding: 200 },
  rows: [
    {
      paymentDate: '2026-08-01',
      totalPaid: 800,
      paymentsCount: 2,
      methodTotals: { cash: 500, bank_transfer: 300, card: 0, check: 0, other: 0 },
    },
  ],
  receiptRows: [],
  rentRollRows: [],
  canExportReports: true,
  isLoading: false,
  from: '2026-08-01',
  to: '2026-08-27',
};

const overdueProps = {
  rows: [
    {
      invoiceId: 'inv-1',
      shortInvoiceId: 'INV-1',
      contractId: 'ctr-1',
      tenantId: null,
      tenantName: 'أحمد',
      tenantPhone: null,
      propertyId: null,
      propertyTitle: 'عقار ١',
      unitId: null,
      unitNumber: '101',
      dueDate: '2026-07-01',
      daysOverdue: 57,
      amount: 500,
      paidAmount: 0,
      remainingAmount: 500,
      status: 'issued',
      invoiceReference: 'INV-2026-1',
      contractReference: 'CNT-1',
    },
  ],
  agedReport: {
    asOf: '2026-08-27',
    buckets: { days_1_30: { label: '1-30 يوم', total: 0, invoiceCount: 0 } },
  },
  summary: { totalOverdue: 500, averageDaysOverdue: 57, over90Amount: 0, over90InvoiceCount: 0, asOf: '2026-08-27' },
  canExportReports: true,
  isLoading: false,
};

describe('canonical report pattern: Summary → Visual Insight → Detailed Table', () => {
  it('collections report renders summary KPIs, visual progress, insight and detail table', () => {
    const markup = renderToStaticMarkup(<CollectionsSection {...(collectionsProps as any)} />);
    // Summary layer: canonical summary marker lives on the KPI grid.
    expect(markup).toContain('data-report-summary');
    // Visual layer: at least one progress/ratio visual block.
    expect(markup).toMatch(/data-report-visual/);
    // Insight layer: business-language reading note.
    expect(markup).toMatch(/data-report-insight/);
    // Detail layer: an accessible detail table plus the canonical action group.
    expect(markup).toContain('جدول التحصيل اليومي');
    expect(markup).toContain('data-report-share-actions');
  });

  it('overdue report renders summary KPIs, visual progress, insight and detail table', () => {
    const markup = renderToStaticMarkup(<OverdueSection {...(overdueProps as any)} />);
    expect(markup).toContain('data-report-summary');
    expect(markup).toMatch(/data-report-visual/);
    expect(markup).toMatch(/data-report-insight/);
    expect(markup).toContain('الفواتير المتأخرة');
    expect(markup).toContain('data-report-share-actions');
    // Prepared WhatsApp/share actions are present for permitted users.
    expect(markup).toContain('واتساب');
    expect(markup).toContain('مشاركة');
  });

  it('never hides share/print/export behind the wrong permission state', () => {
    const markup = renderToStaticMarkup(
      <OverdueSection {...(overdueProps as any)} canExportReports={false} />,
    );
    expect(markup).not.toContain('data-report-share-actions');
  });
});
