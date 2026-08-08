import { Link } from '@tanstack/react-router';
import { Building2, Landmark, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { canAccess } from '@/features/auth/permissions';
import { FinancialReportsPreviewSection } from './components/financial-reports-preview-section';
import { getTodayLocalDateString } from './financials-date-utils';
import { useCollectionSummaryReport } from './reports/useFinancialReports';

function getCurrentMonthReportRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    dateFrom: getTodayLocalDateString(firstDay),
    dateTo: getTodayLocalDateString(lastDay),
    status: 'all' as const,
  };
}

/**
 * One primary Finance surface. Detailed operational routes remain internal
 * drill-downs so the sidebar no longer behaves like a list of database tables.
 */
export function FinancialsPage() {
  const { authorization } = useAuth();
  const reportFilters = useMemo(() => getCurrentMonthReportRange(), []);
  const collectionReport = useCollectionSummaryReport(reportFilters);

  const destinations = [
    {
      to: '/finance/collections' as const,
      title: 'التحصيل والفواتير',
      description: 'الفواتير والإيصالات وتسجيل التحصيل اليومي.',
      icon: ReceiptText,
      visible: true,
    },
    {
      to: '/finance/expenses' as const,
      title: 'المصروفات والمتأخرات',
      description: 'المصروفات ومتابعة الذمم والمتأخرات.',
      icon: WalletCards,
      visible: canAccess(authorization, 'expenses.view'),
    },
    {
      to: '/finance/deposits' as const,
      title: 'التأمينات وتسويات الملاك',
      description: 'التأمينات، التسويات، والمبالغ المستحقة للملاك.',
      icon: ShieldCheck,
      visible: canAccess(authorization, 'financial.deposits.view'),
    },
    {
      to: '/finance/banking' as const,
      title: 'البنوك والعمولات',
      description: 'المطابقة البنكية وعمولات المكتب.',
      icon: Landmark,
      visible: canAccess(authorization, 'financial.bank_reconciliation.view'),
    },
  ].filter((destination) => destination.visible);

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
      <div data-finance-root className="space-y-5">
        <PageHeader
          title="المالية"
          description="كل العمليات المالية اليومية من مدخل واحد؛ التفاصيل تظهر فقط عند الحاجة."
        />

        <section aria-label="الوصول السريع للعمليات المالية" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {destinations.map(({ to, title, description, icon: Icon }) => (
            <Link key={to} to={to} className="group block min-w-0 outline-none focus-visible:rounded-2xl focus-visible:ring-4 focus-visible:ring-primary/20">
              <Card className="h-full border-border/80 transition-colors group-hover:border-primary/35 group-hover:bg-primary/[0.025]">
                <CardContent className="flex h-full min-h-36 flex-col gap-3 p-4">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black">{title}</h2>
                    <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">{description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        <section data-finance-section aria-label="ملخص التحصيل الشهري" className="space-y-3">
          <FinancialReportsPreviewSection
            reportFilters={reportFilters}
            collectionSummary={collectionReport.data}
            isLoading={collectionReport.isLoading}
            isError={collectionReport.isError}
            error={collectionReport.error}
          />
        </section>

        <Link
          to="/reports"
          className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3 font-bold outline-none transition-colors hover:border-primary/30 hover:bg-primary/[0.025] focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm">المحاسبة والتقارير</span>
            <span className="mt-0.5 block text-xs font-medium text-muted-foreground">دفتر الأستاذ والكشوف والتحليلات والتقارير الرسمية.</span>
          </span>
        </Link>
      </div>
    </PageLayout>
  );
}

export default FinancialsPage;
