import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { companySettingsKeys } from '@/features/settings/useCompanySettings';
import { ReportsWorkspace } from './components/ReportsWorkspace';
import { getCurrentMonthFilters, type FilterState } from './reports-page.helpers';
import type { ReportSectionId } from './reports-page.sections';
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
    summary: {
      invoiced: 12800,
      paid: 10450,
      outstanding: 2350,
      expenses: 1875,
      netCash: 8575,
      invoicesCount: 18,
      paymentsCount: 22,
      expensesCount: 9,
    },
    isLoading: false,
  },
  sections: {
    overview: {
      summary: {
        invoiced: 12800,
        paid: 10450,
        outstanding: 2350,
        expenses: 1875,
        netCash: 8575,
        invoicesCount: 18,
        paymentsCount: 22,
        expensesCount: 9,
      },
      collectionSummary: {
        invoiced: 12800,
        paid: 10450,
        outstanding: 2350,
        receiptsCount: 22,
        invoicesCount: 18,
        expensesTotal: 1875,
      },
      cashflowRows: [
        { month: '2026-05', revenue: 8500, expenses: 1400 },
        { month: '2026-06', revenue: 9400, expenses: 1700 },
        { month: '2026-07', revenue: 10450, expenses: 1875 },
      ],
      isLoading: false,
    },
    collections: {
      summary: {
        invoiced: 12800,
        paid: 10450,
        outstanding: 2350,
        receiptsCount: 22,
        invoicesCount: 18,
        expensesTotal: 1875,
      },
      rows: [
        {
          paymentDate: '2026-07-15',
          totalPaid: 2400,
          paymentsCount: 4,
          methodTotals: { cash: 500, bank_transfer: 1400, card: 500, check: 0, other: 0 },
        },
        {
          paymentDate: '2026-07-14',
          totalPaid: 1750,
          paymentsCount: 3,
          methodTotals: { cash: 750, bank_transfer: 1000, card: 0, check: 0, other: 0 },
        },
      ],
      receiptRows: [
        {
          id: 'receipt-1',
          receipt_number: 'REC-0001',
          payment_date: '2026-07-15',
          amount: 1200,
          tenant_name: 'أحمد سالم',
          property_title: 'برج الخوير',
          unit_number: 'A-12',
          contract_id: 'contract-1',
          payment_method: 'bank_transfer',
          status: 'posted',
        },
        {
          id: 'receipt-2',
          receipt_number: 'REC-0002',
          payment_date: '2026-07-14',
          amount: 750,
          tenant_name: 'مريم علي',
          property_title: 'مجمع الموالح',
          unit_number: 'B-04',
          contract_id: 'contract-2',
          payment_method: 'cash',
          status: 'posted',
        },
      ],
      rentRollRows: [
        {
          contractId: 'contract-1',
          tenantName: 'أحمد سالم',
          propertyTitle: 'برج الخوير',
          unitNumber: 'A-12',
          rentAmount: 1200,
          paymentCycle: 'شهري',
          statusLabel: 'نشط',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
      ],
      isLoading: false,
    },
    overdue: {
      rows: [],
      agedReport: undefined,
      summary: {
        asOf: fixtureDate,
        totalOverdue: 2350,
        overdueInvoiceCount: 3,
        over90Amount: 600,
        over90InvoiceCount: 1,
        averageDaysOverdue: 42,
      },
      isLoading: false,
    },
    expenses: {
      report: {
        totalExpenses: 1875,
        expensesCount: 9,
        byCategory: [
          { category: 'صيانة', total: 900, count: 4 },
          { category: 'خدمات', total: 575, count: 3 },
          { category: 'تشغيل', total: 400, count: 2 },
        ],
        byProperty: [
          { propertyId: 'property-1', propertyTitle: 'برج الخوير', total: 1125, count: 5 },
          { propertyId: 'property-2', propertyTitle: 'مجمع الموالح', total: 750, count: 4 },
        ],
      },
      isLoading: false,
    },
    occupancy: {
      occupancyRows: [
        { property: 'برج الخوير', propertyId: 'property-1', shortPropertyId: 'property', hasTitle: true, occupied: 18, vacant: 2 },
        { property: 'مجمع الموالح', propertyId: 'property-2', shortPropertyId: 'property', hasTitle: true, occupied: 11, vacant: 1 },
      ],
      expiringRows: [],
      isLoading: false,
    },
    maintenance: {
      rows: [],
      summary: { total: 14, open: 3, inProgress: 4, urgent: 2 },
      isLoading: false,
    },
    deferredRevenue: {
      audit: {
        schedule: {
          totalUpfrontCollections: 12000,
          totalRecognizedRevenueCurrentMonth: 1000,
          totalRecognizedRevenueToDate: 7000,
          totalDeferredLiability: 5000,
          schedules: [
            {
              contractId: 'contract-1',
              tenantName: 'أحمد سالم',
              propertyTitle: 'برج الخوير',
              totalCollected: 12000,
              recognizedRevenueCurrentMonth: 1000,
              recognizedRevenueToDate: 7000,
              deferredRevenueRemaining: 5000,
              periodStart: '2026-01-01',
              periodEnd: '2026-12-31',
              monthlyAmortizationAmount: 1000,
              totalMonths: 12,
              elapsedMonths: 7,
            },
          ],
        },
        postedReceiptsCount: 22,
        postedReceiptsAmount: 10450,
        linkedReceiptsCount: 20,
        linkedReceiptsAmount: 9900,
        unlinkedReceiptsCount: 2,
        unlinkedReceiptsAmount: 550,
        candidateReceiptsCount: 1,
        candidateContractsCount: 1,
        invalidContractLinksCount: 0,
        methodology: 'Fixture لاختبار عرض منهجية الاستحقاق وربط الإيصالات بالعقود.',
      },
      asOf: fixtureDate,
      isLoading: false,
    },
    accounting: {
      asOf: fixtureDate,
      from: '2026-07-01',
      to: fixtureDate,
      trialBalance: {
        asOf: fixtureDate,
        accounts: [
          { code: '1111', name: 'الصندوق', type: 'asset', balanceType: 'debit', balance: 10450 },
          { code: '4000', name: 'إيرادات الإيجار', type: 'revenue', balanceType: 'credit', balance: 10450 },
        ],
        totalDebits: 10450,
        totalCredits: 10450,
        isBalanced: true,
      },
      incomeStatement: {
        period: { from: '2026-07-01', to: fixtureDate },
        revenue: [{ label: 'إيرادات الإيجار', amount: 12800 }],
        totalRevenue: 12800,
        expenses: [{ label: 'مصروفات تشغيلية', amount: 1875 }],
        totalExpenses: 1875,
        netIncome: 10925,
      },
      balanceSheet: {
        asOf: fixtureDate,
        assets: [{ code: '1111', name: 'النقدية', amount: 10450 }],
        totalAssets: 10450,
        liabilities: [{ code: '2100', name: 'ذمم دائنة', amount: 2350 }],
        totalLiabilities: 2350,
        equity: [{ code: '3000', name: 'حقوق الملكية', amount: 8100 }],
        totalEquity: 8100,
        isBalanced: true,
      },
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
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...getCurrentMonthFilters(),
    from: '2026-07-01',
    to: fixtureDate,
    asOf: fixtureDate,
  }));
  // The fixture renders ReportsWorkspace without the /reports route, so the
  // section selection is local state here (the real route is URL-backed).
  const [activeSection, setActiveSection] = useState<ReportSectionId>('overview');

  useEffect(() => {
    queryClient.setQueryData(companySettingsKeys.detail(), {
      company_name: 'رينتريكس لإدارة العقارات',
      currency: 'OMR',
      address: 'صحار، سلطنة عمان',
      phone: '+968 24000000',
      email: 'ops@rentrix.test',
      tax_number: 'VAT-100',
      registration_number: 'CR-200',
      invoice_prefix: 'INV',
      contract_prefix: 'CON',
      receipt_prefix: 'REC',
    });
  }, [queryClient]);

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
          activeSection={activeSection}
          onSectionChange={setActiveSection}
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
