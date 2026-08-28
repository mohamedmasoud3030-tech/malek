import { useCallback } from 'react';
import { SectionTabs } from '@/components/ui/section-tabs';
import { reportSections, type ReportSectionId } from '../reports-page.sections';
import { getReportSubViewLabel, getVisibleReportSubViews, type ReportViewId } from '../report-view-registry';

type ReportsSectionTabsProps = Readonly<{
  activeSection: ReportSectionId;
  activeView: ReportViewId;
  onSectionChange: (section: ReportSectionId) => void;
  onSectionViewChange: (section: ReportSectionId, view: ReportViewId) => void;
}>;

/**
 * Compact owner-facing navigation. Raw accounting remains available to
 * authorized/internal deep links, but it is intentionally not a primary tab.
 */
export function ReportsSectionTabs({
  activeSection,
  activeView,
  onSectionChange,
  onSectionViewChange,
}: ReportsSectionTabsProps) {
  const ownerFacingSections = reportSections.filter((section) => section.id !== 'accounting');
  const activeSectionMeta = reportSections.find((section) => section.id === activeSection) ?? reportSections[0];
  const ActiveSectionIcon = activeSectionMeta.icon;
  const visibleSubViews = activeSection === 'accounting' ? [] : getVisibleReportSubViews(activeSection);
  const activeViewIsRoutine = !activeView || visibleSubViews.some((view) => view.id === activeView);
  const activeSpecialistLabel = activeViewIsRoutine ? null : getReportSubViewLabel(activeSection, activeView);
  const panelId = `section-panel-${activeSection}`;

  const handleViewChange = useCallback(
    (viewId: string) => {
      onSectionViewChange(activeSection, viewId as ReportViewId);
    },
    [activeSection, onSectionViewChange],
  );

  return (
    <section
      className="min-w-0 rounded-2xl border border-border/70 bg-card p-2.5 shadow-card sm:p-3"
      aria-label="التنقل بين تقارير الأداء والكشوف"
      data-finance-card
    >
      <div className="grid min-w-0 gap-2.5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)] lg:items-center">
        <SectionTabs
          items={ownerFacingSections}
          activeId={activeSection}
          onChange={onSectionChange}
          ariaLabel="أقسام مركز التقارير"
          compactMobile
        />

        {visibleSubViews.length > 0 && activeViewIsRoutine ? (
          <SectionTabs
            items={visibleSubViews}
            activeId={activeView || visibleSubViews[0].id}
            onChange={handleViewChange}
            ariaLabel="تقارير المتابعة"
            panelId={panelId}
            compactMobile
          />
        ) : (
          <div className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-border/55 bg-muted/20 px-3 text-xs font-bold text-muted-foreground">
            <ActiveSectionIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">
              {activeSpecialistLabel ? `تقرير من المكتبة · ${activeSpecialistLabel}` : activeSectionMeta.label}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 flex min-w-0 items-center gap-2 px-1">
        <ActiveSectionIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="min-w-0 truncate text-[11px] font-semibold text-muted-foreground sm:text-xs">
          {activeSectionMeta.description}
        </p>
      </div>
    </section>
  );
}

export type { ReportsSectionTabsProps };
