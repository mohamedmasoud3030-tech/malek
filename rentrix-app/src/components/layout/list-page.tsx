import type { ReactNode } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { EmbeddableWorkspace } from './embeddable-workspace';
import { ListControlSurface } from './list-controls';

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
 * Search, filters and compact utilities share one register toolbar so data-heavy
 * screens feel like one product instead of a collection of unrelated cards.
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
        <ListControlSurface>
          <div
            data-list-toolbar
            className="flex min-w-0 flex-col gap-2.5 lg:flex-row lg:items-center"
          >
            {search ? (
              <div data-list-search className="min-w-0 flex-1 lg:max-w-xl">
                <SearchInput
                  value={search.value}
                  onChange={search.onChange}
                  placeholder={search.placeholder}
                  className="w-full"
                />
              </div>
            ) : null}

            {filters ? (
              <div
                data-list-filters
                className="min-w-0 flex-1 overflow-hidden lg:flex lg:items-center"
              >
                {filters}
              </div>
            ) : null}

            {toolbarActions ? (
              <div
                data-list-toolbar-actions
                className="flex min-w-0 shrink-0 items-center gap-1.5 overflow-x-auto no-scrollbar"
              >
                {toolbarActions}
              </div>
            ) : null}
          </div>
        </ListControlSurface>
      ) : null}

      <div data-list-results className="space-y-2.5 sm:space-y-3">
        {children}
      </div>
    </EmbeddableWorkspace>
  );
}
