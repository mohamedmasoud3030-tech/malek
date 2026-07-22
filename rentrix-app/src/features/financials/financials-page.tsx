import { Link } from '@tanstack/react-router';
import { ChevronLeft, ClipboardList, FileCheck, FileText, HandCoins, Landmark, ReceiptText, WalletCards } from 'lucide-react';
import { useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth } from '@/hooks/use-auth';
import { canShowNavigationItem, type AppPermission } from '@/features/auth/permissions';
import { PageLayout } from '@/components/layout/page-layout';
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

// Each daily-money workflow lives in its own standalone page (and sidebar
// entry). The hub no longer embeds duplicate workspaces — it is a summary
// screen plus a directory into the dedicated workspaces.
const financialWorkspaces = [
  ['/invoices', 'الفواتير والتحصيل', 'مراجعة وتسجيل دفعات الفواتير', FileText, undefined],
  ['/receipts', 'السدادات والإيصالات', 'سجل الإيصالات وطباعة سندات القبض', ReceiptText, undefined],
  ['/expenses', 'المصروفات التشغيلية', 'تسجيل ومراجعة نفقات العقارات', WalletCards, 'expenses.write'],
  ['/arrears', 'جدول المتأخرات والديون', 'متابعة الذمم وأعمار الديون', ClipboardList, 'arrears.view'],
  ['/deposits', 'تأمين وأمانات المستأجرين', 'تتبع مبالغ أمانات وعقود التأمين', FileCheck, undefined],
  ['/owner-settlements', 'تسويات الملاك', 'إعداد واعتماد وصرف تسويات أصحاب العقارات', HandCoins, 'financial.owner_settlements.approve'],
  ['/bank-reconciliation', 'مطابقة كشف البنك', 'مطابقة السجلات مع الحسابات البنكية', Landmark, 'financial.bank_reconciliation.view'],
] as const satisfies readonly (readonly [string, string, string, typeof FileText, AppPermission | undefined])[];

export function FinancialsPage() {
  const { authorization } = useAuth();
  const reportFilters = useMemo(() => getCurrentMonthReportRange(), []);
  const collectionReport = useCollectionSummaryReport(reportFilters);
  // Mirror the sidebar: only surface workspace cards the user can actually open.
  const visibleWorkspaces = financialWorkspaces.filter(([, , , , permission]) =>
    canShowNavigationItem(authorization, permission),
  );

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="الملخص المالي"
        description="نظرة شاملة على التحصيلات والذمم خلال الشهر الحالي، مع انتقال مباشر إلى مساحات العمل المتخصصة لكل عملية مالية."
      />

      <FinancialReportsPreviewSection
        reportFilters={reportFilters}
        collectionSummary={collectionReport.data}
        isLoading={collectionReport.isLoading}
        isError={collectionReport.isError}
        error={collectionReport.error}
      />

      <section aria-label="مساحات العمل المالية" className="space-y-3">
        <div>
          <h2 className="text-base font-bold">مساحات العمل المالية</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            كل عملية يومية لها صفحتها المستقلة — اختر القسم للمتابعة.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibleWorkspaces.map(([to, label, description, Icon]) => (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className="group flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-right transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{label}</span>
                <span className="block truncate text-[11px] font-medium text-muted-foreground">{description}</span>
              </span>
              <ChevronLeft className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:-translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}

export default FinancialsPage;
