import { PageLayout } from '@/components/layout/page-layout';
import { SectionHeader } from '@/components/ui/section-header';
import { formatCompanyDate, formatCompanyMoney, formatCompanyNumber } from '@/lib/companyFormatters';
import { defaultCompanySettingsContract } from '@/lib/companySettings';
import { AlertCenter } from './components/alert-center';
import { DashboardCharts } from './components/dashboard-charts';
import { ExpiringContractsSection } from './components/expiring-contracts-section';
import { HeroBanner } from './components/hero-banner';
import { OverdueSection } from './components/overdue-section';
import { DashboardVisualScope } from './dashboard-visual-scope';
import type { DashboardSnapshot } from './dashboard-snapshot';
import { addDays, buildExpiringContracts, buildOverdueTenantRows, toDateInputValue } from './dashboard-utils';

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

const expiringRows = buildExpiringContracts(fixtureSnapshot.queues.expiringContracts);
const overdueRows = buildOverdueTenantRows(fixtureSnapshot.queues.overdueInvoices);

/** Static, deterministic rendering of the real Today hierarchy. */
export function DashboardWorkspaceE2EFixture() {
  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground outline-none" dir="rtl" tabIndex={-1} data-e2e-dashboard-workspace>
      <div className="px-3 py-4 sm:px-6 lg:px-8">
        <PageLayout className="dashboard-page-shell">
          <DashboardVisualScope>
            <HeroBanner snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} today="2026-07-15" />

            <section className="dashboard-section" data-dashboard-section="work-now" aria-label="مطلوب منك الآن">
              <SectionHeader eyebrow="أولوية" title="مطلوب منك الآن" />
              <AlertCenter
                expiringContractsCount={fixtureSnapshot.contracts.expiring30}
                overdueInvoicesCount={fixtureSnapshot.arrears.overdueCount}
                urgentMaintenanceCount={fixtureSnapshot.maintenance.urgentOpen}
                vacantUnitsCount={fixtureSnapshot.occupancy.vacantUnits}
                unmatchedBankTxCount={fixtureSnapshot.exceptions.unmatchedBankLines}
                pendingSettlementsCount={fixtureSnapshot.exceptions.pendingSettlements}
                integrityWarningsCount={0}
              />
              <div className="dashboard-queues-grid">
                <ExpiringContractsSection rows={expiringRows} totalCount={fixtureSnapshot.contracts.expiring30} isLoading={false} settings={fixtureSettings} />
                <OverdueSection rows={overdueRows} totalCount={fixtureSnapshot.arrears.overdueCount} isLoading={false} settings={fixtureSettings} />
              </div>
            </section>

            <section className="dashboard-section" aria-label="حالة المحفظة" data-dashboard-section="portfolio">
              <SectionHeader title="حالة المحفظة" />
              <DashboardCharts snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>
          </DashboardVisualScope>
        </PageLayout>
      </div>
    </main>
  );
}
