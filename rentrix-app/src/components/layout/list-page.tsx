import type { ReactNode } from 'react';
import { SearchInput } from '@/components/ui/search-input';
import { cn } from '@/lib/utils';
import { PageHeader } from './page-header';
import { PageLayout } from './page-layout';

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
}: ListPageProps) {
  const hasSearchAndFilters = Boolean(search && filters);

  return (
    <PageLayout className={className} dir={dir}>
      <PageHeader
        title={title}
        description={description}
        count={count}
        action={action}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
        backTo={backTo}
        backLabel={backLabel}
      />

      {search || filters ? (
        <section
          data-list-controls
          aria-label="البحث والتصفية"
          className="rounded-2xl border border-border/70 bg-card p-2.5 shadow-[0_6px_20px_hsl(var(--foreground)/0.035)] sm:p-3"
        >
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
        </section>
      ) : null}

      <div data-list-results className="space-y-2.5 sm:space-y-3">
        {children}
      </div>
    </PageLayout>
  );
}
