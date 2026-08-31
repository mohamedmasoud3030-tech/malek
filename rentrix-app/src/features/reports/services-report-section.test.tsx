import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ServicesReportSection } from './components/ServicesReportSection';
import type { ResponsibleParty, UtilityBill } from '@/features/utilities/use-utilities';
import type { UtilityMeter } from '@/features/utilities/utilities-service';
import type { ReportsFilterState } from './reports-workspace-filters';

vi.mock('@/features/utilities/use-utilities', () => ({
  responsiblePartyLabels: { tenant: 'المستأجر', landlord: 'المالك', company: 'شركة الإدارة' },
  utilityBillStatusLabels: { unpaid: 'مستحقة السداد', partially_paid: 'مدفوعة جزئياً', paid: 'مسددة بالكامل' },
  utilityTypeLabels: { electricity: 'كهرباء', water: 'مياه', sanitation: 'صرف صحي', internet: 'إنترنت وتواصل', gas: 'غاز', other: 'مرافق أخرى' },
  useUtilityBills: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
  useUtilityMeters: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
}));

vi.mock('@/features/settings/useCompanySettings', () => ({
  useCompanySettings: () => ({ data: { company_name: 'مكتب الاختبار', currency: 'OMR' } }),
}));

vi.mock('@/app/router/background-location', () => ({
  useDialogNavigate: () => () => undefined,
}));

vi.mock('./reports-page.helpers', () => ({
  buildReportCsvFilename: (slug: string) => `${slug}-test.csv`,
  usePropertyTitles: () => ({ data: [{ id: 'p1', title: 'عقار النخيل' }, { id: 'p2', title: null }] }),
}));

import { useUtilityBills, useUtilityMeters } from '@/features/utilities/use-utilities';

const mockedUseUtilityBills = vi.mocked(useUtilityBills);
const mockedUseUtilityMeters = vi.mocked(useUtilityMeters);

function isoDaysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeBill(overrides: Partial<UtilityBill> & { id: string }): UtilityBill {
  return {
    meter_id: null,
    property_id: 'p1',
    unit_id: null,
    bill_number: null,
    billing_period_start: null,
    billing_period_end: null,
    previous_reading: null,
    current_reading: null,
    consumption_units: null,
    amount: 0,
    paid_amount: 0,
    due_date: isoDaysFromToday(10),
    status: 'unpaid',
    responsible_party: 'landlord',
    actual_payer: null,
    attachment_url: null,
    notes: null,
    created_at: `${isoDaysFromToday(-10)}T08:00:00`,
    ...overrides,
  } as UtilityBill;
}

const meters: UtilityMeter[] = [
  { id: 'm1', property_id: 'p1', unit_id: 'u1', utility_type: 'electricity', meter_number: 'EL-1', account_number: 'A-1', provider_name: 'كهرباء عمان', responsible_party: 'landlord' as ResponsibleParty, is_active: true, notes: null, created_at: isoDaysFromToday(-100) },
  { id: 'm2', property_id: 'p1', unit_id: 'u1', utility_type: 'water', meter_number: 'WA-1', account_number: 'A-2', provider_name: null, responsible_party: 'tenant' as ResponsibleParty, is_active: true, notes: null, created_at: isoDaysFromToday(-100) },
];

const bills: UtilityBill[] = [
  // Overdue: unpaid, due 5 days before the as-of date, no proof attached.
  makeBill({ id: 'b1', meter_id: 'm1', bill_number: 'UT-001', amount: 100, paid_amount: 0, due_date: isoDaysFromToday(-5), status: 'unpaid', responsible_party: 'landlord' }),
  // Due soon: partially paid, due in 3 days, proof attached.
  makeBill({ id: 'b2', meter_id: 'm2', bill_number: 'UT-002', amount: 200, paid_amount: 50, due_date: isoDaysFromToday(3), status: 'partially_paid', responsible_party: 'tenant', actual_payer: 'tenant', attachment_url: 'proof-2.pdf' }),
  // Settled: fully paid in the past.
  makeBill({ id: 'b3', property_id: 'p2', bill_number: 'UT-003', amount: 50, paid_amount: 50, due_date: isoDaysFromToday(-10), status: 'paid', responsible_party: 'company' }),
];

const filters: ReportsFilterState = {
  from: isoDaysFromToday(-30),
  to: isoDaysFromToday(30),
  asOf: isoDaysFromToday(0),
  costCenterId: '',
  ownerId: '',
  contractId: '',
  propertyId: '',
  unitId: '',
};

function renderSection(canExportReports = true, scopedBills: UtilityBill[] | undefined = bills) {
  mockedUseUtilityBills.mockReturnValue({ data: scopedBills, isLoading: false, isError: false } as ReturnType<typeof useUtilityBills>);
  mockedUseUtilityMeters.mockReturnValue({ data: meters, isLoading: false, isError: false } as ReturnType<typeof useUtilityMeters>);
  return renderToStaticMarkup(<ServicesReportSection filters={filters} canExportReports={canExportReports} />);
}

describe('ServicesReportSection — payment/review obligations contracts', () => {
  it('renders the canonical report pattern from the utilities register', () => {
    const markup = renderSection();
    expect(markup).toContain('data-report-summary');
    expect(markup).toContain('data-services-report');
    expect(markup).toContain('data-report-visual');
    expect(markup).toContain('data-report-insight');
    expect(markup).toContain('data-report-share-actions');
    expect(markup).toContain('data-entity-table');
    expect(markup).toContain('فواتير الخدمات والمرافق');
  });

  it('surfaces overdue and due-soon urgency with days, from the canonical obligation derivation', () => {
    const markup = renderSection();
    expect(markup).toContain('متأخرة 5 يوم');
    expect(markup).toContain('خلال 3 يوم');
    expect(markup).toContain('متأخر السداد');
    expect(markup).toContain('1 فاتورة بعد موعدها');
  });

  it('shows property context and payment evidence', () => {
    const markup = renderSection();
    expect(markup).toContain('عقار النخيل');
    expect(markup).toContain('يوجد إثبات');
    expect(markup).toContain('دفعها المستأجر');
    expect(markup).toContain('كهرباء');
  });

  it('derives payment progress and overdue share only from bills in scope', () => {
    const markup = renderSection();
    // 100 paid of 350 billed = 29%; overdue remaining 100 of 350 = 29%.
    expect(markup).toContain('نسبة السداد من المستحق');
    expect(markup).toContain('حصة المتأخر من المستحق');
    const percentSpans = markup.match(/29(?:<!-- -->)?%/g) ?? [];
    expect(percentSpans.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps responsibility as recorded: outstanding remaining by responsible party', () => {
    const markup = renderSection();
    expect(markup).toContain('غير المسدد حسب جهة التحمل');
    expect(markup).toContain('المالك');
    expect(markup).toContain('شركة الإدارة');
    expect(markup).toContain('1 فاتورة في النطاق · 1 غير مسددة');
  });

  it('ranks the payment priority queue: overdue first, then due soon, then the outstanding total', () => {
    const markup = renderSection();
    expect(markup).toContain('أولوية السداد');
    expect(markup).toContain('تجاوزت موعد الاستحقاق ولم تُسدد');
    expect(markup).toContain('تستحق خلال نافذة الأيام القريبة');
  });

  it('hands off execution to the utilities workspace regardless of export permission', () => {
    const withPermission = renderSection(true);
    expect(withPermission).toContain('شاشة المرافق');

    const withoutPermission = renderSection(false);
    expect(withoutPermission).toContain('شاشة المرافق');
    expect(withoutPermission).not.toContain('data-report-share-actions');
  });

  it('invents nothing when the scope has no bills', () => {
    const markup = renderSection(true, []);
    expect(markup).toContain('لا توجد خدمات في هذا النطاق');
    expect(markup).not.toContain('نسبة السداد من المستحق');
    expect(markup).not.toContain('حصة المتأخر من المستحق');
  });
});

describe('ServicesReportSection — source semantic contracts', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/features/reports/components/ServicesReportSection.tsx'), 'utf8');

  it('uses the canonical utilities obligation module instead of a parallel overdue rule', () => {
    expect(src).toContain("from '@/features/utilities/utility-obligations'");
    expect(src).toContain('deriveUtilityObligations(rows, filters.asOf)');
    expect(src).toContain('summarizeUtilityObligations(obligations)');
    expect(src).toContain('compareUtilityObligationUrgency');
    expect(src).not.toContain("due_date < filters.asOf");
  });

  it('keeps remaining amounts on the shared OMR-grid helper', () => {
    expect(src).toContain('utilityBillRemaining(row)');
    expect(src).not.toContain('row.amount || 0) - Number(row.paid_amount || 0)');
  });

  it('never invents payment ratios without bills in scope', () => {
    expect(src).toContain('const paymentProgress = totalBilled > 0');
    expect(src).toContain('const overdueShare = totalBilled > 0');
  });

  it('uses canonical shared controls: EntityTable, primitives, Button — no local copies', () => {
    expect(src).toContain("import { EntityTable, type ColumnDef } from '@/components/ui/entity-table'");
    expect(src).toContain("import { Button } from '@/components/ui/button'");
    expect(src).toContain("from '@/components/ui/report-section-primitives'");
    expect(src).toContain('ReportSummaryStrip');
    expect(src).toContain('ReportProgress');
    expect(src).toContain('ReportInsightNote');
    expect(src).toContain('ReportList');
    expect(src).toContain('ReportListRow');
    expect(src).toContain('ReportPanel');
    expect(src).toContain('ReportState');
    expect(src).not.toContain('<button');
  });

  it('keeps interactive controls at the 44px minimum touch target', () => {
    expect(src).not.toMatch(/min-h-(8|9|10)\b/);
    expect(src).toContain('min-h-11');
  });
});
