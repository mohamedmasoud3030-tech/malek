import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { buildCsv, withUtf8Bom } from '@/lib/csvExport';
import { ReportsPage } from './reports-page';
import { ReportsRouteComponent } from '@/routes/_protected.reports';
import { ReportsWorkspace } from './components/ReportsWorkspace';
import { resolveReportLocation } from './reports-section-model';
import type { FilterState } from './reports-page.helpers';

vi.mock('@/features/settings/useCompanySettings', () => ({
  useCompanySettingsContract: () => ({ defaultCurrency: 'OMR' }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

const minimalModel: any = {
  hero: { summary: { paid: 100, invoiced: 100, outstanding: 0, netCash: 100 } },
  filters: { costCenterRows: [], ownerRows: [], contractRows: [] },
  firstError: null,
  sections: {
    overview: { summary: {}, collectionSummary: {}, cashflowRows: [], isLoading: false },
    collections: { summary: {}, rows: [], receiptRows: [], rentRollRows: [], isLoading: false },
    overdue: { rows: [], agedReport: undefined, summary: {}, isLoading: false },
    expenses: { report: undefined, isLoading: false },
    occupancy: { occupancyRows: [], expiringRows: [], isLoading: false },
    maintenance: { rows: [], summary: {}, isLoading: false },
    deferredRevenue: { audit: [], asOf: '2026-07-01', isLoading: false },
    accounting: {
      asOf: '2026-07-01',
      from: '2026-07-01',
      to: '2026-07-15',
      trialBalance: undefined,
      incomeStatement: undefined,
      balanceSheet: undefined,
      isTrialBalanceLoading: false,
      isIncomeStatementLoading: false,
      isBalanceSheetLoading: false,
      trialBalanceError: null,
      incomeStatementError: null,
      balanceSheetError: null,
      isLoading: false,
    },
    statements: {
      agedReport: undefined,
      receiptRows: [],
      financialSummary: {},
      expenseBreakdown: undefined,
      dailyRows: [],
      cashFlowStatement: undefined,
      vatReturn: undefined,
      tenantStatement: undefined,
      ownerStatement: undefined,
      selectedContractId: '',
      selectedOwnerId: '',
      tenantStatementError: null,
      ownerStatementError: null,
      isTenantStatementLoading: false,
      isOwnerStatementLoading: false,
      isLoading: false,
    },
  },
};

const reportFilters: FilterState = {
  from: '2026-07-01',
  to: '2026-07-15',
  asOf: '2026-07-15',
  costCenterId: '',
  ownerId: '',
  contractId: '',
};

describe('reports route wiring', () => {
  it('ReportsRouteComponent points to ReportsPage (Supabase-backed)', () => {
    expect(ReportsRouteComponent).toBe(ReportsPage);
  });
});

describe('CSV export utility', () => {
  it('builds CSV with correct headers and values', () => {
    const rows = [{ الاسم: 'أحمد', المبلغ: 1500, الدفع: true }];
    const csv = buildCsv(rows);
    expect(csv).toContain('الاسم');
    expect(csv).toContain('1500');
  });

  it('withUtf8Bom prepends BOM character for Excel compatibility', () => {
    const csv = buildCsv([{ a: 1 }]);
    expect(withUtf8Bom(csv).charCodeAt(0)).toBe(0xFEFF);
  });
});

describe('Reports Workspace Render Regression (Point 3)', () => {
  it('renders AccountingReportsSection for plain /reports (resolved as accounting / accounting_reports)', () => {
    const location = resolveReportLocation(undefined, undefined);
    expect(location).toEqual({ section: 'accounting', view: 'accounting_reports' });

    const html = renderToStaticMarkup(
      <ReportsWorkspace
        model={minimalModel}
        filters={reportFilters}
        canExportReports={false}
        activeSection={location.section}
        activeView={location.view}
        onSectionChange={vi.fn()}
        onSectionViewChange={vi.fn()}
        onFiltersChange={vi.fn()}
        onResetCurrentMonth={vi.fn()}
      />
    );
    expect(html).toContain('id="section-tab-accounting_reports"');
    expect(html).toContain('border-primary bg-primary');
  });

  it('renders AccountingReportsSection for unknown section fallback', () => {
    const location = resolveReportLocation('unknown_section', 'anything');
    expect(location).toEqual({ section: 'accounting', view: 'accounting_reports' });

    const html = renderToStaticMarkup(
      <ReportsWorkspace
        model={minimalModel}
        filters={reportFilters}
        canExportReports={false}
        activeSection={location.section}
        activeView={location.view}
        onSectionChange={vi.fn()}
        onSectionViewChange={vi.fn()}
        onFiltersChange={vi.fn()}
        onResetCurrentMonth={vi.fn()}
      />
    );
    expect(html).toContain('id="section-tab-accounting_reports"');
    expect(html).toContain('border-primary bg-primary');
  });

  it('renders OverviewSection for analytics + invalid view', () => {
    const location = resolveReportLocation('analytics', 'garbage_view');
    expect(location).toEqual({ section: 'analytics', view: 'overview' });

    const html = renderToStaticMarkup(
      <ReportsWorkspace
        model={minimalModel}
        filters={reportFilters}
        canExportReports={false}
        activeSection={location.section}
        activeView={location.view}
        onSectionChange={vi.fn()}
        onSectionViewChange={vi.fn()}
        onFiltersChange={vi.fn()}
        onResetCurrentMonth={vi.fn()}
      />
    );
    expect(html).toContain('id="section-tab-overview"');
    expect(html).toContain('border-primary bg-primary');
  });

  it('renders AccountingReportsSection for accounting + invalid view', () => {
    const location = resolveReportLocation('accounting', 'garbage_view');
    expect(location).toEqual({ section: 'accounting', view: 'accounting_reports' });

    const html = renderToStaticMarkup(
      <ReportsWorkspace
        model={minimalModel}
        filters={reportFilters}
        canExportReports={false}
        activeSection={location.section}
        activeView={location.view}
        onSectionChange={vi.fn()}
        onSectionViewChange={vi.fn()}
        onFiltersChange={vi.fn()}
        onResetCurrentMonth={vi.fn()}
      />
    );
    expect(html).toContain('id="section-tab-accounting_reports"');
    expect(html).toContain('border-primary bg-primary');
  });
});
