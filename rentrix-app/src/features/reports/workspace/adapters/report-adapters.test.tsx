// @vitest-environment happy-dom
import React, { Suspense } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountingReportsAdapter } from './AccountingReportsAdapter';
import { AnalyticsReportsAdapter, resolveAnalyticsReportView } from './AnalyticsReportsAdapter';
import { StatementsReportsAdapter } from './StatementsReportsAdapter';
import type { ReportAdapterProps } from './report-adapter-contract';
import type { ReportsWorkspaceModel } from '../../use-reports-workspace';
import type { ReportsFilterState } from '../../reports-workspace-filters';
import {
  ACCOUNTING_REPORT_VIEWS,
  ANALYTICS_REPORT_VIEWS,
} from '../../report-view-registry';

// The report bodies own their own Supabase-backed hooks. The adapters are pure
// routing, so each body is stubbed with a marker and the routing itself is what
// is under test: every registered view must reach exactly one body, and each
// body must stay a separately lazy-loaded chunk.
vi.mock('../../components/AccountingReportsSection', () => ({
  AccountingReportsSection: () => <div data-testid="report-body-accounting_reports" />,
}));
vi.mock('../../components/GeneralLedgerCoreSection', () => ({
  GeneralLedgerCoreSection: () => <div data-testid="report-body-general_ledger" />,
}));
vi.mock('../../components/DeferredRevenueReportSection', () => ({
  DeferredRevenueReportSection: () => <div data-testid="report-body-deferred_revenue" />,
}));
vi.mock('../../components/StatementsSection', () => ({
  StatementsSection: () => <div data-testid="report-body-statements" />,
}));
vi.mock('../../components/OverviewSection', () => ({
  OverviewSection: () => <div data-testid="report-body-overview" />,
}));
vi.mock('../../components/CollectionsSection', () => ({
  CollectionsSection: () => <div data-testid="report-body-collections" />,
}));
vi.mock('../../components/OverdueSection', () => ({
  OverdueSection: () => <div data-testid="report-body-overdue" />,
}));
vi.mock('../../components/ExpensesSection', () => ({
  ExpensesSection: () => <div data-testid="report-body-expenses" />,
}));
vi.mock('../../components/PropertyAnalyticsSection', () => ({
  PropertyAnalyticsSection: () => <div data-testid="report-body-property_analytics" />,
}));
vi.mock('../../components/OccupancySection', () => ({
  OccupancySection: () => <div data-testid="report-body-occupancy" />,
}));
vi.mock('../../components/MaintenanceReportSection', () => ({
  MaintenanceReportSection: () => <div data-testid="report-body-maintenance_analytics" />,
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

const filters = { from: '2026-07-01', to: '2026-07-15', asOf: '2026-07-15' } as ReportsFilterState;

const adapterProps = (view: string): ReportAdapterProps => ({
  view: view as ReportAdapterProps['view'],
  model,
  filters,
  canExportReports: true,
});

/** Renders an adapter behind the same Suspense boundary the view panel provides. */
async function renderedBodyId(element: React.ReactElement): Promise<string> {
  render(<Suspense fallback={<div data-testid="adapter-fallback" />}>{element}</Suspense>);
  const body = await screen.findByTestId(/^report-body-/);
  return (body.dataset.testid ?? '').replace('report-body-', '');
}

afterEach(cleanup);

describe('WP-C accounting adapter routing', () => {
  it.each(ACCOUNTING_REPORT_VIEWS.map((view) => [view.id] as const))(
    'routes accounting view %s to its own report body',
    async (view) => {
      expect(await renderedBodyId(<AccountingReportsAdapter {...adapterProps(view)} />)).toBe(view);
    },
  );
});

describe('WP-C analytics adapter routing', () => {
  it.each(ANALYTICS_REPORT_VIEWS.map((view) => [view.id] as const))(
    'routes analytics view %s to its own report body',
    async (view) => {
      expect(await renderedBodyId(<AnalyticsReportsAdapter {...adapterProps(view)} />)).toBe(view);
    },
  );

  it('falls back to the overview body for an unknown analytics view', async () => {
    expect(resolveAnalyticsReportView('not-a-view')).toBe('overview');
    expect(await renderedBodyId(<AnalyticsReportsAdapter {...adapterProps('not-a-view')} />)).toBe('overview');
  });
});

describe('WP-C statements adapter routing', () => {
  it('routes the statements section to the statements body', async () => {
    expect(await renderedBodyId(<StatementsReportsAdapter {...adapterProps('')} />)).toBe('statements');
  });

  it('ignores the view id, because statements has no sub-views', async () => {
    expect(await renderedBodyId(<StatementsReportsAdapter {...adapterProps('overview')} />)).toBe('statements');
  });
});

describe('WP-C adapter contract', () => {
  it('implements one identical props interface across all three adapters', () => {
    // Compile-time enforced: if any adapter drifts from ReportAdapterProps the
    // typecheck of this file fails, not just the test.
    const adapters: ReadonlyArray<React.ComponentType<ReportAdapterProps>> = [
      AccountingReportsAdapter,
      StatementsReportsAdapter,
      AnalyticsReportsAdapter,
    ];
    expect(adapters).toHaveLength(3);
  });
});
