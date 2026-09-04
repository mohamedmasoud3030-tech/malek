import './dashboard-v2.css';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionHeader } from '@/components/ui/section-header';
import { formatCompanyDate, formatCompanyMoney, formatCompanyNumber } from '@/lib/companyFormatters';
import { defaultCompanySettingsContract } from '@/lib/companySettings';
import { CollectionsSection } from './components/collections-section';
import { FinancialPerformanceSection } from './components/financial-performance-section';
import { NeedsAttentionSection } from './components/needs-attention-section';
import { OccupancySection } from './components/occupancy-section';
import { OfficePulse } from './components/office-pulse';
import type { DashboardSnapshot } from './dashboard-snapshot';
import type { UtilityObligationsSignal } from './utility-obligations-signal';
import type { VacancyAnalytics } from '@/features/units/vacancy-analytics';
import type { MaintenanceFollowUpSignal } from './maintenance-follow-up-signal';
import { buildNeedsAttentionSignal } from './needs-attention-signal';
import type { MonthlyCashflowChartRow } from './financial-performance';

const fixtureSettings = {
  ...defaultCompanySettingsContract,
  money: (value: number | null | undefined) => formatCompanyMoney(defaultCompanySettingsContract, value),
  date: (value: string) => formatCompanyDate(defaultCompanySettingsContract, `${value}T00:00:00`),
  number: (value: number | null | undefined) => formatCompanyNumber(defaultCompanySettingsContract, value),
};

const fixtureSnapshot: DashboardSnapshot = {
  period: { dateFrom: '2026-07-01', dateTo: '2026-07-15', asOf: '2026-07-15', month: 7, year: 2026 },
  portfolio: { properties: 2, units: 15 },
  occupancy: { occupiedUnits: 12, vacantUnits: 3, occupancyRate: 80 },
  contracts: { active: 8, expiring30: 2, expiring60: 3, expiring90: 4 },
  billing: { invoicedAmount: 15_000, invoicesCount: 10, invoicesTotalCount: 60 },
  collections: { collectedAmount: 12_000, paymentsCount: 8, outstandingAmount: 3_000, collectionRate: 80 },
  expenses: { totalAmount: 1_500, count: 3 },
  netCash: 10_500,
  arrears: {
    totalOverdue: 3_000,
    overdueCount: 2,
    averageDaysOverdue: 28,
    over90Amount: 0,
    over90Count: 0,
    totalOutstanding: 3_000,
    buckets: {
      current: { total: 0, count: 0 },
      days_1_30: { total: 1_500, count: 1 },
      days_31_60: { total: 1_500, count: 1 },
      days_61_90: { total: 0, count: 0 },
      days_90_plus: { total: 0, count: 0 },
    },
  },
  ownerFunds: { netPayable: 50.75, settlementsDraft: 1, settlementsApproved: 1 },
  maintenance: { open: 2, inProgress: 1, urgentOpen: 1 },
  exceptions: { unmatchedBankLines: 2, pendingSettlements: 1 },
  queues: {
    expiringContracts: [
      { id: 'contract-1', reference: 'CON-1001', endDate: '2026-07-24', daysRemaining: 9, tenantName: 'أحمد الفارسي', propertyTitle: 'برج الخليج', unitNumber: '5' },
    ],
    overdueInvoices: [
      { invoiceId: 'invoice-1', reference: 'INV-2001', dueDate: '2026-06-10', daysOverdue: 35, remainingAmount: 1_500, tenantName: 'أحمد الفارسي', propertyTitle: 'برج الخليج', unitNumber: '5' },
    ],
    urgentMaintenance: [
      { id: 'maintenance-1', title: 'تسرب مياه', priority: 'urgent', propertyTitle: 'برج الخليج', unitNumber: '5' },
    ],
  },
};

const fixtureUtilityObligations: UtilityObligationsSignal = {
  summary: {
    overdueCount: 1,
    overdueAmount: 42.5,
    dueSoonCount: 1,
    dueSoonAmount: 18,
    outstandingCount: 2,
    outstandingAmount: 60.5,
    remainingByResponsibleParty: { tenant: 42.5, landlord: 18, company: 0 },
  },
  rows: [
    { billId: 'utility-1', title: 'فاتورة UB-1001', meta: 'متأخرة 12 يوم · المستأجر', remainingAmount: 42.5, urgency: 'overdue', daysOverdue: 12, daysUntilDue: -12 },
  ],
  actionableCount: 1,
};

const fixtureVacancyAnalytics: VacancyAnalytics = {
  totalUnits: 15,
  occupiedUnits: 12,
  availableUnits: 3,
  nonRentableUnits: 0,
  occupancyRate: 80,
  vacancyRate: 20,
  averageVacancyDays: 42,
  referenceVacantRent: 480,
  previousMonthOccupancyRate: 86.7,
  occupancyChangePoints: -6.7,
  previousMonthEnd: '2026-06-30',
  vacantRows: [
    {
      unitId: 'unit-7', propertyId: 'property-2', unitNumber: '7', propertyTitle: 'واحة مسقط',
      referenceRent: 280, lastContractEndDate: '2026-05-20', vacancySince: '2026-05-20', vacancySinceSource: 'contract_end', daysVacant: 70,
    },
  ],
  vacancyRiskRows: [],
};

const fixtureMaintenanceFollowUp: MaintenanceFollowUpSignal = {
  stalledCount: 1,
  awaitingClosureCount: 0,
  scheduleMissedCount: 0,
  actionableCount: 1,
  oldestOpenAgeDays: 34,
  rows: [
    { requestId: 'mnt-1', title: 'تسرب في مواسير الحمام', location: 'برج الخليج · الوحدة 3', flag: 'stalled', flagLabel: 'متوقفة عن التقدم', ageDays: 34 },
  ],
};

const fixtureChartRows: readonly MonthlyCashflowChartRow[] = [
  { month: '2026-02', label: 'فبراير', collected: 9_800, expenses: 1_200 },
  { month: '2026-03', label: 'مارس', collected: 11_400, expenses: 1_650 },
  { month: '2026-04', label: 'أبريل', collected: 10_950, expenses: 1_100 },
  { month: '2026-05', label: 'مايو', collected: 12_300, expenses: 1_900 },
  { month: '2026-06', label: 'يونيو', collected: 11_750, expenses: 1_350 },
  { month: '2026-07', label: 'يوليو', collected: 12_000, expenses: 1_500 },
];

const fixtureNeedsAttention = buildNeedsAttentionSignal({
  snapshot: fixtureSnapshot,
  vacancyAnalytics: fixtureVacancyAnalytics,
  utilityObligations: fixtureUtilityObligations,
  maintenanceFollowUp: fixtureMaintenanceFollowUp,
});

export function DashboardWorkspaceE2EFixture() {
  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground outline-none" dir="rtl" tabIndex={-1} data-e2e-dashboard-workspace>
      <div className="px-3 py-4 sm:px-6 lg:px-8">
        <PageLayout>
          <PageHeader title="اليوم" />
          <div className="grid min-w-0 gap-5">
            <section aria-label="الحالات التي تحتاج انتباهاً" data-dashboard-section="needs-attention">
              <SectionHeader eyebrow="1 · أولويات" title="يحتاج انتباهك" />
              <NeedsAttentionSection signal={fixtureNeedsAttention} isLoading={false} />
            </section>
            <section aria-label="نبض المكتب" data-dashboard-section="office-pulse">
              <SectionHeader eyebrow="2 · الآن" title="نبض المكتب" />
              <OfficePulse snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>
            <section aria-label="التحصيل والمتأخرات" data-dashboard-section="collections">
              <SectionHeader eyebrow="3 · تحصيل" title="التحصيل والمتأخرات" />
              <CollectionsSection snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>
            <section aria-label="الإشغال والشغور" data-dashboard-section="occupancy">
              <SectionHeader eyebrow="4 · المحفظة" title="الإشغال والشغور" />
              <OccupancySection snapshot={fixtureSnapshot} analytics={fixtureVacancyAnalytics} isLoading={false} settings={fixtureSettings} />
            </section>
            <section aria-label="الأداء المالي" data-dashboard-section="financial-performance">
              <SectionHeader eyebrow="5 · الأداء المالي" title="أداء المكتب" />
              <FinancialPerformanceSection
                settings={fixtureSettings}
                window="six_months"
                onWindowChange={() => undefined}
                chartRows={fixtureChartRows}
                chartIsLoading={false}
                chartIsError={false}
                onChartRetry={() => undefined}
              />
            </section>
          </div>
        </PageLayout>
      </div>
    </main>
  );
}
