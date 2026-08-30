// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PropertyAnalyticsSection } from './PropertyAnalyticsSection';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
import { documentService } from '@/services/documents/DocumentService';
import type { DocumentCompanySettings } from '@/services/documents/companyIdentity';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { ReportsFilterState } from '../reports-workspace-filters';

const docSettingsState: { companySettings: DocumentCompanySettings; isReady: boolean } = {
  companySettings: {
    companyName: 'شركة مسار العقارية',
    crNumber: '12345678',
    taxNumber: 'OM12345678',
    currency: 'OMR',
    city: 'مسقط',
    documentPrefixes: {},
  },
  isReady: true,
};

vi.mock('@/features/settings/useDocumentSettings', () => ({
  useDocumentSettings: () => docSettingsState,
}));

vi.mock('@/services/documents/DocumentService', () => ({
  documentService: {
    printDocument: vi.fn().mockResolvedValue(undefined),
    downloadDocumentPdf: vi.fn().mockResolvedValue(undefined),
  },
}));

// The professional property report loads period-scoped invoice/payment detail
// and units on demand (read-only). Resolve them to empty deterministic sets so
// clicking the action exercises the full print path.
vi.mock('@/features/financials/reports/financial-reporting/report-loaders', () => ({
  loadInvoices: vi.fn().mockResolvedValue([]),
  loadPayments: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/features/units/unit-service', () => ({
  listUnits: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/features/financials/reports/financialReportsService', () => ({
  getExpenseBreakdownReport: vi.fn().mockResolvedValue(null),
  getFinancialPeriodSummaryReport: vi.fn().mockResolvedValue(null),
  getOverdueInvoicesReport: vi.fn().mockResolvedValue({ asOf: '2026-01-31', totalOverdue: 0, invoiceCount: 0, rows: [] }),
}));
vi.mock('../reports-collection-efficiency', () => ({
  getAuthoritativeReportsCollectionRate: vi.fn().mockResolvedValue(null),
}));

const emptyModel = {
  isIncomplete: false,
  hero: { collectionRate: 92 },
  filters: { contractRows: [] },
  sections: {
    overview: { summary: null },
    collections: { rows: [] },
    overdue: { rows: [], agedReport: null },
    expenses: { report: null },
    occupancy: { occupancyRows: [], expiringRows: [], vacancyAnalytics: null },
    maintenance: { rows: [] },
  },
} as unknown as ReportsWorkspaceModel;

const filters = {
  from: '2026-02-01',
  to: '2026-02-28',
  asOf: '2026-02-28',
} as unknown as ReportsFilterState;

function renderSection(model?: ReportsWorkspaceModel | null, scope?: ReportsFilterState | null) {
  return render(
    <PropertyAnalyticsSection
      occupancyRows={[]}
      expenseRows={[]}
      performanceRows={[]}
      isLoading={false}
      onDrill={() => undefined}
      model={model !== undefined ? model : emptyModel}
      filters={scope !== undefined ? scope : filters}
    />,
  );
}

describe('PropertyAnalyticsSection professional property report wiring', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('renders the professional property report actions when the workspace model is available', () => {
    renderSection();
    expect(screen.getByRole('button', { name: 'تنزيل تقرير العقار PDF' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'طباعة' })).toBeDefined();
  });

  it('hides the professional actions when the workspace model/scope is absent', () => {
    renderSection(null, null);
    expect(screen.queryByRole('button', { name: 'تنزيل تقرير العقار PDF' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'طباعة' })).toBeNull();
  });

  it('prints the property performance report with the active workspace scope', async () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'طباعة' }));

    await vi.waitFor(() => {
      expect(documentService.printDocument).toHaveBeenCalledWith('property_report', expect.objectContaining({
        settings: docSettingsState.companySettings,
        payload: expect.objectContaining({ reportType: 'Property_Performance_Report', periodFrom: '2026-02-01', periodTo: '2026-02-28' }),
      }));
    });
  });

  it('downloads the property performance report as PDF', async () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'تنزيل تقرير العقار PDF' }));

    await vi.waitFor(() => {
      expect(documentService.downloadDocumentPdf).toHaveBeenCalledWith('property_report', expect.objectContaining({
        payload: expect.objectContaining({ reportType: 'Property_Performance_Report' }),
      }));
    });
  });

  it('refuses generation truthfully when the workspace sources are incomplete', async () => {
    renderSection({ ...emptyModel, isIncomplete: true } as unknown as ReportsWorkspaceModel, filters);
    fireEvent.click(screen.getByRole('button', { name: 'طباعة' }));

    // The guarded action never reaches documentService on incomplete data.
    await vi.waitFor(() => {
      expect(documentService.printDocument).not.toHaveBeenCalled();
      expect(documentService.downloadDocumentPdf).not.toHaveBeenCalled();
    });
  });
});
