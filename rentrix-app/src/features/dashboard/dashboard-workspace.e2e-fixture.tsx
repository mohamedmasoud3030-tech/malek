import { PageLayout } from '@/components/layout/page-layout';
import { SectionHeader } from '@/components/ui/section-header';
import { formatCompanyDate, formatCompanyMoney, formatCompanyNumber } from '@/lib/companyFormatters';
import { defaultCompanySettingsContract } from '@/lib/companySettings';
import { AlertCenter } from './components/alert-center';
import { ArrearsBreakdown } from './components/arrears-breakdown';
import { DashboardCharts } from './components/dashboard-charts';
import { ExpiringContractsSection } from './components/expiring-contracts-section';
import { HeroBanner } from './components/hero-banner';
import { KpiGrid } from './components/kpi-grid';
import { OverdueSection } from './components/overdue-section';
import { QuickActions } from './components/quick-actions';
import { DashboardVisualScope } from './dashboard-visual-scope';
import type { DashboardSnapshot } from './dashboard-snapshot';
import { addDays, toDateInputValue, type ExpiringContractRow, type OverdueTenantRow } from './dashboard-utils';

const bucket = (key: 'current' | 'days_1_30' | 'days_31_60' | 'days_61_90' | 'days_90_plus', label: string, total: number, invoiceCount: number) => ({
  key,
  label,
  total,
  invoiceCount,
});

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
  overview: {
    financial: { total_collected: 12_000, total_overdue_invoices: 3_000, total_expenses: 1_500, net_revenue: 10_500 },
    operational: { properties: 4, units: 15, activeContracts: 8, expiringContracts30Days: 2, vacantUnits: 3, overdueInvoices: 2 },
  },
  financial: {
    rentDue: 15_000,
    collectedRent: 12_000,
    outstandingRent: 3_000,
    expenses: 1_500,
    netPosition: 10_500,
    invoicesCount: 10,
    paymentsCount: 8,
    expensesCount: 3,
  },
  operational: {
    properties: 4,
    units: 15,
    activeContracts: 8,
    expiringContracts30Days: 2,
    vacantUnits: 3,
    occupiedUnits: 12,
    occupancyRate: 80,
  },
  arrears: {
    totalOverdue: 3_000,
    overdueInvoiceCount: 2,
    averageDaysOverdue: 28,
    over90Amount: 0,
    over90InvoiceCount: 0,
    overdueInvoices: [
      {
        invoiceId: 'invoice-1',
        shortInvoiceId: 'invoice-',
        contractId: 'contract-1',
        tenantId: 'tenant-1',
        tenantName: 'أحمد الفارسي',
        propertyId: 'property-1',
        propertyTitle: 'برج الخليج',
        unitId: 'unit-5',
        unitNumber: '5',
        dueDate: '2026-06-10',
        daysOverdue: 35,
        amount: 1_500,
        paidAmount: 0,
        remainingAmount: 1_500,
        status: 'overdue',
      },
      {
        invoiceId: 'invoice-2',
        shortInvoiceId: 'invoice-',
        contractId: 'contract-2',
        tenantId: 'tenant-2',
        tenantName: 'سالم الكعبي',
        propertyId: 'property-2',
        propertyTitle: 'واحة مسقط',
        unitId: 'unit-12',
        unitNumber: '12',
        dueDate: '2026-06-12',
        daysOverdue: 33,
        amount: 1_500,
        paidAmount: 0,
        remainingAmount: 1_500,
        status: 'overdue',
      },
    ],
    agedReceivables: {
      asOf: '2026-07-15',
      buckets: {
        current: bucket('current', 'غير متأخر', 0, 0),
        days_1_30: bucket('days_1_30', '1–30 يوم', 1_500, 1),
        days_31_60: bucket('days_31_60', '31–60 يوم', 1_500, 1),
        days_61_90: bucket('days_61_90', '61–90 يوم', 0, 0),
        days_90_plus: bucket('days_90_plus', 'أكثر من 90 يوم', 0, 0),
      },
      totalOutstanding: 3_000,
      totalOverdue: 3_000,
      rows: [],
    },
  },
  activeContracts: [
    {
      id: 'contract-1',
      property_id: 'property-1',
      unit_id: 'unit-5',
      tenant_id: 'tenant-1',
      start_date: '2025-08-01',
      end_date: soonDate,
      rent_amount: 750,
      payment_cycle: 'monthly',
      status: 'active',
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
      deleted_at: null,
      notes: null,
      agreement_id: null,
      payment_terms_id: null,
      cancellation_reason: null,
      attachment_url: null,
      renewed_from_id: null,
      properties: { id: 'property-1', title: 'برج الخليج', address: 'مسقط' },
      units: { id: 'unit-5', unit_number: '5', floor: '1', status: 'occupied', rent_amount: 750 },
      people: { id: 'tenant-1', full_name: 'أحمد الفارسي', phone: null, email: null, national_id: null },
    } as DashboardSnapshot['activeContracts'][number],
    {
      id: 'contract-2',
      property_id: 'property-2',
      unit_id: 'unit-12',
      tenant_id: 'tenant-2',
      start_date: '2025-08-01',
      end_date: laterDate,
      rent_amount: 900,
      payment_cycle: 'monthly',
      status: 'active',
      created_at: '2026-07-01T00:00:00Z',
      updated_at: '2026-07-01T00:00:00Z',
      deleted_at: null,
      notes: null,
      agreement_id: null,
      payment_terms_id: null,
      cancellation_reason: null,
      attachment_url: null,
      renewed_from_id: null,
      properties: { id: 'property-2', title: 'واحة مسقط', address: 'مسقط' },
      units: { id: 'unit-12', unit_number: '12', floor: '2', status: 'occupied', rent_amount: 900 },
      people: { id: 'tenant-2', full_name: 'سالم الكعبي', phone: null, email: null, national_id: null },
    } as DashboardSnapshot['activeContracts'][number],
  ],
  maintenance: { urgentRequests: [{ id: 'maintenance-1', title: 'تسرب مياه', priority: 'urgent', status: 'open' } as DashboardSnapshot['maintenance']['urgentRequests'][number]], totalOpen: 2, totalInProgress: 1 },
  deferred: [],
};

const expiringRows: ExpiringContractRow[] = [
  { id: 'contract-1', contractNumber: 'contract', tenantName: 'أحمد الفارسي', location: 'برج الخليج / وحدة 5', endDate: soonDate, daysRemaining: 9 },
  { id: 'contract-2', contractNumber: 'contract', tenantName: 'سالم الكعبي', location: 'واحة مسقط / وحدة 12', endDate: laterDate, daysRemaining: 18 },
];

const overdueRows: OverdueTenantRow[] = [
  { invoiceId: 'invoice-1', tenantName: 'أحمد الفارسي', location: 'برج الخليج / وحدة 5', dueDate: '2026-06-10', daysOverdue: 35, remainingAmount: 1_500 },
  { invoiceId: 'invoice-2', tenantName: 'سالم الكعبي', location: 'واحة مسقط / وحدة 12', dueDate: '2026-06-12', daysOverdue: 33, remainingAmount: 1_500 },
];

/**
 * Static Dashboard proof fixture (Visual Contract V2, ADR 0012 phase 2).
 * Kept only as a low-cost layout showcase; the Dashboard Playwright contract
 * now targets the real /dashboard route with controlled authenticated data.
 */
export function DashboardWorkspaceE2EFixture() {
  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground" dir="rtl" data-e2e-dashboard-workspace>
      <div className="px-3 py-4 sm:px-6 lg:px-8">
        <PageLayout className="dashboard-page-shell">
          <DashboardVisualScope>
            <HeroBanner snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} today="2026-07-15" />

            <section data-dashboard-section="priorities" aria-label="الأولوية الآن">
              <AlertCenter
                expiringContracts={fixtureSnapshot.activeContracts}
                overdueInvoices={[
                  { id: 'invoice-1', amount: 1_500, due_date: '2026-06-10', tenant_name: 'أحمد الفارسي' },
                  { id: 'invoice-2', amount: 1_500, due_date: '2026-06-12', tenant_name: 'سالم الكعبي' },
                ]}
                urgentMaintenance={[{ id: 'maintenance-1', title: 'تسرب مياه', priority: 'urgent' }]}
                vacantUnitsCount={3}
                unmatchedBankTxCount={2}
                pendingSettlementsCount={1}
                integrityWarningsCount={0}
              />
            </section>

            <section className="dashboard-section" aria-label="صورة الأداء" data-dashboard-section="kpis">
              <SectionHeader title="صورة الأداء" description="أربع مؤشرات قرار مرتبطة بمصادرها التفصيلية" />
              <KpiGrid snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>

            <div data-dashboard-section="actions">
              <QuickActions canAccessOverride={() => true} />
            </div>

            <section className="dashboard-section" aria-label="قوائم العمل" data-dashboard-section="work-queues">
              <SectionHeader title="قوائم العمل" description="متابعة مركزة للحالات الأعلى أولوية بعد قراءة المؤشرات" />
              <div className="dashboard-queues-grid">
                <ExpiringContractsSection rows={expiringRows} isLoading={false} settings={fixtureSettings} />
                <OverdueSection rows={overdueRows} isLoading={false} settings={fixtureSettings} />
              </div>
            </section>

            <section className="dashboard-section" aria-label="المحفظة والتحصيل" data-dashboard-section="trends">
              <SectionHeader title="المحفظة والتحصيل" description="ملخصات ثانوية للانتقال إلى التفاصيل، وليست جدولاً محاسبياً كثيفاً" />
              <DashboardCharts snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>

            <section className="dashboard-section" aria-label="تحليلات مساندة" data-dashboard-section="analytics">
              <SectionHeader title="تحليلات مساندة" description="تفاصيل أعمار الذمم بعد ترتيب الأعمال العاجلة" />
              <ArrearsBreakdown snapshot={fixtureSnapshot} settings={defaultCompanySettingsContract} />
            </section>
          </DashboardVisualScope>
        </PageLayout>
      </div>
    </main>
  );
}
