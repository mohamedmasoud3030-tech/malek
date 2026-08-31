import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { OverviewSection } from './components/OverviewSection';

vi.mock('@/features/settings/useCompanySettings', () => ({
  useCompanySettings: () => ({ data: { company_name: 'مكتب الاختبار', currency: 'OMR' } }),
  useCompanySettingsContract: () => ({ currency: 'OMR', currencySymbol: 'ر.ع', decimals: 3 }),
}));

const overviewSource = readFileSync(
  resolve(process.cwd(), 'src/features/reports/components/OverviewSection.tsx'),
  'utf8',
);
const prioritiesSource = readFileSync(
  resolve(process.cwd(), 'src/features/reports/components/OperationalPrioritiesPanel.tsx'),
  'utf8',
);
const adapterSource = readFileSync(
  resolve(process.cwd(), 'src/features/reports/workspace/adapters/AnalyticsReportsAdapter.tsx'),
  'utf8',
);
const shellSource = readFileSync(
  resolve(process.cwd(), 'src/features/reports/workspace/ReportsShell.tsx'),
  'utf8',
);

const baseProps = {
  summary: {
    invoiced: 10_000,
    paid: 7_000,
    outstanding: 3_000,
    expenses: 1_200,
    netCash: 5_800,
    invoicesCount: 12,
    paymentsCount: 9,
    expensesCount: 4,
  },
  collectionSummary: {
    invoiced: 10_000,
    paid: 7_000,
    outstanding: 3_000,
    receiptsCount: 9,
    invoicesCount: 12,
    expensesTotal: 1_200,
  },
  collectionRate: 73,
  occupancyRows: [
    { property: 'برج المها', propertyId: 'p-1', shortPropertyId: 'p-1', hasTitle: true, occupied: 8, vacant: 2 },
  ],
  expiringRows: [
    {
      contractId: 'c-1',
      tenantName: 'أحمد',
      propertyTitle: 'برج المها',
      unitNumber: '101',
      endDate: '2026-10-01',
      daysRemaining: 30,
      monthlyRent: 400,
    },
  ],
  expenseRows: [{ propertyId: 'p-1', propertyTitle: 'برج المها', total: 1_200, count: 4 }],
  overdueSummary: {
    asOf: '2026-08-31',
    totalOverdue: 1_100,
    overdueInvoiceCount: 3,
    over90Amount: 0,
    over90InvoiceCount: 0,
    averageDaysOverdue: 21,
  },
  maintenanceSummary: { total: 6, open: 2, inProgress: 1, urgent: 1 },
  from: '2026-08-01',
  to: '2026-08-31',
  canExportReports: true,
  isLoading: false,
  onDrill: vi.fn(),
};

type OverviewProps = React.ComponentProps<typeof OverviewSection>;

const render = (overrides: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <OverviewSection {...({ ...baseProps, ...overrides } as unknown as OverviewProps)} />,
  );

describe('Office Overview — decision surface, not a second dashboard', () => {
  it('summarizes the period in one authoritative strip instead of a KPI card grid', () => {
    const markup = render();

    expect(markup).toContain('data-report-summary="office-overview"');
    expect(markup).toContain('خلاصة المكتب');
    expect(markup).toContain('المستحق للفترة');
    expect(markup).toContain('المحصّل');
    expect(markup).toContain('المتبقي');
    expect(markup).toContain('المتأخر');
    expect(markup).toContain('نسبة الإشغال');
    expect(markup).toContain('المصروفات المسجلة');
  });

  it('stays compact: three panels, no duplicated report detail and no second toolbar', () => {
    const markup = render();
    const panels = markup.match(/data-report-panel/g) ?? [];

    expect(panels).toHaveLength(3);
    expect(markup).toContain('خلاصة المكتب');
    expect(markup).toContain('أولويات العمل الآن');
    expect(markup).toContain('صحة المحفظة');

    // Detail owned by another workspace is never repeated on the office surface.
    expect(markup).not.toContain('آخر التحصيلات');
    expect(markup).not.toContain('أعلى العقارات مصروفات');
    expect(overviewSource).not.toContain('createReceiptPrintHref');
    expect(overviewSource).not.toContain('receiptRows');
    expect(overviewSource).not.toContain('ReportListRow');
  });

  it('does not restate the workspace header the shell already renders', () => {
    const markup = render();

    expect(markup).not.toContain('القراءة التنفيذية لهذه الفترة');
    expect(overviewSource).not.toMatch(/<h1|<h2|<h3/);
  });

  it('routes export/share through the canonical report action group inside the panel header', () => {
    const markup = render();

    expect(markup).toContain('data-report-share-actions');
    expect(markup).toContain('data-print-actions');
    expect(overviewSource).toContain("import { ReportShareActions } from './ReportShareActions'");
    expect(overviewSource).not.toContain('csvRowsToXlsxBlob');
    expect(overviewSource).not.toContain('downloadBlob');
  });

  it('hides every export affordance when the permission is absent', () => {
    const markup = render({ canExportReports: false });

    expect(markup).not.toContain('data-report-share-actions');
  });
});

describe('Office Overview — financial authority is consumed, never recomputed', () => {
  it('renders the server-authoritative collection rate without deriving paid / invoiced', () => {
    const markup = render();

    expect(markup).toContain('كفاءة التحصيل 73%');
    expect(markup).not.toContain('كفاءة التحصيل 70%');
    expect(overviewSource).not.toMatch(/paid\s*\/\s*invoiced/);
    expect(overviewSource).toContain('collectionRate: number | undefined;');
  });

  it('reports the collection rate as unavailable instead of inventing 0%', () => {
    const markup = render({ collectionRate: undefined });

    expect(markup).toContain('كفاءة التحصيل غير متاحة');
    expect(markup).toContain('مؤشر كفاءة التحصيل المعتمد غير متاح');
    expect(markup).not.toContain('كفاءة التحصيل 0%');
    // The unmeasured ratio is dropped from the portfolio-health panel too.
    expect(markup).not.toContain('تحقق الالتزامات القابلة للتحصيل');
  });

  it('keeps outstanding and overdue as two different figures', () => {
    const markup = render();

    expect(markup).toContain('يشمل الجاري والمتأخر');
    expect(markup).toContain('تجاوز تاريخ استحقاقه حتى');
    expect(overviewSource).toContain('outstanding ≠ overdue');
    expect(overviewSource).not.toContain('overdueSummary?.totalOverdue ?? report.outstanding');
  });

  it('never substitutes the outstanding balance when arrears authority is missing', () => {
    const markup = render({ overdueSummary: undefined });

    expect(markup).toContain('مؤشر المتأخرات غير متاح');
    expect(overviewSource).toContain('const overdueTotal = overdueSummary?.totalOverdue ?? 0;');
    expect(overviewSource).toContain('hasOverdueAuthority');
  });

  it('keeps posted expenses separate from profit and from maintenance cost', () => {
    const markup = render();

    expect(markup).toContain('سندات مصروفات — ليست قائمة دخل');
    expect(overviewSource).not.toContain('صافي الربح');
    expect(overviewSource).not.toContain('صافي الدخل');
    expect(overviewSource).not.toContain('netCash +');
    expect(overviewSource).not.toContain('maintenanceRecordedCost');
    expect(overviewSource).not.toMatch(/paid\s*-\s*expensesTotal/);
  });

  it('consumes occupancy/vacancy exactly as the canonical rows provide them', () => {
    const markup = render();

    expect(markup).toContain('8 مشغولة من 10');
    expect(overviewSource).toContain('occupied: totals.occupied + row.occupied');
    expect(overviewSource).toContain('vacant: totals.vacant + row.vacant');
    expect(overviewSource).not.toContain('vacancyAnalytics');
    expect(overviewSource).not.toMatch(/daysVacant|vacancyRate/);
  });
});

describe('Office Overview — routing to the owning workspace', () => {
  it('sends every operational priority to the workspace that owns it', () => {
    expect(prioritiesSource).toContain("workspace: 'collections'");
    expect(prioritiesSource).toContain("view: 'follow_up'");
    expect(prioritiesSource).toContain("workspace: 'leasing'");
    expect(prioritiesSource).toContain("view: 'occupancy'");
    expect(prioritiesSource).toContain("view: 'expiring'");
    expect(prioritiesSource).toContain("workspace: 'operations'");
    expect(prioritiesSource).toContain("view: 'maintenance_analytics'");
    expect(overviewSource).toContain("onDrill('collections', 'collections')");
  });

  it('uses the shared drill primitive instead of a locally styled button', () => {
    expect(overviewSource).toContain('ReportDrillAction');
    expect(overviewSource).not.toContain('<button');
    expect(prioritiesSource).toContain('ReportDrillAction');
    expect(prioritiesSource).not.toContain('<button');
  });

  it('threads the active report scope from the analytics adapter', () => {
    expect(adapterSource).toContain('collectionRate={model.sections.collections.collectionRate}');
    expect(adapterSource).not.toContain('cashflowRows={model.sections.overview.cashflowRows}');
    expect(adapterSource).not.toContain('receiptRows={model.sections.collections.receiptRows}');
  });
});

describe('Reports shell — one header hierarchy, one authoritative headline read', () => {
  it('reads the headline rate from the hero model without fabricating a 0%', () => {
    expect(shellSource).toContain('const collectionRate = model.hero.collectionRate;');
    expect(shellSource).not.toMatch(/summary\?\.paid[\s\S]{0,120}summary\?\.invoiced/);
    expect(shellSource).toContain("model.sections.collections.collectionRate !== undefined");
    expect(shellSource).toContain("'المؤشر المعتمد غير متاح حاليًا'");
  });

  it('keeps the workspace title and description owned by the shell alone', () => {
    expect(shellSource).toContain('{meta.title}');
    expect(shellSource).toContain('{meta.description}');
    expect(overviewSource).not.toContain('meta.title');
  });
});
