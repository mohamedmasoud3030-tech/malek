import type { ComponentType } from 'react';
import type { ReportSectionId } from '../reports-page.sections';
import type { ReportViewId } from '../report-view-registry';
import { REPORT_WORKSPACES, type ReportWorkspaceId } from '../report-workspaces';

export type ReportShortcut = Readonly<{
  label: string;
  description: string;
  section: ReportSectionId;
  view: ReportViewId;
}>;

export type ReportGroupId = ReportWorkspaceId;

export type ReportGroup = Readonly<{
  id: ReportGroupId;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Specialist groups render as a visually secondary section. */
  specialist: boolean;
  section: ReportSectionId;
  view: ReportViewId;
  matches: readonly ReportViewId[];
  shortcuts: readonly ReportShortcut[];
}>;

/**
 * The statements workspace has no internal sub-views — the party is chosen
 * through the global scope (owner / contract). Its three directory entries
 * are party-perspective doorways into the same single workspace, not three
 * competing report destinations.
 */
const STATEMENTS_SHORTCUTS: readonly ReportShortcut[] = [
  { label: 'كشف المالك', description: 'حركة المالك للفترة مع المستحقات والاستقطاعات والتسويات والرصيد.', section: 'statements', view: '' },
  { label: 'كشف المستأجر', description: 'الفواتير والمدفوعات والرصيد والحركة المرتبطة بالعقد.', section: 'statements', view: '' },
  { label: 'التسويات والحركة المرتبطة', description: 'عرض التسويات ضمن الكشف بدل فتح دفتر محاسبي منفصل.', section: 'statements', view: '' },
];

/**
 * Owner-facing report library, derived from the single workspace registry so
 * navigation can never drift from the approved consolidation. Every normal
 * report destination has exactly one owning workspace group: `expenses` lives
 * only under التشغيل والمصروفات and `occupancy` only under العقود والإشغال.
 */
export const reportGroups: readonly ReportGroup[] = REPORT_WORKSPACES.map((workspace) => ({
  id: workspace.id,
  title: workspace.label,
  description: workspace.description,
  icon: workspace.icon,
  specialist: workspace.specialist,
  section: workspace.defaultSection,
  view: workspace.defaultView,
  matches: workspace.legacyViews,
  shortcuts:
    workspace.id === 'statements'
      ? STATEMENTS_SHORTCUTS
      : workspace.subViews.length > 0
        ? workspace.subViews.map((subView) => ({
            label: subView.label,
            description: subView.description ?? workspace.description,
            section: workspace.defaultSection,
            view: subView.id,
          }))
        : [
            {
              label: workspace.label,
              description: workspace.description,
              section: workspace.defaultSection,
              view: workspace.defaultView,
            },
          ],
}));

/** Business (non-specialist) workspace groups — the daily report choices. */
export const businessReportGroups = reportGroups.filter((group) => !group.specialist);

/** Specialist workspace groups — accessible but visually secondary. */
export const specialistReportGroups = reportGroups.filter((group) => group.specialist);

export const REPORT_DIRECTORY_ENTRY_COUNT = reportGroups.reduce(
  (total, group) => total + group.shortcuts.length,
  0,
);

export function filterReportGroups(groups: readonly ReportGroup[], query: string): readonly ReportGroup[] {
  const normalized = normalizeArabicQuery(query);
  if (!normalized) return groups;
  return groups.filter(
    (group) =>
      normalizeArabicQuery(group.title).includes(normalized)
      || normalizeArabicQuery(group.description).includes(normalized)
      || group.shortcuts.some((shortcut) =>
        normalizeArabicQuery(`${shortcut.label} ${shortcut.description}`).includes(normalized),
      ),
  );
}

function normalizeArabicQuery(value: string): string {
  return value
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase();
}
