import type { ReactNode } from "react";
import { PageLayout } from "./page-layout";
import { PageHeader } from "./page-header";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";

interface ListPageProps {
  title: string;
  description?: string;
  action?: ReactNode;
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  filters?: ReactNode;
  children: ReactNode;
  className?: string;
  dir?: "rtl" | "ltr";
}

/**
 * Full list-page scaffold: PageLayout + PageHeader + SearchInput + filter slot + content.
 * Use this as the top-level wrapper for every CRUD list page instead of
 * hand-assembling the same structure each time.
 *
 * @example
 * <ListPage
 *   title="العقارات"
 *   description="إدارة جميع العقارات"
 *   action={<Button onClick={open}><Plus /> إضافة</Button>}
 *   search={{ value: q, onChange: setQ, placeholder: "ابحث عن عقار..." }}
 *   filters={<FilterTabs options={statusOptions} value={filter} onChange={setFilter} />}
 * >
 *   <PropertyList items={filtered} />
 * </ListPage>
 */
export function ListPage({
  title,
  description,
  action,
  search,
  filters,
  children,
  className,
  dir,
}: ListPageProps) {
  return (
    <PageLayout className={className} dir={dir}>
      <PageHeader title={title} description={description} action={action} />

      {(search || filters) && (
        <div className="space-y-2">
          {search && (
            <SearchInput
              value={search.value}
              onChange={search.onChange}
              placeholder={search.placeholder}
            />
          )}
          {filters && <div>{filters}</div>}
        </div>
      )}

      <div className={cn("space-y-2.5")}>{children}</div>
    </PageLayout>
  );
}
