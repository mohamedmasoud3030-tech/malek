import { useCallback } from 'react';
import { SectionTabs } from '@/components/ui/section-tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { getReportCategoryLabel, reportSections, type ReportSectionId } from '../reports-page.sections';
import { getReportSubViews, type ReportViewId } from '../report-view-registry';

type ReportsSectionTabsProps = Readonly<{
  activeSection: ReportSectionId;
  activeView: ReportViewId;
  onSectionChange: (section: ReportSectionId) => void;
  onSectionViewChange: (section: ReportSectionId, view: ReportViewId) => void;
}>;

/**
 * WP-C — Reports navigation surface.
 *
 * Owns the section header card, the mobile section `<select>`, the desktop
 * scrollable tab strip and the per-section view switcher. Sub-views come from
 * the report view registry, so navigation can never list a view that the panel
 * router does not render.
 *
 * The view switchers are view switchers over a single panel per section
 * (`section-panel-accounting` / `section-panel-analytics`), so `panelId` must
 * reference that real panel rather than a per-view id that does not exist
 * (axe aria-valid-attr-value).
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
    <>
      <section
        className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card"
        aria-label="أقسام التقارير"
        data-finance-card
      >
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ActiveSectionIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0" aria-live="polite">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold sm:text-lg">{activeSectionMeta.label}</h2>
                <StatusBadge tone="info">{getReportCategoryLabel(activeSectionMeta)}</StatusBadge>
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground sm:text-sm">{activeSectionMeta.description}</p>
            </div>
          </div>
        </div>

        {/* Mobile reports navigation */}
        <div className="border-b border-border/60 bg-card/95 px-3 py-3 sm:hidden" data-reports-mobile-nav>
          <label htmlFor="reports-section-select" className="sr-only">
            أقسام التقارير
          </label>
          <div className="flex items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ActiveSectionIcon className="size-4" aria-hidden="true" />
            </span>
            <select
              id="reports-section-select"
              aria-label="أقسام التقارير"
              value={activeSection}
              onChange={(event) => onSectionChange(event.target.value as ReportSectionId)}
              className="min-h-11 flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              dir="rtl"
            >
              {reportSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop reports navigation */}
        <div
          className="no-scrollbar sticky top-0 z-20 hidden overflow-x-auto border-b border-border/60 bg-card/95 px-3 pt-3 backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 sm:block sm:px-4"
          tabIndex={0}
          role="region"
          aria-label="شريط أقسام التقارير القابل للتمرير أفقياً"
        >
          <div className="min-w-0 space-y-2">
            <SectionTabs
              items={reportSections}
              activeId={activeSection}
              onChange={onSectionChange}
              ariaLabel="أقسام التقارير"
            />
          </div>
        </div>
      </section>

      {subViews.length > 0 ? (
        <div className="border-b border-border/50 pb-2">
          <SectionTabs
            items={subViews}
            activeId={activeView || subViews[0].id}
            onChange={handleViewChange}
            ariaLabel={activeSection === 'accounting' ? 'أقسام فرعية للمحاسبة' : 'أقسام فرعية للتحليلات'}
            panelId={panelId}
          />
        </div>
      ) : null}
    </>
  );
}
