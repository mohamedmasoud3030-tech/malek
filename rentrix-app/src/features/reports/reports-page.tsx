import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { BarChart3, BookOpenCheck, ShieldCheck, WalletCards } from 'lucide-react';
import { useCallback, useState } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { translateSharedLabel } from '@/lib/i18n';
import { ReportDirectory } from './directory/ReportDirectory';
import { getCurrentMonthFilters } from './reports-page.helpers';
import { getInitialReportsFilters } from './reports-workspace-filters';
import type { ReportSectionId } from './reports-page.sections';
import {
  REPORTS_SECTION_SEARCH_KEY,
  resolveReportLocation,
  type ReportViewId,
} from './reports-section-model';
import { ReportsWorkspace } from './workspace/ReportsWorkspace';
import { useReportsWorkspace } from './use-reports-workspace';

export { escapeCsvValue } from '@/lib/csvExport';
export { buildReportCsvFilename, getTodayLocalDateString, toDateInputValue } from './reports-page.helpers';

export function ReportsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const [filters, setFilters] = useState(() => getInitialReportsFilters(search));
  const { authorization } = useAuth();
  const canExportReports = canAccess(authorization, financialOperationPermissions.exportReports);
  const canViewReports = canAccess(authorization, financialOperationPermissions.viewReports);

  const { section: activeSection, view: activeView } = resolveReportLocation(
    search[REPORTS_SECTION_SEARCH_KEY],
    search.view,
  );
  const workspace = useReportsWorkspace(filters, { section: activeSection, view: activeView });

  const reportsLabel = translateSharedLabel('financialsSectionReports');
  const pageDescription = translateSharedLabel('reportsPageDescription');
  const pageHint = translateSharedLabel('reportsPageHint');

  const handleSectionViewChange = useCallback(
    (nextSection: ReportSectionId, nextView: ReportViewId) => {
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => {
          const next: Record<string, unknown> = {
            ...previous,
            [REPORTS_SECTION_SEARCH_KEY]: nextSection,
          };
          if (nextView) next.view = nextView;
          else delete next.view;
          return next;
        },
        replace: true,
      });
    },
    [navigate],
  );

  const handleSectionChange = useCallback(
    (nextSection: ReportSectionId) => {
      let defaultView: ReportViewId = '';
      if (nextSection === 'accounting') defaultView = 'accounting_reports';
      else if (nextSection === 'analytics') defaultView = 'overview';
      handleSectionViewChange(nextSection, defaultView);
    },
    [handleSectionViewChange],
  );

  if (!canViewReports) {
    return <AccessDenied message="عرض المحاسبة والتقارير متاح فقط للصلاحيات المالية المخولة." />;
  }

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro" className="pb-8">
      <div data-finance-root className="min-w-0 space-y-4 sm:space-y-5">
        <section
          aria-labelledby="reports-cockpit-title"
          className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-bl from-primary/[0.09] via-card to-card shadow-card"
          data-reports-cockpit
        >
          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-7 items-center rounded-full border border-primary/20 bg-primary/10 px-3 text-xs font-black text-primary">
                  المحاسبة والرقابة
                </span>
                <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 text-xs font-bold text-muted-foreground">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  مصدر الحقيقة المحاسبية
                </span>
              </div>

              <h1 id="reports-cockpit-title" className="mt-3 text-balance text-2xl font-black leading-9 sm:text-3xl">
                من الرقم إلى القرار بدون تشتيت
              </h1>
              <p className="mt-1.5 max-w-3xl text-sm font-semibold leading-6 text-muted-foreground">
                {pageDescription || 'دفتر الأستاذ والكشوف والتحليلات في مساحة واحدة مبنية فوق المصادر المحاسبية والمالية المعتمدة.'}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" asChild className="min-h-11">
                  <Link to="/financials">
                    <WalletCards className="me-2 size-4" aria-hidden="true" />
                    العمليات المالية اليومية
                  </Link>
                </Button>
                <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border/70 bg-background/65 px-3 text-xs font-black text-muted-foreground">
                  <BookOpenCheck className="size-4 text-primary" aria-hidden="true" />
                  كشف {reportsLabel}
                </span>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/60 bg-background/65 p-3 backdrop-blur-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <BookOpenCheck className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black">محاسبة</p>
                  <p className="truncate text-[11px] font-bold text-muted-foreground">ميزان · أرباح وخسائر · مركز مالي</p>
                </div>
              </div>
              <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/60 bg-background/65 p-3 backdrop-blur-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <BarChart3 className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black">تحليلات</p>
                  <p className="truncate text-[11px] font-bold text-muted-foreground">تحصيل · إشغال · متأخرات · مصروفات</p>
                </div>
              </div>
              <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/60 bg-background/65 p-3 backdrop-blur-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black">رقابة</p>
                  <p className="truncate text-[11px] font-bold text-muted-foreground">صلاحيات وفلاتر وروابط قابلة للحفظ</p>
                </div>
              </div>
            </div>
          </div>

          {pageHint ? (
            <div className="border-t border-primary/10 bg-background/35 px-4 py-2.5 text-xs font-bold leading-5 text-muted-foreground sm:px-5">
              {pageHint}
            </div>
          ) : null}
        </section>

        <ReportDirectory
          activeSection={activeSection}
          activeView={activeView}
          scope={{ ownerId: filters.ownerId, tenantId: filters.tenantId, contractId: filters.contractId }}
          onOpen={handleSectionViewChange}
        />

        <section
          data-finance-section
          aria-label="مساحة المحاسبة والتقارير"
          className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card"
        >
          <header className="flex flex-col gap-1 border-b border-border/60 bg-muted/15 px-3 py-3 sm:px-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-black text-primary">التقرير المفتوح</p>
                <h2 className="mt-0.5 text-base font-black">مساحة التحليل والمراجعة</h2>
              </div>
              <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-bold text-muted-foreground">
                {canExportReports ? 'العرض والتصدير متاحان' : 'العرض فقط'}
              </span>
            </div>
          </header>
          <div className="min-w-0 p-3 sm:p-4">
            <ReportsWorkspace
              model={workspace}
              filters={filters}
              canExportReports={canExportReports}
              activeSection={activeSection}
              activeView={activeView}
              onSectionChange={handleSectionChange}
              onSectionViewChange={handleSectionViewChange}
              onFiltersChange={setFilters}
              onResetCurrentMonth={() => setFilters((current) => ({
                ...current,
                ...getCurrentMonthFilters(),
              }))}
            />
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
