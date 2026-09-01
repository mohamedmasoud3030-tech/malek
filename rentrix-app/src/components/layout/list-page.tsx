import type { ReactNode } from 'react';
import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmbeddableWorkspace } from './embeddable-workspace';

interface ListPageProps {
  title: string;
  description?: string;
  count?: number | string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  backTo?: string;
  backLabel?: string;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  filters?: ReactNode;
  advancedFilters?: ReactNode;
  advancedFilterTitle?: string;
  advancedFilterDescription?: string;
  /** Active filter chips shown once under the toolbar, each removable. */
  activeFilters?: readonly ActiveFilterItem[];
  onClearAllFilters?: () => void;
  /** Optional compact utilities such as view, columns, export, or sort controls. */
  toolbarActions?: ReactNode;
  /** Optional stable storage key shared by the page toolbar and its register. */
  viewModeStorageKey?: string;
  /** Optional stable data hook for this list when mounted inside a hub. */
  workspaceName?: string;
  children: ReactNode;
  className?: string;
  dir?: 'rtl' | 'ltr';
  /**
   * When true, skip the page shell (layout + header) so this list can be
   * embedded inside a hub that already supplies them. Actions still render
   * via EmbeddableWorkspace's action rail.
   */
  embedded?: boolean;
}

/**
 * Canonical MALEK list-page scaffold.
 *
 * Search and filters are deliberately delegated to FilterBar so list pages do
 * not grow a second toolbar/search system. Pages provide values and controls;
 * FilterBar owns responsive composition, spacing and mobile behavior.
 */
export function ListPage({
  title,
  description,
  count,
  primaryAction,
  secondaryActions,
  backTo,
  backLabel,
  search,
  filters,
  advancedFilters,
  advancedFilterTitle,
  advancedFilterDescription,
  activeFilters,
  onClearAllFilters,
  toolbarActions,
  viewModeStorageKey,
  workspaceName,
  children,
  className,
  dir,
  embedded = false,
}: ListPageProps) {
  return (
    <EmbeddableWorkspace
      embedded={embedded}
      title={title}
      description={description}
      count={count}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
      backTo={backTo}
      backLabel={backLabel}
      className={className}
      dir={dir}
      viewModeStorageKey={viewModeStorageKey}
      workspaceName={workspaceName}
    >
      <FilterBar
        searchValue={search?.value}
        onSearchChange={search?.onChange}
        searchPlaceholder={search?.placeholder}
        searchAriaLabel={`بحث في ${title}`}
        filters={filters}
        advancedFilters={advancedFilters}
        advancedFilterTitle={advancedFilterTitle}
        advancedFilterDescription={advancedFilterDescription}
        activeFilters={activeFilters}
        onClearAllFilters={onClearAllFilters}
        actions={toolbarActions}
      />

      <div data-list-results className="space-y-2.5 sm:space-y-3">
        {children}
      </div>
    </EmbeddableWorkspace>
  );
}
