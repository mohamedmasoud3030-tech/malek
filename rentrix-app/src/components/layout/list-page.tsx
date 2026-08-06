import type { ReactNode } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { cn } from '@/lib/utils';
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
 * Full list-page scaffold: PageLayout + PageHeader + a shared control surface + content.
 * Mobile keeps search before filters for fast thumb access; desktop places filters at the
 * logical start and search beside them to reduce vertical depth.
 *
 * @example
 * <ListPage
 *   title="العقارات"
 *   description="إدارة جميع العقارات"
 *   action={<Button onClick={open}><Plus /> إضافة</Button>}
 *   search={{ value: query, onChange: setQuery, placeholder: 'ابحث عن عقار...' }}
 *   filters={<FilterTabs options={statusOptions} value={filter} onChange={setFilter} />}
 * >
 *   <PropertyList items={filtered} />
 * </ListPage>
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
  children,
  className,
  dir,
  embedded = false,
  visualVariant,
}: ListPageProps) {
  const hasSearchAndFilters = Boolean(search && filters);
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
      {search || filters ? (
        <ListControlSurface>
          <div
            className={cn(
              'grid min-w-0 gap-2.5',
              hasSearchAndFilters && 'lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)] lg:items-center lg:gap-3',
            )}
          >
            {search ? (
              <SearchInput
                value={search.value}
                onChange={search.onChange}
                placeholder={search.placeholder}
                className={cn('w-full', hasSearchAndFilters && 'lg:order-2')}
              />
            ) : null}
            {filters ? (
              <div className={cn('min-w-0', hasSearchAndFilters && 'lg:order-1')}>{filters}</div>
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
