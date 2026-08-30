import { BriefcaseBusiness, Edit, FolderCog, Plus, Trash2, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useDialogNavigate } from '@/app/router/background-location';
import { ActionMenu } from '@/components/ui/action-menu';
import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityCell } from '@/components/ui/entity-cell';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { RegisterHeading, RegisterMetricStrip } from '@/components/layout/register-summary';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { ListPage } from '@/components/layout/list-page';
import { useAuth } from '@/hooks/use-auth';
import { useDebounce } from '@/hooks/useDebounce';
import type { ServiceProviderListItem, ServiceProviderStatusFilter } from './service-provider-service';
import {
  useArchiveServiceProvider,
  useServiceProviderCategories,
  useServiceProviders,
  useServiceProviderSummary,
} from './use-service-providers';
import { ServiceProviderCategoriesDialog } from './components/service-provider-categories-dialog';
import { formatCount } from '@/lib/formatters';

const PAGE_SIZE = 10;


export function ServiceProvidersWorkspace({ embedded = false }: Readonly<{ embedded?: boolean }>) {
  const auth = useAuth();
  const canWrite = auth.canAccess('service_providers.write');
  const navigate = useNavigate();
  const dialogNavigate = useDialogNavigate();
  const url = useSearch({ strict: false }) as Record<string, unknown>;
  const [search, setSearch] = useState(typeof url.search === 'string' ? url.search : '');
  const [status, setStatus] = useState<ServiceProviderStatusFilter>(url.status === 'active' || url.status === 'inactive' ? url.status : 'all');
  const [categoryId, setCategoryId] = useState(typeof url.categoryId === 'string' ? url.categoryId : '');
  const [page, setPage] = useState(typeof url.page === 'number' && url.page > 0 ? url.page : 1);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<ServiceProviderListItem | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const params = useMemo(() => ({ search: debouncedSearch, status, categoryId, page, pageSize: PAGE_SIZE }), [categoryId, debouncedSearch, page, status]);
  const providersQuery = useServiceProviders(params);
  const summaryQuery = useServiceProviderSummary();
  const categoriesQuery = useServiceProviderCategories();
  const archiveMutation = useArchiveServiceProvider();

  useEffect(() => {
    if (embedded) return;
    void navigate({
      to: '/service-providers',
      replace: true,
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        search: debouncedSearch || undefined,
        status: status === 'all' ? undefined : status,
        categoryId: categoryId || undefined,
        page: page === 1 ? undefined : page,
      }),
    });
  }, [categoryId, debouncedSearch, embedded, navigate, page, status]);

  const rows = providersQuery.data?.rows ?? [];
  const total = providersQuery.data?.count ?? 0;
  const categories = categoriesQuery.data ?? [];
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const hasFilters = Boolean(search.trim()) || status !== 'all' || Boolean(categoryId);
  const activeFilters: ActiveFilterItem[] = [
    ...(search.trim() ? [{ key: 'search', label: 'بحث', value: search.trim(), onRemove: () => { setSearch(''); setPage(1); } }] : []),
    ...(status !== 'all' ? [{ key: 'status', label: 'الحالة', value: status === 'active' ? 'نشط' : 'غير نشط', onRemove: () => { setStatus('all'); setPage(1); } }] : []),
    ...(selectedCategory ? [{ key: 'category', label: 'نوع الخدمة', value: selectedCategory.name, onRemove: () => { setCategoryId(''); setPage(1); } }] : []),
  ];
  const clearFilters = () => { setSearch(''); setStatus('all'); setCategoryId(''); setPage(1); };

  const columns = useMemo((): ColumnDef<ServiceProviderListItem>[] => [
    {
      key: 'provider',
      header: 'مزود الخدمة',
      priority: 'identity',
      render: (provider) => <EntityCell icon={BriefcaseBusiness} tone="primary" title={provider.name} subtitle={provider.legal_name ?? provider.contact_name ?? provider.service_area} />,
    },
    {
      key: 'categories',
      header: 'الخدمات المدعومة',
      priority: 'secondary',
      render: (provider) => provider.categories.length > 0 ? (
        <div className="flex max-w-72 flex-wrap gap-1.5">{provider.categories.slice(0, 3).map((category) => <StatusBadge key={category.id} tone="info">{category.name}</StatusBadge>)}{provider.categories.length > 3 ? <StatusBadge tone="neutral">+{formatCount(provider.categories.length - 3)}</StatusBadge> : null}</div>
      ) : <span className="text-muted-foreground">غير محددة</span>,
    },
    { key: 'contact', header: 'التواصل', priority: 'detail', render: (provider) => <div><p dir="ltr" className="text-end font-medium">{provider.phone ?? '—'}</p><p dir="ltr" className="text-end text-xs text-muted-foreground">{provider.email ?? ''}</p></div> },
    { key: 'jobs', header: 'أعمال الصيانة', priority: 'secondary', render: (provider) => <div className="tabular-nums"><span className="font-bold">{formatCount(provider.maintenance_jobs_count)}</span>{provider.open_jobs_count > 0 ? <span className="ms-2 text-xs text-warning">{formatCount(provider.open_jobs_count)} جارية</span> : null}</div> },
    { key: 'status', header: 'الحالة', priority: 'primary', render: (provider) => <StatusBadge tone={provider.is_active ? 'success' : 'neutral'} dot>{provider.is_active ? 'نشط' : 'غير نشط'}</StatusBadge> },
    {
      key: 'actions',
      header: 'إجراءات',
      priority: 'actions',
      render: (provider) => (
        <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <ActionMenu
            label={`إجراءات ${provider.name}`}
            items={[
              { id: 'view', label: 'عرض', onClick: () => void navigate({ to: '/service-providers/$providerId', params: { providerId: provider.id } }) },
              ...(canWrite ? [
                { id: 'edit', label: 'تعديل', icon: Edit, onClick: () => dialogNavigate({ to: '/service-providers/$providerId/edit', params: { providerId: provider.id } }) },
                { id: 'archive', label: 'أرشفة', icon: Trash2, danger: true, onClick: () => setArchiveTarget(provider) },
              ] : []),
            ]}
          />
        </div>
      ),
    },
  ], []);

  const createAction = canWrite ? (
    <Button className="min-h-11" onClick={() => dialogNavigate({ to: '/service-providers/new' })}>
      <Plus className="me-2 size-4" aria-hidden="true" />إضافة مزود
    </Button>
  ) : undefined;
  const categoriesAction = canWrite ? (
    <Button type="button" variant="secondary" className="min-h-11" onClick={() => setCategoryManagerOpen(true)}>
      <FolderCog className="me-2 size-4" aria-hidden="true" />إدارة أنواع الخدمات
    </Button>
  ) : undefined;

  return (
    <>
      <ListPage
        embedded={embedded}
        dir="rtl"
        visualVariant="malek-pro"
        title="مزودو الخدمات"
        count={total || undefined}
        primaryAction={createAction}
        secondaryActions={categoriesAction}
        search={{ value: search, onChange: (value) => { setSearch(value); setPage(1); }, placeholder: 'بحث بالاسم أو الهاتف أو السجل' }}
        filters={(
          <>
            <Select aria-label="تصفية مزودي الخدمات حسب الحالة" value={status} onChange={(event) => { setStatus(event.target.value as ServiceProviderStatusFilter); setPage(1); }} className="min-h-11 w-32 shrink-0">
              <option value="all">كل الحالات</option><option value="active">نشط</option><option value="inactive">غير نشط</option>
            </Select>
            <Select aria-label="تصفية حسب نوع الخدمة" value={categoryId} disabled={categoriesQuery.isLoading || categoriesQuery.isError} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }} className="min-h-11 w-40 shrink-0">
              <option value="">كل الأنواع</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </>
        )}

        activeFilters={activeFilters}
        onClearAllFilters={clearFilters}
      >
        {summaryQuery.data ? (
          <RegisterMetricStrip
            aria-label="ملخص مزودي الخدمات"
            items={[
              { id: 'total', label: 'المزودون', value: formatCount(summaryQuery.data.total), icon: BriefcaseBusiness, hideWhenEmpty: true },
              { id: 'active', label: 'نشطون', value: formatCount(summaryQuery.data.active), icon: BriefcaseBusiness, hideWhenEmpty: true },
              { id: 'categories', label: 'أنواع الخدمات', value: formatCount(summaryQuery.data.categories), icon: FolderCog, hideWhenEmpty: true },
              { id: 'jobs', label: 'أعمال جارية', value: formatCount(summaryQuery.data.openJobs), icon: Wrench, tone: 'warning', hideWhenEmpty: true },
            ]}
          />
        ) : summaryQuery.isError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <span>تعذر تحميل ملخص مزودي الخدمات.</span><Button type="button" variant="secondary" onClick={() => void summaryQuery.refetch()}>إعادة المحاولة</Button>
          </div>
        ) : null}

        <section className="min-w-0 space-y-2.5">
          <RegisterHeading title="سجل مزودي الخدمات" />
          <div>
            <EntityTable
              aria-label="جدول مزودي الخدمات"
              rows={rows}
              columns={columns}
              keyOf={(provider) => provider.id}
              isLoading={providersQuery.isLoading || categoriesQuery.isLoading}
              error={providersQuery.isError ? providersQuery.error : categoriesQuery.isError ? categoriesQuery.error : null}
              errorTitle="تعذر تحميل مزودي الخدمات"
              onRetry={() => { void providersQuery.refetch(); void categoriesQuery.refetch(); }}
              emptyTitle={hasFilters ? 'لا توجد نتائج مطابقة' : 'لا يوجد مزودو خدمات'}
              emptyDescription={hasFilters ? 'غيّر البحث أو الفلاتر لعرض سجلات أخرى.' : 'أضف أول مزود خدمة لبدء التعيين في أعمال الصيانة.'}
              emptyAction={hasFilters ? <Button variant="secondary" onClick={clearFilters}>مسح الفلاتر</Button> : createAction}
              pagination={{ page, pageSize: PAGE_SIZE, total, onPageChange: setPage }}
              onRowClick={(provider) => void navigate({ to: '/service-providers/$providerId', params: { providerId: provider.id } })}
              mobileBadgeKey="status"
              mobileSummaryKeys={["categories", "contact", "jobs"]}
              mobileCardActions={(provider) => canWrite ? [
                {
                  label: 'تعديل',
                  icon: Edit,
                  variant: 'secondary' as const,
                  ariaLabel: `تعديل ${provider.name}`,
                  onClick: () => dialogNavigate({ to: '/service-providers/$providerId/edit', params: { providerId: provider.id } }),
                },
                {
                  label: 'أرشفة',
                  icon: Trash2,
                  variant: 'danger' as const,
                  ariaLabel: `أرشفة ${provider.name}`,
                  onClick: () => setArchiveTarget(provider),
                },
              ] : []}
            />
          </div>
        </section>
      </ListPage>

      <ServiceProviderCategoriesDialog open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} />
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(next) => { if (!next && !archiveMutation.isPending) setArchiveTarget(null); }}
        title="أرشفة مزود الخدمة؟"
        description={`سيُخفى "${archiveTarget?.name ?? ''}" من سجل المزودين وخيارات التعيين الجديدة، مع بقاء أعمال الصيانة والمستندات التاريخية محفوظة.`}
        confirmLabel="تأكيد الأرشفة"
        isLoading={archiveMutation.isPending}
        onConfirm={() => { if (archiveTarget) archiveMutation.mutate(archiveTarget.id, { onSuccess: () => setArchiveTarget(null) }); }}
      />
    </>
  );
}

export function ServiceProvidersPage() {
  return <ServiceProvidersWorkspace />;
}