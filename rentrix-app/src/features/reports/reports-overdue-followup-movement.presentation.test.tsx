import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import { CollectionMovementSection } from './components/CollectionMovementSection';
import { FollowUpSection, getFollowUpTier } from './components/FollowUpSection';
import { OverdueSection } from './components/OverdueSection';

vi.mock('@/features/settings/useCompanySettings', () => ({
  useCompanySettings: () => ({ data: { company_name: 'مكتب الاختبار', currency: 'OMR' } }),
}));

vi.mock('@/app/router/background-location', () => ({
  useDialogNavigate: () => () => undefined,
}));

function makeOverdueRow(overrides: Partial<OverdueInvoiceReportRow> = {}): OverdueInvoiceReportRow {
  return {
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
    ...overrides,
  } as OverdueInvoiceReportRow;
}

const agedReport = {
  asOf: '2026-08-27',
  buckets: {
    current: { label: 'غير متأخر', total: 900, invoiceCount: 3 },
    days_1_30: { label: '1–30 يوم', total: 200, invoiceCount: 1 },
    days_31_60: { label: '31–60 يوم', total: 500, invoiceCount: 1 },
    days_61_90: { label: '61–90 يوم', total: 0, invoiceCount: 0 },
    days_90_plus: { label: 'أكثر من 90 يوم', total: 50, invoiceCount: 1 },
  },
};

const arrearsSummary = {
  totalOverdue: 750,
  overdueInvoiceCount: 3,
  over90Amount: 50,
  over90InvoiceCount: 1,
  averageDaysOverdue: 42,
  asOf: '2026-08-27',
};

describe('Overdue report — authoritative arrears semantics', () => {
  it('renders executive figures from the arrears summary, not from rendered rows', () => {
    const markup = renderToStaticMarkup(
      <OverdueSection
        rows={[makeOverdueRow()]}
        agedReport={agedReport as never}
        summary={arrearsSummary as never}
        canExportReports
        isLoading={false}
      />,
    );
    // rows sum to 500, the authoritative summary says 750 — the strip must show 750.
    expect(markup).toContain('data-report-summary="overdue"');
    expect(markup).toContain(formatMoney(750));
    expect(markup).toContain('لا يشمل الرصيد الجاري');
    // average delay comes from the summary (42), never recomputed from rows (57).
    expect(markup).toContain('42');
    expect(markup).toContain('data-report-visual');
    expect(markup).toContain('data-report-insight');
  });

  it('shows unavailable instead of a row-derived or zero substitute when the summary is missing', () => {
    const markup = renderToStaticMarkup(
      <OverdueSection
        rows={[makeOverdueRow()]}
        agedReport={agedReport as never}
        summary={undefined}
        canExportReports
        isLoading={false}
      />,
    );
    expect(markup).toContain('الملخص المعتمد غير متاح');
    expect(markup).toContain('ملخص المتأخرات المعتمد غير متاح');
    // No fabricated averages/exposure indicators without the authoritative source.
    expect(markup).not.toContain('متوسط عمر المتأخر');
    expect(markup).not.toContain('تركيز الذمم القديمة');
    // The detailed table stays available as served.
    expect(markup).toContain('تحليل المتأخرات');
  });

  it('never presents the current (not-yet-due) bucket as overdue', () => {
    const markup = renderToStaticMarkup(
      <OverdueSection
        rows={[makeOverdueRow()]}
        agedReport={agedReport as never}
        summary={arrearsSummary as never}
        canExportReports
        isLoading={false}
      />,
    );
    expect(markup).toContain('غير متأخر');
    expect(markup).toContain('ليس متأخرًا');
    expect(markup).toContain('لا تُحتسب ضمن المتأخرات');
  });
});

describe('Follow-up report — action-first queue semantics', () => {
  const followUpRows = [
    makeOverdueRow({ invoiceId: 'inv-a', tenantName: 'مستأجر-قيمة-عالية', remainingAmount: 900, daysOverdue: 40 }),
    makeOverdueRow({ invoiceId: 'inv-b', tenantName: 'مستأجر-تصعيد', remainingAmount: 300, daysOverdue: 120 }),
    makeOverdueRow({ invoiceId: 'inv-c', tenantName: 'مستأجر-عادي', remainingAmount: 100, daysOverdue: 10 }),
  ];

  it('ranks by risk (value then age) and flags >90-day items for escalation', () => {
    const markup = renderToStaticMarkup(
      <FollowUpSection rows={followUpRows} canExportReports isLoading={false} />,
    );
    const first = markup.indexOf('مستأجر-قيمة-عالية');
    const second = markup.indexOf('مستأجر-تصعيد');
    const third = markup.indexOf('مستأجر-عادي');
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
    expect(markup).toContain('تصعيد فوري');
    expect(markup).toContain('ابدأ من هنا');
  });

  it('scopes queue figures to the displayed work list instead of restating total overdue', () => {
    const markup = renderToStaticMarkup(
      <FollowUpSection rows={followUpRows} canExportReports isLoading={false} />,
    );
    expect(markup).toContain('data-report-summary="follow-up"');
    expect(markup).toContain('ليست إجمالي المتأخرات');
    expect(markup).toContain(formatMoney(1300));
    expect(markup).not.toContain('إجمالي المتأخر المعتمد');
  });

  it('caps the queue at the top 20 by risk and keeps export permission-gated', () => {
    const manyRows = Array.from({ length: 25 }, (_, index) =>
      makeOverdueRow({ invoiceId: `inv-${index}`, tenantName: `مستأجر-${index}`, remainingAmount: 1000 - index }),
    );
    const markup = renderToStaticMarkup(
      <FollowUpSection rows={manyRows} canExportReports isLoading={false} />,
    );
    expect(markup.match(/>متابعة</g)?.length).toBe(20);

    const withoutExport = renderToStaticMarkup(
      <FollowUpSection rows={manyRows} canExportReports={false} isLoading={false} />,
    );
    expect(withoutExport).not.toContain('CSV');
  });

  it('escalation tiering is deterministic on age', () => {
    expect(getFollowUpTier(120).tone).toBe('danger');
    expect(getFollowUpTier(75).tone).toBe('warning');
    expect(getFollowUpTier(15).tone).toBe('neutral');
  });
});

describe('Collection Movement report — transactional movement semantics', () => {
  const dailyRows = [
    {
      paymentDate: '2026-08-02',
      totalPaid: 300,
      paymentsCount: 2,
      methodTotals: { cash: 300, bank_transfer: 0, card: 0, check: 0, other: 0 },
    },
    {
      paymentDate: '2026-08-05',
      totalPaid: 400,
      paymentsCount: 1,
      methodTotals: { cash: 0, bank_transfer: 400, card: 0, check: 0, other: 0 },
    },
  ];
  const movementSummary = {
    invoiced: 1000,
    paid: 800,
    outstanding: 200,
    receiptsCount: 3,
    invoicesCount: 4,
    expensesTotal: 0,
  };

  it('renders the authoritative collected figure, not a row-derived replacement', () => {
    const markup = renderToStaticMarkup(
      <CollectionMovementSection
        summary={movementSummary as never}
        rows={dailyRows as never}
        receiptRows={[]}
        from="2026-08-01"
        to="2026-08-27"
        canExportReports
        isLoading={false}
      />,
    );
    // rows sum to 700; the authoritative period figure is 800.
    expect(markup).toContain(formatMoney(800));
    expect(markup).not.toContain(formatMoney(700));
    expect(markup).toContain('قيمة معتمدة من ملخص الفترة');
  });

  it('shows unavailable instead of substituting a daily-rows total when the summary is missing', () => {
    const markup = renderToStaticMarkup(
      <CollectionMovementSection
        summary={undefined}
        rows={dailyRows as never}
        receiptRows={[]}
        from="2026-08-01"
        to="2026-08-27"
        canExportReports
        isLoading={false}
      />,
    );
    expect(markup).toContain('الملخص المعتمد غير متاح');
    expect(markup).not.toContain(formatMoney(700));
  });

  it('stays movement-oriented: method mix and busiest day, no executive-summary duplication', () => {
    const markup = renderToStaticMarkup(
      <CollectionMovementSection
        summary={movementSummary as never}
        rows={dailyRows as never}
        receiptRows={[]}
        from="2026-08-01"
        to="2026-08-27"
        canExportReports
        isLoading={false}
      />,
    );
    expect(markup).toContain('حركة طرق السداد');
    expect(markup).toContain('تحويل بنكي');
    expect(markup).toContain('أعلى يوم تحصيلًا');
    // Executive collections figures stay in the Collections summary report.
    expect(markup).not.toContain('كفاءة التحصيل');
    expect(markup).not.toContain('الرصيد المستحق');
    expect(markup).not.toContain('المفوتر');
  });

  it('gates share/export on the reports export permission', () => {
    const withExport = renderToStaticMarkup(
      <CollectionMovementSection
        summary={movementSummary as never}
        rows={dailyRows as never}
        receiptRows={[]}
        from="2026-08-01"
        to="2026-08-27"
        canExportReports
        isLoading={false}
      />,
    );
    expect(withExport).toContain('data-report-share-actions');

    const withoutExport = renderToStaticMarkup(
      <CollectionMovementSection
        summary={movementSummary as never}
        rows={dailyRows as never}
        receiptRows={[]}
        from="2026-08-01"
        to="2026-08-27"
        canExportReports={false}
        isLoading={false}
      />,
    );
    expect(withoutExport).not.toContain('data-report-share-actions');
  });
});
