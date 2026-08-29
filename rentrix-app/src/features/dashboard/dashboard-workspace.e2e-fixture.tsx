import './dashboard-v2.css';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { SectionHeader } from '@/components/ui/section-header';
import { formatCompanyDate, formatCompanyMoney, formatCompanyNumber } from '@/lib/companyFormatters';
import { defaultCompanySettingsContract } from '@/lib/companySettings';
import { CollectionsSection } from './components/collections-section';
import { FinanceExceptionsSection } from './components/finance-exceptions-section';
import { FinancialPerformanceSection } from './components/financial-performance-section';
import { MaintenanceSection } from './components/maintenance-section';
import { NeedsAttentionSection } from './components/needs-attention-section';
import { OccupancySection } from './components/occupancy-section';
import { OfficePulse } from './components/office-pulse';
import { OwnerObligationsSection } from './components/owner-obligations-section';
import { PropertyHealthSection } from './components/property-health-section';
import { UpcomingContractsSection } from './components/upcoming-contracts-section';
import { UtilityObligationsSection } from './components/utility-obligations-section';
import type { DashboardSnapshot } from './dashboard-snapshot';
import { buildExpiringContracts, toDateInputValue } from './dashboard-utils';
import type { UtilityObligationsSignal } from './utility-obligations-signal';
import type { VacancyAnalytics } from '@/features/units/vacancy-analytics';
import type { MaintenanceFollowUpSignal } from './maintenance-follow-up-signal';
import { buildNeedsAttentionSignal } from './needs-attention-signal';
import type { MaintenanceDashboardSummary } from './maintenance-dashboard-summary';
import type { MonthlyCashflowChartRow } from './financial-performance';
import {
  buildPropertyHealthRows,
  type PropertyHealthRow,
} from './property-health-signal';

const soonDate = toDateInputValue(new Date(Date.now() + 9 * 24 * 60 * 60 * 1000));
const laterDate = toDateInputValue(new Date(Date.now() + 18 * 24 * 60 * 60 * 1000));
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
      { id: 'contract-1', reference: 'CON-1001', endDate: soonDate, daysRemaining: 9, tenantName: 'أحمد الفارسي', propertyTitle: 'برج الخليج', unitNumber: '5' },
      { id: 'contract-2', reference: 'CON-1002', endDate: laterDate, daysRemaining: 18, tenantName: 'سالم الكعبي', propertyTitle: 'واحة مسقط', unitNumber: '12' },
    ],
    overdueInvoices: [
      { invoiceId: 'invoice-1', reference: 'INV-2001', dueDate: '2026-06-10', daysOverdue: 35, remainingAmount: 1_500, tenantName: 'أحمد الفارسي', propertyTitle: 'برج الخليج', unitNumber: '5' },
      { invoiceId: 'invoice-2', reference: 'INV-2002', dueDate: '2026-06-12', daysOverdue: 33, remainingAmount: 1_500, tenantName: 'سالم الكعبي', propertyTitle: 'واحة مسقط', unitNumber: '12' },
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
    { billId: 'utility-2', title: 'فاتورة UB-1002', meta: 'تستحق خلال 4 يوم · المالك', remainingAmount: 18, urgency: 'due_soon', daysOverdue: 0, daysUntilDue: 4 },
  ],
  actionableCount: 2,
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
    {
      unitId: 'unit-9', propertyId: 'property-2', unitNumber: '9', propertyTitle: 'واحة مسقط',
      referenceRent: 200, lastContractEndDate: '2026-06-25', vacancySince: '2026-06-25', vacancySinceSource: 'contract_end', daysVacant: 20,
    },
    {
      unitId: 'unit-3', propertyId: 'property-1', unitNumber: '3', propertyTitle: 'برج الخليج',
      referenceRent: null, lastContractEndDate: null, vacancySince: '2026-07-05', vacancySinceSource: 'unit_created', daysVacant: 10,
    },
  ],
  vacancyRiskRows: [],
};

const fixtureMaintenanceFollowUp: MaintenanceFollowUpSignal = {
  stalledCount: 1,
  awaitingClosureCount: 1,
  scheduleMissedCount: 1,
  actionableCount: 2,
  oldestOpenAgeDays: 34,
  rows: [
    { requestId: 'mnt-1', title: 'تسرب في مواسير الحمام', location: 'برج الخليج · الوحدة 3', flag: 'stalled', flagLabel: 'متوقفة عن التقدم', ageDays: 34 },
    { requestId: 'mnt-2', title: 'عطل مصعد الطابق الأرضي', location: 'واحة مسقط', flag: 'schedule_missed', flagLabel: 'تجاوزت موعد الزيارة', ageDays: 12 },
  ],
};

const fixtureMaintenanceSummary: MaintenanceDashboardSummary = {
  total: 24,
  active: 4,
  completed: 18,
  urgentOpen: 1,
  averageResolutionDays: 2.4,
  previousAverageResolutionDays: 2.9,
  resolutionChangePercent: -17,
};

const fixtureChartRows: readonly MonthlyCashflowChartRow[] = [
  { month: '2026-02', label: 'فبراير', collected: 9_800, expenses: 1_200 },
  { month: '2026-03', label: 'مارس', collected: 11_400, expenses: 1_650 },
  { month: '2026-04', label: 'أبريل', collected: 10_950, expenses: 1_100 },
  { month: '2026-05', label: 'مايو', collected: 12_300, expenses: 1_900 },
  { month: '2026-06', label: 'يونيو', collected: 11_750, expenses: 1_350 },
  { month: '2026-07', label: 'يوليو', collected: 12_000, expenses: 1_500 },
];

const fixtureUnits = [
  { id: 'unit-1', property_id: 'property-1', unit_number: '1', status: 'occupied' },
  { id: 'unit-2', property_id: 'property-1', unit_number: '2', status: 'occupied' },
  { id: 'unit-3', property_id: 'property-1', unit_number: '3', status: 'available' },
  { id: 'unit-4', property_id: 'property-1', unit_number: '4', status: 'occupied' },
  { id: 'unit-5', property_id: 'property-2', unit_number: '5', status: 'occupied' },
  { id: 'unit-6', property_id: 'property-2', unit_number: '6', status: 'occupied' },
  { id: 'unit-7', property_id: 'property-2', unit_number: '7', status: 'available' },
  { id: 'unit-8', property_id: 'property-2', unit_number: '8', status: 'occupied' },
  { id: 'unit-9', property_id: 'property-2', unit_number: '9', status: 'available' },
] as const;

const fixtureMaintenanceRows = [
  { id: 'mnt-1', property_id: 'property-1', unit_id: 'unit-3', title: 'تسرب مياه', priority: 'urgent', status: 'open' },
  { id: 'mnt-2', property_id: 'property-2', unit_id: null, title: 'عطل مصعد', priority: 'high', status: 'in_progress' },
] as const;

const fixturePropertyTitles = new Map<string, string>([
  ['property-1', 'برج الخليج'],
  ['property-2', 'واحة مسقط'],
]);

const fixturePropertyHealthRows: readonly PropertyHealthRow[] = buildPropertyHealthRows({
  units: fixtureUnits as never,
  vacantRows: fixtureVacancyAnalytics.vacantRows,
  maintenance: fixtureMaintenanceRows as never,
  propertyTitles: fixturePropertyTitles,
});

const fixtureNeedsAttention = buildNeedsAttentionSignal({
  snapshot: fixtureSnapshot,
  vacancyAnalytics: fixtureVacancyAnalytics,
  utilityObligations: fixtureUtilityObligations,
  maintenanceFollowUp: fixtureMaintenanceFollowUp,
});

const expiringRows = buildExpiringContracts(fixtureSnapshot.queues.expiringContracts);

export function DashboardWorkspaceE2EFixture() {
  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground outline-none" dir="rtl" tabIndex={-1} data-e2e-dashboard-workspace>
      <div className="px-3 py-4 sm:px-6 lg:px-8">
        <PageLayout>
          <PageHeader title="لوحة التحكم" />
          <div className="grid min-w-0 gap-5">
            <section aria-label="نبض المكتب" data-dashboard-section="office-pulse">
              <SectionHeader eyebrow="1 · الآن" title="نبض المكتب" />
              <OfficePulse snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>

            <section aria-label="الأداء المالي" data-dashboard-section="financial-performance">
              <SectionHeader eyebrow="2 · الأداء المالي" title="أداء المكتب" />
              <FinancialPerformanceSection
                snapshot={fixtureSnapshot}
                vacancyAnalytics={fixtureVacancyAnalytics}
                vacancyDetailsUnavailable={false}
                settings={fixtureSettings}
                window="six_months"
                onWindowChange={() => undefined}
                chartRows={fixtureChartRows}
                chartIsLoading={false}
                chartIsError={false}
                onChartRetry={() => undefined}
              />
            </section>

            <section aria-label="الحالات التي تحتاج انتباهاً" data-dashboard-section="needs-attention">
              <SectionHeader eyebrow="3 · أولويات" title="يحتاج انتباهك" />
              <NeedsAttentionSection signal={fixtureNeedsAttention} isLoading={false} />
            </section>

            <section aria-label="الإشغال والشغور" data-dashboard-section="occupancy">
              <SectionHeader eyebrow="4 · المحفظة" title="الإشغال والشغور" />
              <OccupancySection
                snapshot={fixtureSnapshot}
                analytics={fixtureVacancyAnalytics}
                isLoading={false}
                settings={fixtureSettings}
              />
            </section>

            <section aria-label="التحصيل والمتأخرات" data-dashboard-section="collections">
              <SectionHeader eyebrow="5 · تحصيل" title="التحصيل والمتأخرات" />
              <CollectionsSection snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>

            <section aria-label="الصيانة والخدمات" data-dashboard-section="maintenance">
              <SectionHeader eyebrow="6 · خدمات" title="الصيانة والخدمات" />
              <div className="grid gap-3 md:grid-cols-2">
                <MaintenanceSection
                  summary={fixtureMaintenanceSummary}
                  urgentRows={fixtureSnapshot.queues.urgentMaintenance}
                  followUp={fixtureMaintenanceFollowUp}
                  isLoading={false}
                  maintenanceIsLoading={false}
                  maintenanceIsError={false}
                />
                <UtilityObligationsSection signal={fixtureUtilityObligations} isLoading={false} settings={fixtureSettings} />
              </div>
            </section>

            <section aria-label="العقود القريبة من الانتهاء" data-dashboard-section="upcoming-contracts">
              <SectionHeader eyebrow="7 · عقود" title="العقود القادمة" />
              <UpcomingContractsSection
                rows={expiringRows}
                expiring30={fixtureSnapshot.contracts.expiring30}
                expiring60={fixtureSnapshot.contracts.expiring60}
                expiring90={fixtureSnapshot.contracts.expiring90}
                isLoading={false}
                settings={fixtureSettings}
              />
            </section>

            <section aria-label="صحة العقارات" data-dashboard-section="property-health">
              <SectionHeader eyebrow="8 · المحفظة" title="صحة العقارات" />
              <PropertyHealthSection rows={fixturePropertyHealthRows} isLoading={false} />
            </section>

            <section aria-label="مستحقات الملاك" data-dashboard-section="owner-obligations">
              <SectionHeader eyebrow="9 · ملاك" title="مستحقات الملاك" />
              <div className="grid gap-3 md:grid-cols-2">
                <OwnerObligationsSection snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
                <FinanceExceptionsSection snapshot={fixtureSnapshot} isLoading={false} />
              </div>
            </section>
          </div>
        </PageLayout>
      </div>
    </main>
  );
}
