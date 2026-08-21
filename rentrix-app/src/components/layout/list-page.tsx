import type { ReactNode } from 'react';
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
  /** Optional compact desktop utilities such as columns, export, or sort. */
  toolbarActions?: ReactNode;
  mobileFilterCount?: number;
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
 * Canonical MALEK entity-page scaffold: action → one toolbar → records.
 * Filters collapse into the shared mobile sheet instead of becoming a second
 * row of clipped controls; desktop table utilities stay desktop-only.
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
  toolbarActions,
  mobileFilterCount,
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
          filters={filters}
          actions={toolbarActions}
          mobileFilterCount={mobileFilterCount}
          mobileFilterTitle={`تصفية ${title}`}
        />
      ) : null}

      <div data-list-results className="space-y-2.5 sm:space-y-3">
        {children}
      </div>
    </EmbeddableWorkspace>
  );
}
