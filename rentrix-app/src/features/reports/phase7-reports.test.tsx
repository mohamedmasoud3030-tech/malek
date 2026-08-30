import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { buildCsv, withUtf8Bom } from '@/lib/csvExport';
import { ReportsPage } from './reports-page';
import { ReportsRouteComponent } from '@/routes/_protected.reports';
import { ReportsWorkspace } from './components/ReportsWorkspace';
import { resolveWorkspaceLocation } from './reports-section-model';
import { getReportWorkspace, type ReportWorkspaceId } from './report-workspaces';
import type { ReportViewId } from './report-view-registry';
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
  const renderWorkspace = (workspace: ReportWorkspaceId, view: ReportViewId) => {
    const section = getReportWorkspace(workspace)?.defaultSection ?? 'analytics';
    return renderToStaticMarkup(
      <ReportsWorkspace
        model={minimalModel}
        filters={reportFilters}
        canExportReports={false}
        activeWorkspace={workspace}
        activeSection={section}
        activeView={view}
        onOpenView={vi.fn()}
        onOpenReport={vi.fn()}
        onDrill={vi.fn()}
        onFiltersChange={vi.fn()}
        onResetCurrentMonth={vi.fn()}
      />
    );
  };

  it('lands on the office launchpad for plain /reports, keeping accounting specialist-only', () => {
    const location = resolveWorkspaceLocation(undefined, undefined, undefined);
    expect(location).toEqual({ workspace: 'office', section: 'analytics', view: 'overview' });

    const html = renderWorkspace(location.workspace, location.view);
    expect(html).toContain('data-report-summary-layer');
    expect(html).toContain('أداء المكتب');
    expect(html).toContain('data-report-filter-surface');
  });

  it('falls back to the office launchpad for an unknown section', () => {
    const location = resolveWorkspaceLocation(undefined, undefined, 'unknown_section');
    expect(location).toEqual({ workspace: 'office', section: 'analytics', view: 'overview' });

    const html = renderWorkspace(location.workspace, location.view);
    expect(html).toContain('data-report-summary-layer');
    expect(html).toContain('أداء المكتب');
    expect(html).toContain('data-report-filter-surface');
  });

  it('renders the office launchpad for analytics with an invalid view', () => {
    const location = resolveWorkspaceLocation(undefined, 'garbage_view', 'analytics');
    expect(location).toEqual({ workspace: 'office', section: 'analytics', view: 'overview' });

    const html = renderWorkspace(location.workspace, location.view);
    expect(html).toContain('data-report-summary-layer');
    expect(html).toContain('أداء المكتب');
    expect(html).toContain('data-report-filter-surface');
  });

  it('keeps the accounting report header available through the specialist deep link', () => {
    const location = resolveWorkspaceLocation(undefined, 'garbage_view', 'accounting');
    expect(location).toEqual({ workspace: 'financial_review', section: 'accounting', view: 'accounting_reports' });

    const html = renderWorkspace(location.workspace, location.view);
    expect(html).toContain('data-report-summary-layer');
    expect(html).toContain('ميزان المراجعة والقوائم');
  });

  it('resolves a workspace sub-view deep link', () => {
    const location = resolveWorkspaceLocation('collections', 'overdue', undefined);
    expect(location).toEqual({ workspace: 'collections', section: 'analytics', view: 'overdue' });

    const html = renderWorkspace(location.workspace, location.view);
    expect(html).toContain('data-workspace-subview-tabs');
    expect(html).toContain('المتأخرات والأعمار');
  });
});
