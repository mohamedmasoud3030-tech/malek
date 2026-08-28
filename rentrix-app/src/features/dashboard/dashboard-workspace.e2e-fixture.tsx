import { PageLayout } from '@/components/layout/page-layout';
import { SectionHeader } from '@/components/ui/section-header';
import { formatCompanyDate, formatCompanyMoney, formatCompanyNumber } from '@/lib/companyFormatters';
import { defaultCompanySettingsContract } from '@/lib/companySettings';
import { ExpiringContractsSection } from './components/expiring-contracts-section';
import { OfficePulse } from './components/office-pulse';
import { OwnerObligationsSection } from './components/owner-obligations-section';
import { OverdueSection } from './components/overdue-section';
import { UrgentMaintenanceSection } from './components/urgent-maintenance-section';
import { UtilityObligationsSection } from './components/utility-obligations-section';
import { VacantUnitsSection } from './components/vacant-units-section';
import { MaintenanceFollowUpSection } from './components/maintenance-follow-up-section';
import { DashboardVisualScope } from './dashboard-visual-scope';
import type { DashboardSnapshot } from './dashboard-snapshot';
import { addDays, buildExpiringContracts, buildOverdueTenantRows, toDateInputValue } from './dashboard-utils';
import type { UtilityObligationsSignal } from './utility-obligations-signal';
import type { VacancyAnalytics } from '@/features/units/vacancy-analytics';
import type { MaintenanceFollowUpSignal } from './maintenance-follow-up-signal';

const soonDate = toDateInputValue(addDays(new Date(), 9));
const laterDate = toDateInputValue(addDays(new Date(), 18));
const fixtureSettings = {
  ...defaultCompanySettingsContract,
  money: (value: number | null | undefined) => formatCompanyMoney(defaultCompanySettingsContract, value),
  date: (value: string) => formatCompanyDate(defaultCompanySettingsContract, `${value}T00:00:00`),
  number: (value: number | null | undefined) => formatCompanyNumber(defaultCompanySettingsContract, value),
};

const fixtureSnapshot: DashboardSnapshot = {
  period: { dateFrom: '2026-07-01', dateTo: '2026-07-15', asOf: '2026-07-15', month: 7, year: 2026 },
  portfolio: { properties: 4, units: 15 },
  // Legacy snapshot field groups every non-occupied unit together: 2 available
  // + 1 maintenance. The vacancy card intentionally does NOT use this as the
  // true vacant count.
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
  ownerFunds: { netPayable: 0, settlementsDraft: 1, settlementsApproved: 0 },
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
  availableUnits: 2,
  nonRentableUnits: 1,
  occupancyRate: 80,
  vacancyRate: (2 / 15) * 100,
  averageVacancyDays: 20,
  referenceVacantRent: 280,
  previousMonthOccupancyRate: 80,
  occupancyChangePoints: 0,
  previousMonthEnd: '2026-06-30',
  vacantRows: [
    {
      unitId: 'unit-7', propertyId: 'property-2', unitNumber: '7', propertyTitle: 'واحة مسقط',
      referenceRent: 280, lastContractEndDate: '2026-06-20', vacancySince: '2026-06-20', vacancySinceSource: 'contract_end', daysVacant: 25,
    },
    {
      unitId: 'unit-9', propertyId: 'property-2', unitNumber: '9', propertyTitle: 'واحة مسقط',
      referenceRent: null, lastContractEndDate: null, vacancySince: '2026-07-01', vacancySinceSource: 'unit_created', daysVacant: 14,
    },
  ],
  vacancyRiskRows: [],
};

const fixtureMaintenanceFollowUp: MaintenanceFollowUpSignal = {
  stalledCount: 2,
  awaitingClosureCount: 1,
  scheduleMissedCount: 1,
  actionableCount: 3,
  oldestOpenAgeDays: 34,
  rows: [
    { requestId: 'mnt-1', title: 'تسرب في مواسير الحمام', location: 'برج الخليج · الوحدة 3', flag: 'stalled', flagLabel: 'متوقفة عن التقدم', ageDays: 34 },
    { requestId: 'mnt-2', title: 'عطل مصعد الطابق الأرضي', location: 'واحة مسقط', flag: 'schedule_missed', flagLabel: 'تجاوزت موعد الزيارة', ageDays: 12 },
    { requestId: 'mnt-3', title: 'استبدال وحدة تكييف', location: 'برج الخليج · الوحدة 7', flag: 'awaiting_closure', flagLabel: 'بانتظار الإغلاق', ageDays: 6 },
  ],
};

const expiringRows = buildExpiringContracts(fixtureSnapshot.queues.expiringContracts);
const overdueRows = buildOverdueTenantRows(fixtureSnapshot.queues.overdueInvoices);

/**
 * Static Dashboard proof fixture (Visual Contract V2, ADR 0012 phase 2).
 * Kept only as a low-cost layout showcase; the Dashboard Playwright contract
 * targets the real /dashboard route with controlled authenticated data.
 */
export function DashboardWorkspaceE2EFixture() {
  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground outline-none" dir="rtl" tabIndex={-1} data-e2e-dashboard-workspace>
      <div className="px-3 py-4 sm:px-6 lg:px-8">
        <PageLayout className="dashboard-page-shell">
          <DashboardVisualScope>
            <section className="dashboard-section" aria-label="أداء المكتب" data-dashboard-section="office-performance">
              <SectionHeader eyebrow="1 · الآن" title="أداء المكتب" />
              <OfficePulse snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>

            <section className="dashboard-section" aria-label="الوحدات الفارغة" data-dashboard-section="vacant-units">
              <SectionHeader eyebrow="2 · المحفظة" title="الوحدات الفارغة" />
              <VacantUnitsSection analytics={fixtureVacancyAnalytics} isLoading={false} settings={fixtureSettings} />
            </section>

            <section className="dashboard-section" aria-label="الفلوس المطلوب تحصيلها" data-dashboard-section="collections">
              <SectionHeader eyebrow="3 · تحصيل" title="الفلوس المطلوب تحصيلها" />
              <OverdueSection rows={overdueRows} totalCount={fixtureSnapshot.arrears.overdueCount} isLoading={false} settings={fixtureSettings} />
            </section>

            <section className="dashboard-section" aria-label="المشاكل والصيانة" data-dashboard-section="maintenance-problems">
              <SectionHeader eyebrow="4 · خدمات" title="المشاكل والصيانة" />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <UrgentMaintenanceSection rows={fixtureSnapshot.queues.urgentMaintenance} totalCount={fixtureSnapshot.maintenance.urgentOpen} isLoading={false} />
                <MaintenanceFollowUpSection signal={fixtureMaintenanceFollowUp} isLoading={false} />
                <UtilityObligationsSection signal={fixtureUtilityObligations} isLoading={false} settings={fixtureSettings} />
              </div>
            </section>

            <section className="dashboard-section" aria-label="العقود القريبة من الانتهاء" data-dashboard-section="expiring-contracts">
              <SectionHeader eyebrow="5 · عقود" title="العقود القريبة من الانتهاء" />
              <ExpiringContractsSection rows={expiringRows} totalCount={fixtureSnapshot.contracts.expiring30} isLoading={false} settings={fixtureSettings} />
            </section>

            <section className="dashboard-section" aria-label="مستحقات الملاك" data-dashboard-section="owner-obligations">
              <SectionHeader eyebrow="6 · ملاك" title="مستحقات الملاك" />
              <OwnerObligationsSection snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>
          </DashboardVisualScope>
        </PageLayout>
      </div>
    </main>
  );
}
