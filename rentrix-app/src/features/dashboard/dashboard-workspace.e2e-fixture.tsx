import { PageLayout } from '@/components/layout/page-layout';
import { SectionHeader } from '@/components/ui/section-header';
import { formatCompanyDate, formatCompanyMoney, formatCompanyNumber } from '@/lib/companyFormatters';
import { defaultCompanySettingsContract } from '@/lib/companySettings';
import { AlertCenter } from './components/alert-center';
import { ArrearsBreakdown } from './components/arrears-breakdown';
import { DashboardCharts } from './components/dashboard-charts';
import { ExpiringContractsSection } from './components/expiring-contracts-section';
import { KpiGrid } from './components/kpi-grid';
import { OfficePulse } from './components/office-pulse';
import { OverdueSection } from './components/overdue-section';
import { UrgentMaintenanceSection } from './components/urgent-maintenance-section';
import { UtilityObligationsSection } from './components/utility-obligations-section';
import { VacantUnitsSection } from './components/vacant-units-section';
import { MaintenanceFollowUpSection } from './components/maintenance-follow-up-section';
import { DashboardVisualScope } from './dashboard-visual-scope';
import type { DashboardSnapshot } from './dashboard-snapshot';
import { addDays, buildExpiringContracts, buildOverdueTenantRows, toDateInputValue } from './dashboard-utils';
import type { UtilityObligationsSignal } from './utility-obligations-signal';
import type { VacantUnitsSignal } from './vacant-units-signal';
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

const fixtureVacantUnits: VacantUnitsSignal = {
  availableCount: 2,
  outOfServiceCount: 1,
  reservedCount: 0,
  attentionCount: 3,
  rows: [
    { unitId: 'unit-3', propertyId: 'property-1', title: 'وحدة 3', location: 'برج الخليج', status: 'maintenance', statusLabel: 'متوقفة للصيانة', referenceRent: 320 },
    { unitId: 'unit-7', propertyId: 'property-2', title: 'وحدة 7', location: 'واحة مسقط', status: 'available', statusLabel: 'شاغرة', referenceRent: 280 },
    { unitId: 'unit-9', propertyId: 'property-2', title: 'وحدة 9', location: 'واحة مسقط', status: 'available', statusLabel: 'شاغرة', referenceRent: null },
  ],
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
            <section className="dashboard-section" data-dashboard-section="work-now" aria-label="مطلوب الآن">
              <SectionHeader eyebrow="أولوية" title="مطلوب الآن" />
              <AlertCenter
                expiringContractsCount={fixtureSnapshot.contracts.expiring30}
                overdueInvoicesCount={fixtureSnapshot.arrears.overdueCount}
                urgentMaintenanceCount={fixtureSnapshot.maintenance.urgentOpen}
                utilityObligationsCount={fixtureUtilityObligations.actionableCount}
                vacantUnitsCount={fixtureSnapshot.occupancy.vacantUnits}
                unmatchedBankTxCount={fixtureSnapshot.exceptions.unmatchedBankLines}
                pendingSettlementsCount={fixtureSnapshot.exceptions.pendingSettlements}
                integrityWarningsCount={0}
              />
            </section>

            <section className="dashboard-section" aria-label="نبض المكتب" data-dashboard-section="office-pulse">
              <SectionHeader eyebrow="الآن" title="نبض المكتب" />
              <OfficePulse snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>

            <section className="dashboard-section" aria-label="العمل المنتظر" data-dashboard-section="work-queues">
              <SectionHeader eyebrow="متابعة" title="العمل المنتظر" />
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <OverdueSection rows={overdueRows} totalCount={fixtureSnapshot.arrears.overdueCount} isLoading={false} settings={fixtureSettings} />
                <ExpiringContractsSection rows={expiringRows} totalCount={fixtureSnapshot.contracts.expiring30} isLoading={false} settings={fixtureSettings} />
                <UrgentMaintenanceSection rows={fixtureSnapshot.queues.urgentMaintenance} totalCount={fixtureSnapshot.maintenance.urgentOpen} isLoading={false} />
                <MaintenanceFollowUpSection signal={fixtureMaintenanceFollowUp} isLoading={false} />
                <UtilityObligationsSection signal={fixtureUtilityObligations} isLoading={false} settings={fixtureSettings} />
                <VacantUnitsSection signal={fixtureVacantUnits} serverVacantCount={fixtureSnapshot.occupancy.vacantUnits} isLoading={false} settings={fixtureSettings} />
              </div>
            </section>

            <section className="dashboard-section" aria-label="المال والالتزامات" data-dashboard-section="money-obligations">
              <SectionHeader eyebrow="مالي" title="المال والالتزامات" />
              <KpiGrid snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>

            <section className="dashboard-section" aria-label="حالة التحصيل والمحفظة" data-dashboard-section="operational-health">
              <SectionHeader eyebrow="صورة تشغيلية" title="حالة التحصيل والمحفظة" />
              <DashboardCharts snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>

            <section className="dashboard-section" aria-label="تحليل المتأخرات" data-dashboard-section="analytics">
              <SectionHeader eyebrow="تحليل" title="تحليل المتأخرات" />
              <ArrearsBreakdown snapshot={fixtureSnapshot} settings={defaultCompanySettingsContract} />
            </section>
          </DashboardVisualScope>
        </PageLayout>
      </div>
    </main>
  );
}
