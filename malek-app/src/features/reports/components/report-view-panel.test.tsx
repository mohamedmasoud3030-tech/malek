// @vitest-environment happy-dom
import React, { Suspense } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportViewPanel } from './report-view-panel';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { ReportsFilterState } from '../reports-workspace-filters';
import type { ReportSectionId, ReportViewId } from '../report-products';
import { REPORT_PRODUCTS } from '../report-products';

const accountingViewIds = REPORT_PRODUCTS.flatMap((product) =>
  product.targets
    .filter((target) => target.section === 'accounting')
    .map((target) => target.view),
);
const analyticsViewIds = REPORT_PRODUCTS.flatMap((product) =>
  product.targets
    .filter((target) => target.section === 'analytics')
    .map((target) => target.view),
);

// The bodies own their own Supabase-backed hooks. The canonical product
// dispatcher is pure routing, so each body is stubbed with a marker and every
// product target is proved to reach exactly one lazily-loaded body.
vi.mock('./AccountingReportsSection', () => ({
  AccountingReportsSection: () => (
    <div data-testid="report-body-accounting_reports" />
  ),
}));
vi.mock('./GeneralLedgerCoreSection', () => ({
  GeneralLedgerCoreSection: () => (
    <div data-testid="report-body-general_ledger" />
  ),
}));
vi.mock('./DeferredRevenueReportSection', () => ({
  DeferredRevenueReportSection: () => (
    <div data-testid="report-body-deferred_revenue" />
  ),
}));
vi.mock('./StatementsSection', () => ({
  StatementsSection: () => <div data-testid="report-body-statements" />,
}));
vi.mock('./OverviewSection', () => ({
  OverviewSection: () => <div data-testid="report-body-overview" />,
}));
vi.mock('./CollectionsSection', () => ({
  CollectionsSection: () => <div data-testid="report-body-collections" />,
}));
vi.mock('./OverdueSection', () => ({
  OverdueSection: () => <div data-testid="report-body-overdue" />,
}));
vi.mock('./ExpensesSection', () => ({
  ExpensesSection: () => <div data-testid="report-body-expenses" />,
}));
vi.mock('./PropertyAnalyticsSection', () => ({
  PropertyAnalyticsSection: () => (
    <div data-testid="report-body-property_analytics" />
  ),
}));
vi.mock('./OccupancySection', () => ({
  OccupancySection: () => <div data-testid="report-body-occupancy" />,
}));
vi.mock('./MaintenanceReportSection', () => ({
  MaintenanceReportSection: () => (
    <div data-testid="report-body-maintenance_analytics" />
  ),
}));
vi.mock('./ServicesReportSection', () => ({
  ServicesReportSection: () => <div data-testid="report-body-services" />,
}));
vi.mock('./FollowUpSection', () => ({
  FollowUpSection: () => <div data-testid="report-body-follow_up" />,
}));
vi.mock('./CollectionMovementSection', () => ({
  CollectionMovementSection: () => (
    <div data-testid="report-body-collection_movement" />
  ),
}));
vi.mock('./ExpiringContractsSection', () => ({
  ExpiringContractsSection: () => <div data-testid="report-body-expiring" />,
}));
vi.mock('./OperationsOverviewSection', () => ({
  OperationsOverviewSection: () => (
    <div data-testid="report-body-operations_overview" />
  ),
}));

const model = {
  sections: {
    accounting: { asOf: '2026-07-15', from: '2026-07-01', to: '2026-07-15' },
    deferredRevenue: { audit: [], asOf: '2026-07-15' },
    statements: { selectedContractId: '', selectedOwnerId: '' },
    overview: { isLoading: false },
    collections: { receiptRows: [], isLoading: false },
    occupancy: { occupancyRows: [], isLoading: false },
    expenses: { report: undefined, isLoading: false },
    overdue: { rows: [] },
    maintenance: { rows: [], summary: {} },
  },
} as unknown as ReportsWorkspaceModel;

const filters = {
  from: '2026-07-01',
  to: '2026-07-15',
  asOf: '2026-07-15',
} as ReportsFilterState;

const panelProps = (activeSection: ReportSectionId, activeView: string) => ({
  activeSection,
  activeView: activeView as ReportViewId,
  model,
  filters,
  canExportReports: true,
  onDrill: vi.fn(),
});

/** Renders the canonical dispatcher behind its product Suspense boundary. */
async function renderedBodyId(element: React.ReactElement): Promise<string> {
  render(
    <Suspense fallback={<div data-testid="adapter-fallback" />}>
      {element}
    </Suspense>,
  );
  const body = await screen.findByTestId(/^report-body-/);
  return (body.dataset.testid ?? '').replace('report-body-', '');
}

afterEach(cleanup);

describe('canonical accounting body routing', () => {
  it.each(accountingViewIds.map((view) => [view] as const))(
    'routes accounting view %s to its own report body',
    async (view) => {
      expect(
        await renderedBodyId(
          <ReportViewPanel {...panelProps('accounting', view)} />,
        ),
      ).toBe(view);
    },
  );
});

describe('canonical analytics body routing', () => {
  it.each(analyticsViewIds.map((view) => [view] as const))(
    'routes analytics view %s to its own report body',
    async (view) => {
      expect(
        await renderedBodyId(
          <ReportViewPanel {...panelProps('analytics', view)} />,
        ),
      ).toBe(view);
    },
  );

  it('falls back to the overview body for an unknown analytics view', async () => {
    expect(
      await renderedBodyId(
        <ReportViewPanel {...panelProps('analytics', 'not-a-view')} />,
      ),
    ).toBe('overview');
  });
});

describe('canonical statements body routing', () => {
  it('routes the statements section to the statements body', async () => {
    expect(
      await renderedBodyId(
        <ReportViewPanel {...panelProps('statements', '')} />,
      ),
    ).toBe('statements');
  });

  it('ignores the view id, because statements has no sub-views', async () => {
    expect(
      await renderedBodyId(
        <ReportViewPanel {...panelProps('statements', 'overview')} />,
      ),
    ).toBe('statements');
  });
});
