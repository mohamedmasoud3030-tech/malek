import type { ReactNode } from 'react';
import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmbeddableWorkspace } from './embeddable-workspace';

interface ListPageProps {
  title: string;
  description?: string;
  count?: number | string;
  action?: ReactNode;
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
  action,
  primaryAction,
  secondaryActions,
  backTo,
  backLabel,
  search,
  filters,
  activeFilters,
  onClearAllFilters,
  toolbarActions,
  children,
  className,
  dir,
  embedded = false,
  visualVariant,
}: ListPageProps) {
  const resolvedPrimary = primaryAction ?? action;

  return (
    <EmbeddableWorkspace
      embedded={embedded}
      title={title}
      description={description}
      count={count}
      primaryAction={resolvedPrimary}
      secondaryActions={secondaryActions}
      backTo={backTo}
      backLabel={backLabel}
      className={className}
      dir={dir}
      visualVariant={visualVariant}
    >
      {search || filters || toolbarActions ? (
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
      ) : null}

      <div data-list-results className="space-y-2.5 sm:space-y-3">
        {children}
      </div>
    </EmbeddableWorkspace>
  );
}
