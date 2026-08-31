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
  /** Active filter chips shown once under the toolbar, each removable. */
  activeFilters?: readonly ActiveFilterItem[];
  onClearAllFilters?: () => void;
  /** Optional compact utilities such as view, columns, export, or sort controls. */
  toolbarActions?: ReactNode;
  /** Optional stable storage key shared by the page toolbar and its register. */
  viewModeStorageKey?: string;
  children: ReactNode;
  className?: string;
  dir?: 'rtl' | 'ltr';
  /**
   * When true, skip the page shell (layout + header) so this list can be
   * embedded inside a hub that already supplies them. Actions still render
   * via EmbeddableWorkspace's action rail.
   */
  embedded?: boolean;
  /** Scoped visual system for approved operational workspaces only. */
  visualVariant?: 'malek-pro';
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
  activeFilters,
  onClearAllFilters,
  toolbarActions,
  viewModeStorageKey,
  children,
  className,
  dir,
  embedded = false,
  visualVariant,
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
      visualVariant={visualVariant}
      viewModeStorageKey={viewModeStorageKey}
    >
        <FilterBar
          searchValue={search?.value}
          onSearchChange={search?.onChange}
          searchPlaceholder={search?.placeholder}
          searchAriaLabel={`بحث في ${title}`}
          filters={filters}
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
