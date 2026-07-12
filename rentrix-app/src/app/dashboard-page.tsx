import { Link } from '@tanstack/react-router';
import {
  AlertTriangle, Building2, CalendarClock,
  FileText, Home, Plus, ReceiptText, TrendingUp, Users, WalletCards,
  BarChart3,
} from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataErrorScreen } from '@/components/data-error-screen';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/ui/kpi-card';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { cn } from '@/lib/utils';
import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';
import { getDashboardSnapshot, type DashboardSnapshot } from './dashboardSnapshot';
import { ExpiringContractsSection } from './dashboard/ExpiringContractsSection';
import { OverdueSection } from './dashboard/OverdueSection';
import {
  DASHBOARD_WINDOW_DAYS,
  MAX_EXPIRING_ROWS,
  MAX_OVERDUE_ROWS,
  toDateInputValue,
  addDays,
  buildExpiringContracts,
  buildOverdueTenantRows,
  type ExpiringContractRow,
  type OverdueTenantRow,
} from './dashboard/dashboard.utils';

const quickActions = [
  { label: 'إنشاء عقد',  to: '/contracts/new', icon: FileText,    accent: 'bg-primary/10 text-primary' },
  { label: 'الفواتير',   to: '/invoices',       icon: ReceiptText, accent: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' },
  { label: 'المتأخرات',  to: '/arrears',        icon: AlertTriangle, accent: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  { label: 'المالية',    to: '/financials',     icon: WalletCards, accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  { label: 'التقارير',   to: '/reports',        icon: BarChart3,   accent: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' },
] as const;

const arrearsBucketOrder = ['days_1_30', 'days_31_60', 'days_61_90', 'days_90_plus'] as const;
const arrearsBucketLabels: Record<(typeof arrearsBucketOrder)[number], string> = {
  days_1_30: '1–30 يوم',
  days_31_60: '31–60 يوم',
  days_61_90: '61–90 يوم',
  days_90_plus: 'أكثر من 90 يوم',
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'صباح الخير';
  if (hour < 17) return 'مساء الخير';
  return 'مساء النور';
}

function getGreetingEmoji() {
  const hour = new Date().getHours();
  if (hour < 12) return '🌤';
  if (hour < 17) return '☀️';
  return '🌙';
}

// ── Hero Banner ───────────────────────────────────────────────────────────────
function HeroBanner({ snapshot, isLoading, settings, today }: Readonly<{
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: ReturnType<typeof useCompanyFormatters>;
  today: string;
}>) {
  const { money, date } = settings;
  const activeContracts = snapshot?.operational.activeContracts ?? 0;
  const vacantUnits = snapshot?.operational.vacantUnits ?? 0;
  const collected = snapshot?.financial.collectedRent ?? 0;
  const collectedAfterExpenses = snapshot?.financial.netPosition ?? 0;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 sm:p-6 text-white">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -left-8 -top-8 size-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -right-4 size-32 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="relative">
        {/* Greeting row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-400">{getGreeting()} <span aria-hidden="true">{getGreetingEmoji()}</span></p>
            <h1 className="mt-0.5 text-xl font-black">لوحة التحكم</h1>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold text-slate-300 backdrop-blur-sm">
            {date(snapshot?.period.dateTo ?? today)}
          </div>
        </div>

        {/* Main stat */}
        <div className="mt-4 flex items-end gap-3">
          <div>
            {isLoading ? (
              <Skeleton className="h-10 w-24 bg-white/10" />
            ) : (
              <p className="text-4xl font-black tabular-nums">{activeContracts}</p>
            )}
            <p className="text-sm font-semibold text-slate-400">عقد نشط</p>
          </div>

          <div className="mb-1 ms-4 h-10 w-px bg-white/20" />

          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-20 bg-white/10" />
            ) : (
              <p className="text-lg font-black" dir="ltr">{money(collected)}</p>
            )}
            <p className="text-xs font-semibold text-slate-400">محصّل هذا الشهر</p>
          </div>
        </div>

        {/* Stats pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          <div className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
            vacantUnits > 0
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-emerald-500/20 text-emerald-300',
          )}>
            <Home className="size-3" />
            {vacantUnits > 0 ? `${vacantUnits} وحدة شاغرة` : 'لا شواغر'}
          </div>
          <div className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold',
            collectedAfterExpenses >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300',
          )}>
            <TrendingUp className="size-3" />
            محصل بعد المصروفات {money(collectedAfterExpenses)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── KPI Grid ──────────────────────────────────────────────────────────────────
function KpiGrid({ snapshot, isLoading, settings }: Readonly<{
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: ReturnType<typeof useCompanyFormatters>;
}>) {
  const { money } = settings;
  const items = [
    {
      label: 'عقارات',
      value: snapshot?.operational.properties ?? 0,
      icon: Building2,
      accent: 'sky' as const,
      sub: `${snapshot?.operational.units ?? 0} وحدة إجمالاً`,
      description: 'إجمالي الأصول العقارية',
    },
    {
      label: 'نسبة الإشغال',
      value: `${snapshot?.operational.occupancyRate ?? 0}%`,
      icon: Home,
      accent: 'emerald' as const,
      sub: `${snapshot?.operational.occupiedUnits ?? 0} مشغولة`,
      trend: (snapshot?.operational.occupancyRate ?? 0) >= 80 ? 'up' as const : 'neutral' as const,
      trendValue: `${snapshot?.operational.occupancyRate ?? 0}%`,
      description: 'معدل استقرار المحفظة',
    },
    {
      label: 'المتأخرات',
      value: money(snapshot?.arrears.totalOverdue ?? 0),
      icon: AlertTriangle,
      accent: (snapshot?.arrears.totalOverdue ?? 0) > 0 ? 'rose' as const : 'emerald' as const,
      sub: `${snapshot?.arrears.overdueInvoiceCount ?? 0} فاتورة`,
      trend: (snapshot?.arrears.totalOverdue ?? 0) > 0 ? 'down' as const : 'neutral' as const,
      trendValue: money(snapshot?.arrears.totalOverdue ?? 0),
      description: 'أموال معلقة للتحصيل',
    },
    {
      label: 'عقود تنتهي قريباً',
      value: snapshot?.operational.expiringContracts30Days ?? 0,
      icon: CalendarClock,
      accent: (snapshot?.operational.expiringContracts30Days ?? 0) > 0 ? 'amber' as const : 'emerald' as const,
      sub: `خلال ${DASHBOARD_WINDOW_DAYS} يوم`,
      trend: (snapshot?.operational.expiringContracts30Days ?? 0) > 0 ? 'down' as const : 'neutral' as const,
      trendValue: `${snapshot?.operational.expiringContracts30Days ?? 0}`,
      description: 'عقود بحاجة للتجديد',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) =>
        isLoading ? (
          <Skeleton key={item.label} className="h-28 rounded-2xl" />
        ) : (
          <KpiCard key={item.label} {...item} />
        ),
      )}
    </div>
  );
}

// ── Quick Actions ─────────────────────────────────────────────────────────────
function QuickActions() {
  return (
    <div>
      <p className="mb-3 text-xs font-bold text-muted-foreground px-0.5">إجراءات سريعة</p>
      <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.to} to={action.to} className="shrink-0">
              <div className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-2xl p-4 min-h-[56px] min-w-[56px] transition-all',
                'hover:scale-105 active:scale-95 border border-border/50',
                action.accent,
              )}>
                <Icon className="size-6" />
                <span className="text-[11px] font-bold text-center leading-tight whitespace-nowrap">{action.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Financial Summary ─────────────────────────────────────────────────────────
function FinancialSummary({ snapshot, isLoading, settings }: Readonly<{
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: ReturnType<typeof useCompanyFormatters>;
}>) {
  const { money } = settings;
  const items = [
    { label: 'المفوتر',    value: snapshot?.financial.rentDue,      color: 'text-foreground' },
    { label: 'المحصّل',    value: snapshot?.financial.collectedRent, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'المتبقي',    value: snapshot?.financial.outstandingRent, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'المحصل بعد المصروفات', value: snapshot?.financial.netPosition,  color: 'text-primary' },
  ];

  return (
    <Card className="rounded-3xl border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold">النظرة المالية للشهر</CardTitle>
          <Link to="/financials">
            <Button variant="secondary" className="h-7 rounded-xl text-xs px-3 gap-1">
              <WalletCards className="size-3" /> المالية
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {items.map((item) => (
              <div key={item.label} className="rounded-2xl bg-muted/60 p-3">
                <p className="text-[11px] font-bold text-muted-foreground">{item.label}</p>
                <p className={cn('mt-1.5 text-base font-black tabular-nums leading-none', item.color)} dir="ltr">
                  {money(item.value ?? 0)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Error State ───────────────────────────────────────────────────────────────
function DashboardErrorCard({ onRetry, error }: Readonly<{ onRetry: () => void; error: unknown }>) {
  return (
    <div className="space-y-3">
      <DataErrorScreen title="تعذر تحميل بيانات لوحة التحكم" fallbackMessage="راجع الاتصال وصلاحيات الوصول ثم أعد المحاولة." error={error} />
      <Button type="button" variant="secondary" onClick={onRetry} className="rounded-2xl">إعادة المحاولة</Button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const now = useMemo(() => new Date(), []);
  const settings = useCompanyFormatters();
  const today = toDateInputValue(now);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard-snapshot', now.getMonth() + 1, now.getFullYear(), today],
    queryFn: () => getDashboardSnapshot(now),
  });
  const retryDashboard = useCallback(() => { dashboardQuery.refetch().catch(() => undefined); }, [dashboardQuery]);

  const snapshot = dashboardQuery.data;
  const expiringContracts = useMemo(() => buildExpiringContracts(snapshot?.activeContracts, now), [snapshot?.activeContracts, now]);
  const overdueTenantRows = useMemo(() => buildOverdueTenantRows(snapshot?.arrears.overdueInvoices), [snapshot?.arrears.overdueInvoices]);
  const buckets = useMemo(() => arrearsBucketOrder.map((key) => ({
    label: arrearsBucketLabels[key],
    total: snapshot?.arrears.agedReceivables.buckets[key]?.total ?? 0,
    invoiceCount: snapshot?.arrears.agedReceivables.buckets[key]?.invoiceCount ?? 0,
  })), [snapshot?.arrears.agedReceivables.buckets]);

  return (
    <div className="space-y-5 pb-6">
      {/* Hero */}
      <HeroBanner snapshot={snapshot} isLoading={dashboardQuery.isLoading} settings={settings} today={today} />

      {/* Error */}
      {dashboardQuery.isError && <DashboardErrorCard onRetry={retryDashboard} error={dashboardQuery.error} />}

      {/* KPIs */}
      <KpiGrid snapshot={snapshot} isLoading={dashboardQuery.isLoading} settings={settings} />

      {/* Quick actions */}
      <QuickActions />

      {/* Two-column on lg: expiring contracts + overdue */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ExpiringContractsSection rows={expiringContracts} isLoading={dashboardQuery.isLoading} settings={settings} />
        <OverdueSection rows={overdueTenantRows} isLoading={dashboardQuery.isLoading} settings={settings} />
      </div>

      {/* Financial summary */}
      <FinancialSummary snapshot={snapshot} isLoading={dashboardQuery.isLoading} settings={settings} />

      {/* Arrears breakdown */}
      {!dashboardQuery.isLoading && (snapshot?.arrears.totalOverdue ?? 0) > 0 && (
        <Card className="rounded-3xl border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">أعمار الذمم</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {buckets.map((bucket) => (
              <div key={bucket.label} className="flex items-center justify-between rounded-2xl bg-muted/60 px-3.5 py-3">
                <span className="text-xs font-bold text-muted-foreground">{bucket.label}</span>
                <div className="flex items-center gap-3 text-xs font-black">
                  <span className="text-muted-foreground">{bucket.invoiceCount} فاتورة</span>
                  <span dir="ltr">{settings.money(bucket.total)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export type DashboardSummaryCard = {
  title: string;
  value: string | number;
  isMoney: boolean;
};

export function buildDashboardSummaryCards(
  snapshot: DashboardSnapshot | undefined,
  settings: ReturnType<typeof useCompanyFormatters>,
  _hasError = false,
): DashboardSummaryCard[] {
  const { money } = settings;
  const fin = snapshot?.financial;
  const op = snapshot?.operational;
  return [
    { title: 'الإيجار المستحق',     value: money(fin?.rentDue ?? 0),        isMoney: true  },
    { title: 'المحصل هذا الشهر',    value: money(fin?.collectedRent ?? 0),   isMoney: true  },
    { title: 'الرصيد المتبقي',      value: money(fin?.outstandingRent ?? 0), isMoney: true  },
    { title: 'المصروفات',           value: money(fin?.expenses ?? 0),        isMoney: true  },
    { title: 'المحصل بعد المصروفات', value: money(fin?.netPosition ?? 0),     isMoney: true  },
    { title: 'الإشغال',             value: `${op?.occupancyRate ?? 0}%`,               isMoney: false },
    { title: 'تنتهي خلال 30 يوم',   value: op?.expiringContracts30Days ?? 0,           isMoney: false },
  ];
}
