export interface WorkspaceSubNavProps {
  rootPath: string;
  className?: string;
}

/**
 * @deprecated REMOVED (IA simplification 2026-08).
 *
 * WorkspaceSubNav previously duplicated the hub `SectionTabs` secondary
 * navigation (rendering a second horizontal tab row on top of SectionTabs).
 * That created the Sidebar → Workspace page → Workspace SubNav → Section Tabs
 * excessive drilling described in the navigation audit.
 *
 * - No hub workspace imports this component any longer; all hubs use the
 *   single `SectionTabs` secondary navigation (one layer only).
 * - Kept as a no-op stub for backward compatibility of external imports and
 *   to avoid breaking legacy branch merges. Returns null.
 * - Will be deleted entirely after migration verification.
 *
 * Do not reintroduce duplicate secondary navigation — use `SectionTabs` as
 * the single contextual secondary nav per workspace.
 */
export function WorkspaceSubNav(_props: WorkspaceSubNavProps) {
  return null;
}
