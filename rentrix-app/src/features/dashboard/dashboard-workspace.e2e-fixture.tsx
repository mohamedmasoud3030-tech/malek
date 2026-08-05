import { PageLayout } from '@/components/layout/page-layout';
import { SectionHeader } from '@/components/ui/section-header';
import { defaultCompanySettingsContract } from '@/lib/companySettings';
import { AlertCenter } from './components/alert-center';
import { ArrearsBreakdown } from './components/arrears-breakdown';
import { DashboardCharts } from './components/dashboard-charts';
import { HeroBanner } from './components/hero-banner';
import { KpiGrid } from './components/kpi-grid';
import { QuickActions } from './components/quick-actions';
import { DashboardVisualScope } from './dashboard-visual-scope';
import type { DashboardSnapshot } from './dashboard-snapshot';

const bucket = (key: 'current' | 'days_1_30' | 'days_31_60' | 'days_61_90' | 'days_90_plus', label: string, total: number, invoiceCount: number) => ({
  key,
  label,
  total,
  invoiceCount,
});

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
    overdueInvoices: [],
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
  activeContracts: [],
  maintenance: { urgentRequests: [], totalOpen: 2, totalInProgress: 1 },
  deferred: [],
};

/**
 * Static Dashboard proof fixture (Visual Contract V2, ADR 0012 phase 2).
 * Mirrors DashboardPage structure exactly: the [data-visual-contract='v2']
 * Dashboard-owned scope, priorities-first decision hierarchy, KPI destination
 * links, permission-aware Quick Actions (fixture grants every permission so
 * the layout contract stays visible outside an authenticated session), work
 * queues and secondary analytics.
 */
export function DashboardWorkspaceE2EFixture() {
  return (
    <main className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground" dir="rtl" data-e2e-dashboard-workspace>
      <div className="px-3 py-4 sm:px-6 lg:px-8">
        <PageLayout className="space-y-6">
          <DashboardVisualScope>
            <HeroBanner snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} today="2026-07-15" />

            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]" data-dashboard-section="priorities">
              <AlertCenter
                expiringContracts={[]}
                overdueInvoices={[
                  { id: 'invoice-1', amount: 1_500, due_date: '2026-06-10', tenant_name: 'أحمد الفارسي' },
                  { id: 'invoice-2', amount: 1_500, due_date: '2026-06-12', tenant_name: 'سالم الكعبي' },
                ]}
                urgentMaintenance={[{ id: 'maintenance-1', title: 'تسرب مياه', priority: 'urgent' }]}
              />
              <QuickActions canAccessOverride={() => true} />
            </div>

            <section className="space-y-3" aria-label="صورة الأداء" data-dashboard-section="kpis">
              <SectionHeader title="صورة الأداء" description="أربع مؤشرات قرار مرتبة في شبكة 2×2 ثابتة" />
              <KpiGrid snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>

            <section className="space-y-4" aria-label="الاتجاهات والتفاصيل" data-dashboard-section="trends">
              <SectionHeader title="الاتجاهات والتفاصيل" description="تفاصيل مساندة بعد إنهاء الأعمال ذات الأولوية" />
              <DashboardCharts snapshot={fixtureSnapshot} isLoading={false} settings={defaultCompanySettingsContract} />
            </section>

            <section className="space-y-3" aria-label="قوائم العمل" data-dashboard-section="work-queues">
              <SectionHeader title="قوائم العمل" description="الحالات الأعلى أولوية للتنفيذ اليومي" />
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="min-h-32 rounded-3xl border border-border/60 bg-card p-4">
                  <h3 className="font-black">العقود المنتهية قريباً</h3>
                  <p className="mt-2 text-sm text-muted-foreground">حالتان تحتاجان مراجعة التجديد.</p>
                </div>
                <div className="min-h-32 rounded-3xl border border-border/60 bg-card p-4">
                  <h3 className="font-black">أعلى المتأخرات</h3>
                  <p className="mt-2 text-sm text-muted-foreground">فاتورتان تحتاجان متابعة التحصيل.</p>
                </div>
              </div>
            </section>

            <section className="space-y-3" aria-label="تحليلات مساندة" data-dashboard-section="analytics">
              <SectionHeader title="تحليلات مساندة" description="تفاصيل ثانوية للتعمق بعد أولويات التشغيل" />
              <ArrearsBreakdown snapshot={fixtureSnapshot} settings={defaultCompanySettingsContract} />
            </section>
          </DashboardVisualScope>
        </PageLayout>
      </div>
    </main>
  );
}
