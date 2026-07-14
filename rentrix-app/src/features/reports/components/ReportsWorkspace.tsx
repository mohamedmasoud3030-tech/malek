import { useState } from 'react';
import { BarChart3, FileSpreadsheet, ReceiptText, WalletCards } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { SectionTabPanel, SectionTabs } from '@/components/ui/section-tabs';
import { getErrorMessage } from '@/features/financials/components/financials-formatters';
import type { ReportsWorkspaceModel } from '../use-reports-workspace';
import type { FilterState } from '../reports-page.helpers';
import { reportSections, type ReportSectionId } from '../reports-page.sections';
import { AccountingReportsSection } from './AccountingReportsSection';
import { CollectionsSection } from './CollectionsSection';
import { ExpensesSection } from './ExpensesSection';
import { OccupancySection } from './OccupancySection';
import { OverdueSection } from './OverdueSection';
import { OverviewSection } from './OverviewSection';
import { ReportsFilterSurface } from './ReportsFilterSurface';
import { ReportsHero } from './ReportsHero';
import { StatementsSection } from './StatementsSection';

type ReportsWorkspaceProps = Readonly<{
  model: ReportsWorkspaceModel;
  filters: FilterState;
  canExportReports: boolean;
  onFiltersChange: (filters: FilterState) => void;
  onResetCurrentMonth: () => void;
}>;

export function ReportsWorkspace({
  model,
  filters,
  canExportReports,
  onFiltersChange,
  onResetCurrentMonth,
}: ReportsWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<ReportSectionId>('overview');
  const activeSectionLabel = reportSections.find((section) => section.id === activeSection)?.label ?? 'التقارير';

  return (
    <>
      <ReportsHero summary={model.hero.summary} today={model.today} isLoading={model.hero.isLoading} />

      <ResponsiveCardGrid desktopColumns={3}>
        <ReportWorkspaceCue
          icon={<WalletCards className="size-5" aria-hidden="true" />}
          title="نطاق موحّد"
          description="الفترة ومركز التكلفة يطبقان على التقارير المالية دون تغيير طريقة الحساب."
        />
        <ReportWorkspaceCue
          icon={<ReceiptText className="size-5" aria-hidden="true" />}
          title="تحصيلات ومتأخرات"
          description="التحصيلات من مصدر payments الحالي والمتأخرات من تقارير الذمم الحالية."
        />
        <ReportWorkspaceCue
          icon={<FileSpreadsheet className="size-5" aria-hidden="true" />}
          title="تصدير وقراءة فقط"
          description="أزرار CSV/PDF/Print تبقى داخل كل قسم ولا تنشئ أي بيانات جديدة."
        />
      </ResponsiveCardGrid>

      <ReportsFilterSurface
        filters={filters}
        costCenterRows={model.filters.costCenterRows}
        ownerRows={model.filters.ownerRows}
        contractRows={model.filters.contractRows}
        onChange={onFiltersChange}
        onResetCurrentMonth={onResetCurrentMonth}
      />

      <Card className="min-w-0 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/20 px-4 py-4 sm:px-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <BarChart3 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-black sm:text-base">مركز التقارير</h2>
            <p className="mt-1 text-xs font-bold leading-5 text-muted-foreground">
              القسم الحالي: <span aria-live="polite">{activeSectionLabel}</span>
            </p>
          </div>
        </div>

        <div className="no-scrollbar sticky top-0 z-20 overflow-x-auto border-b border-border/60 bg-background/95 px-3 py-3 backdrop-blur sm:px-5">
          <div className="min-w-max">
            <SectionTabs
              items={reportSections}
              activeId={activeSection}
              onChange={setActiveSection}
              ariaLabel="أقسام التقارير"
            />
          </div>
        </div>

        <CardContent className="min-w-0 space-y-5 p-3 sm:p-6">
          {model.firstError ? (
            <div
              className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm font-bold leading-6 text-destructive"
              role="alert"
            >
              {getErrorMessage(
                model.firstError,
                'تعذر تحميل بعض التقارير. يمكنك تحديث الصفحة أو إعادة المحاولة بأمان دون تعديل أي بيانات.',
              )}
            </div>
          ) : null}

          <SectionTabPanel id="overview" activeId={activeSection}>
            <OverviewSection {...model.sections.overview} canExportReports={canExportReports} />
          </SectionTabPanel>
          <SectionTabPanel id="collections" activeId={activeSection}>
            <CollectionsSection {...model.sections.collections} canExportReports={canExportReports} />
          </SectionTabPanel>
          <SectionTabPanel id="overdue" activeId={activeSection}>
            <OverdueSection {...model.sections.overdue} canExportReports={canExportReports} />
          </SectionTabPanel>
          <SectionTabPanel id="expenses" activeId={activeSection}>
            <ExpensesSection {...model.sections.expenses} canExportReports={canExportReports} />
          </SectionTabPanel>
          <SectionTabPanel id="occupancy" activeId={activeSection}>
            <OccupancySection {...model.sections.occupancy} />
          </SectionTabPanel>
          <SectionTabPanel id="accounting" activeId={activeSection}>
            <AccountingReportsSection {...model.sections.accounting} />
          </SectionTabPanel>
          <SectionTabPanel id="statements" activeId={activeSection}>
            <StatementsSection {...model.sections.statements} />
          </SectionTabPanel>
        </CardContent>
      </Card>
    </>
  );
}

function ReportWorkspaceCue({
  icon,
  title,
  description,
}: Readonly<{ icon: React.ReactNode; title: string; description: string }>) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">{icon}</span>
        <div className="min-w-0">
          <p className="font-black">{title}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
