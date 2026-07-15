import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { ReportsWorkspace } from './components/ReportsWorkspace';
import { getCurrentMonthFilters, type FilterState } from './reports-page.helpers';
import type { ReportsWorkspaceModel } from './use-reports-workspace';

const fixtureDate = '2026-07-15';

const fixtureModel: ReportsWorkspaceModel = {
  today: fixtureDate,
  firstError: null,
  filters: {
    costCenterRows: [],
    ownerRows: [],
    contractRows: [],
  },
  hero: {
    summary: undefined,
    isLoading: false,
  },
  sections: {
    overview: {
      summary: undefined,
      cashflowRows: [],
      isLoading: false,
    },
    collections: {
      rows: [],
      receiptRows: [],
      rentRollRows: [],
      isLoading: false,
    },
    overdue: {
      rows: [],
      agedReport: undefined,
      isLoading: false,
    },
    expenses: {
      report: undefined,
      isLoading: false,
    },
    occupancy: {
      occupancyRows: [],
      expiringRows: [],
      isLoading: false,
    },
    accounting: {
      asOf: fixtureDate,
      from: '2026-07-01',
      to: fixtureDate,
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
      financialSummary: undefined,
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

export function ReportsWorkspaceE2EFixture() {
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...getCurrentMonthFilters(),
    from: '2026-07-01',
    to: fixtureDate,
    asOf: fixtureDate,
  }));

  return (
    <main
      className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground"
      dir="rtl"
      data-e2e-reports-workspace
    >
      <div className="mx-auto min-w-0 max-w-[1600px] space-y-6 px-3 py-4 sm:px-6 lg:px-8">
        <PageHeader
          title="مركز التقارير والكشوف"
          description="Fixture متصفح لقياس workspace التقارير دون اتصال ببيانات أو عمليات مالية."
        />
        <ReportsWorkspace
          model={fixtureModel}
          filters={filters}
          canExportReports={false}
          onFiltersChange={setFilters}
          onResetCurrentMonth={() => setFilters({
            ...getCurrentMonthFilters(),
            from: '2026-07-01',
            to: fixtureDate,
            asOf: fixtureDate,
          })}
        />
      </div>
    </main>
  );
}
