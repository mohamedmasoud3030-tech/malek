/**
 * Enterprise UX Foundation (Wave 4A) — public barrel.
 *
 * Everything a module needs to assemble a standard enterprise page:
 *   - Page shells (Page / Header / Toolbar / Stats / Filters / Search)
 *   - DataTable + row/bulk actions + pagination + selection
 *   - Overlays (Drawer / Modal / ConfirmDialog) with dirty-gating
 *   - Form + section + tabs + preview + sticky footer layouts
 *   - State surfaces (Empty / Loading / Error / StatusBadge)
 *   - State hooks (useDrawer / useTableState / useFilters /
 *     usePersistentTableState / useKeyboardShortcuts)
 *   - Typed design tokens (design-tokens)
 *
 * Import from `@/components/enterprise` — never from internals.
 */

// Design tokens
export {
  spacing,
  radius,
  elevation,
  transition,
  statusTones,
  statusColors,
  semanticColors,
  breakpoints,
  mediaQueries,
  matchesBreakpoint,
  iconSizes,
  typographyPresets,
  zIndex,
  enterpriseDesignTokens,
  type SpacingToken,
  type RadiusToken,
  type ElevationToken,
  type StatusTone,
  type SemanticColorToken,
  type Breakpoint,
  type IconSize,
  type TypographyPreset,
} from './design-tokens';

// Page shell
export { EnterprisePage, type EnterprisePageProps } from './enterprise-page';
export {
  EnterpriseHeader,
  type EnterpriseHeaderProps,
  type EnterpriseBreadcrumb,
} from './enterprise-header';
export { EnterpriseToolbar, type EnterpriseToolbarProps } from './enterprise-toolbar';
export {
  EnterpriseStats,
  type EnterpriseStatsProps,
  type EnterpriseStatItem,
} from './enterprise-stats';
export {
  EnterpriseFilters,
  type EnterpriseFiltersProps,
  type EnterpriseFilterField,
  type EnterpriseFilterOption,
} from './enterprise-filters';
export { EnterpriseSearch, type EnterpriseSearchProps } from './enterprise-search';

// Data table
export {
  EnterpriseDataTable,
  type EnterpriseDataTableProps,
  type EnterpriseColumnDef,
  type EnterpriseTablePagination,
} from './enterprise-data-table';
export {
  EnterpriseBulkActions,
  type EnterpriseBulkActionsProps,
  type EnterpriseBulkAction,
} from './enterprise-bulk-actions';
export {
  EnterpriseRowActions,
  type EnterpriseRowActionsProps,
  type EnterpriseRowActionItem,
} from './enterprise-row-actions';

// Overlays
export {
  EnterpriseDrawer,
  type EnterpriseDrawerProps,
  type EnterpriseDrawerAction,
  type EnterpriseDrawerWidth,
  enterpriseDrawerModeLabels,
} from './enterprise-drawer';
export {
  EnterpriseModal,
  type EnterpriseModalProps,
  type EnterpriseModalSize,
} from './enterprise-modal';
export {
  EnterpriseConfirmDialog,
  type EnterpriseConfirmDialogProps,
} from './enterprise-confirm-dialog';

// Form + layout
export {
  EnterpriseForm,
  type EnterpriseFormProps,
  type EnterpriseFormSection,
  type EnterpriseFormTab,
  type EnterpriseFormError,
} from './enterprise-form';
export { EnterpriseSection, type EnterpriseSectionProps } from './enterprise-section';
export { EnterpriseCard, type EnterpriseCardProps } from './enterprise-card';
export { EnterpriseTabs, type EnterpriseTabsProps, type EnterpriseTab } from './enterprise-tabs';
export {
  EnterpriseSidebarSection,
  type EnterpriseSidebarSectionProps,
  type EnterpriseSidebarItem,
} from './enterprise-sidebar-section';
export {
  EnterpriseStickyFooter,
  type EnterpriseStickyFooterProps,
} from './enterprise-sticky-footer';
export {
  EnterprisePreviewPanel,
  type EnterprisePreviewPanelProps,
  type EnterprisePreviewSection,
  type EnterprisePreviewField,
} from './enterprise-preview-panel';

// State surfaces
export {
  EnterpriseEmptyState,
  type EnterpriseEmptyStateProps,
  type EnterpriseEmptyTone,
} from './enterprise-empty-state';
export {
  EnterpriseLoadingState,
  type EnterpriseLoadingStateProps,
  type EnterpriseLoadingContext,
} from './enterprise-loading-state';
export {
  EnterpriseErrorState,
  type EnterpriseErrorStateProps,
} from './enterprise-error-state';
export {
  EnterpriseStatusBadge,
  type EnterpriseStatusBadgeProps,
  type EnterpriseStatusVisual,
} from './enterprise-status-badge';

// Hooks
export { useDrawer, type UseDrawerResult, type EnterpriseDrawerMode } from './hooks/use-drawer';
export {
  useTableState,
  type UseTableStateOptions,
  type UseTableStateResult,
  type EnterpriseSortState,
  type EnterpriseSortDirection,
} from './hooks/use-table-state';
export {
  useFilters,
  type UseFiltersResult,
  type FilterValues,
} from './hooks/use-filters';
export { usePersistentTableState } from './hooks/use-persistent-table-state';
export {
  useKeyboardShortcuts,
  formatShortcutLabel,
  type EnterpriseShortcut,
} from './hooks/use-keyboard-shortcuts';
export { useUnsavedDismiss, type UseUnsavedDismissResult } from './hooks/use-unsaved-dismiss';

// Drawer-mode union lives with useDrawer; re-exported here for parity with the hook.
export { enterpriseDrawerModes } from './hooks/use-drawer';
