import { useCallback } from 'react';
import { SectionTabs } from '@/components/ui/section-tabs';
import { reportSections, type ReportSectionId } from '../reports-page.sections';
import { getReportSubViews, type ReportViewId } from '../report-view-registry';

type ReportsSectionTabsProps = Readonly<{
  activeSection: ReportSectionId;
  activeView: ReportViewId;
  onSectionChange: (section: ReportSectionId) => void;
  onSectionViewChange: (section: ReportSectionId, view: ReportViewId) => void;
}>;

/**
 * Compact two-level report navigation.
 *
 * The previous surface repeated the active section as a header card, a mobile
 * select and a desktop tab strip before rendering the sub-view tabs. This keeps
 * the same registry-driven navigation in one compact control so the report
 * itself reaches the viewport much earlier on mobile.
 */
export function ReportsSectionTabs({
  activeSection,
  activeView,
  onSectionChange,
  onSectionViewChange,
}: ReportsSectionTabsProps) {
  const activeSectionMeta = reportSections.find((section) => section.id === activeSection) ?? reportSections[0];
  const ActiveSectionIcon = activeSectionMeta.icon;
  const subViews = getReportSubViews(activeSection);
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
      aria-label="التنقل بين المحاسبة والتقارير"
      data-finance-card
    >
      <div className="grid min-w-0 gap-2.5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)] lg:items-center">
        <SectionTabs
          items={reportSections}
          activeId={activeSection}
          onChange={onSectionChange}
          ariaLabel="أقسام التقارير"
          compactMobile
        />

        {subViews.length > 0 ? (
          <SectionTabs
            items={subViews}
            activeId={activeView || subViews[0].id}
            onChange={handleViewChange}
            ariaLabel={activeSection === 'accounting' ? 'مساحات المحاسبة' : 'مساحات التحليلات'}
            panelId={panelId}
            compactMobile
          />
        ) : (
          <div className="flex min-h-11 items-center gap-2 rounded-lg border border-border/55 bg-muted/20 px-3 text-xs font-bold text-muted-foreground">
            <ActiveSectionIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{activeSectionMeta.label}</span>
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
