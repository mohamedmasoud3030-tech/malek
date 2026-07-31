import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { ReportsWorkspace } from './components/ReportsWorkspace';
import { getCurrentMonthFilters } from './reports-page.helpers';
import { useReportsWorkspace } from './use-reports-workspace';

export { escapeCsvValue } from '@/lib/csvExport';
export { buildReportCsvFilename, getTodayLocalDateString, toDateInputValue } from './reports-page.helpers';

export function ReportsPage() {
  const [filters, setFilters] = useState(() => getCurrentMonthFilters());
  const { authorization } = useAuth();
  const { language, direction } = getAppLanguageState();
  const workspace = useReportsWorkspace(filters);
  const canExportReports = canAccess(authorization, financialOperationPermissions.exportReports);
  const canViewReports = canAccess(authorization, financialOperationPermissions.exportReports);

  if (!canViewReports) {
    return <AccessDenied message="عرض التقارير المالية متاح فقط للمدير أو المسؤول." />;
  }

  return (
    <PageLayout dir={direction} size="wide" className="space-y-5 pb-8">
      <PageHeader
        title={translateSharedLabel('financialsSectionReports', language)}
        description={translateSharedLabel('reportsPageDescription', language)}
      />

      <aside
        role="note"
        className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="min-w-0">{translateSharedLabel('reportsPageHint', language)}</p>
        <Link
          to="/financials"
          className="inline-flex min-h-8 shrink-0 items-center self-start rounded-lg border border-primary/20 bg-background px-3 py-1.5 font-semibold text-primary transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:self-auto"
        >
          {translateSharedLabel('financialsSectionSummary', language)}
        </Link>
      </aside>

      <ReportsWorkspace
        model={workspace}
        filters={filters}
        canExportReports={canExportReports}
        onFiltersChange={setFilters}
        onResetCurrentMonth={() => setFilters(getCurrentMonthFilters())}
      />
    </PageLayout>
  );
}
