import { reportGroups } from './directory/report-directory-groups';
import { getReportSubViewLabel } from './report-view-registry';
import type { ReportSectionId } from './reports-page.sections';
import type { ReportViewId } from './reports-section-model';

export type ActiveReportMeta = Readonly<{
  title: string;
  description: string;
}>;

/**
 * Resolve the one compact report header for the open report. Title and
 * description come from the owner-facing catalogue (task/decision language),
 * never from the internal accounting/analytics section labels.
 */
export function getActiveReportMeta(section: ReportSectionId, view: ReportViewId): ActiveReportMeta {
  const viewLabel = getReportSubViewLabel(section, view);
  const group =
    reportGroups.find((item) => item.section === section && item.matches.includes(view))
    ?? (section === 'statements' ? reportGroups.find((item) => item.id === 'owners') : undefined);

  const title = viewLabel || group?.title || 'تقرير';
  const description =
    group?.shortcuts.find((shortcut) => shortcut.section === section && shortcut.view === view)?.description
    ?? group?.description
    ?? '';

  return { title, description };
}
