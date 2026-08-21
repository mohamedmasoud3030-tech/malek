import { AlertTriangle, Edit, FileText, KeyRound, Mail, Phone, Plus, ShieldCheck, TriangleAlert, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { useDialogNavigate } from '@/app/router/background-location';
import { Button } from '@/components/ui/button';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { EntityActions } from '@/components/ui/entity-actions';
import { useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { PersonFormModal } from '@/features/people/person-form-modal';
import type { TenantWorkspaceRow } from './tenantWorkspaceService';
import { useTenantWorkspace } from './useTenantWorkspace';

const pageSize = 10;

const tenantColumnOptions = [
  { key: 'name', label: 'الاسم', locked: true },
  { key: 'property', label: 'العقار والوحدة' },
  { key: 'contracts', label: 'العقود النشطة' },
  { key: 'arrears', label: 'المتأخرات' },
  { key: 'actions', label: 'الإجراءات', locked: true },
] as const;

const defaultTenantColumns = tenantColumnOptions.map((column) => column.key);

function valueOrDash(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function getTenantLocationText(tenant: TenantWorkspaceRow) {
  return {
    hasLocation: tenant.propertyTitle !== null || tenant.unitNumber !== null,
    propertyLabel: tenant.propertyTitle ?? 'عقار غير محدد',
    unitLabel: tenant.unitNumber ? `وحدة ${tenant.unitNumber}` : 'وحدة غير محددة',
  };
}

function InfoPill({ icon: Icon, label, value, dir }: Readonly<{ icon: typeof Phone; label: string; value: string | number | null | undefined; dir?: 'ltr' | 'rtl' }>) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/85 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" /><span>{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-black" dir={dir}>{valueOrDash(value)}</p>
    </div>
  );
}

function TenantLocation({ tenant }: Readonly<{ tenant: TenantWorkspaceRow }>) {
  const location = getTenantLocationText(tenant);
  return (
    <div className="rounded-xl border border-border/70 bg-muted/35 p-3">
      <p className="text-xs font-bold text-muted-foreground">الوحدة والعقار</p>
      <p className="mt-1 font-black">{location.hasLocation ? location.propertyLabel : '—'}</p>
      {location.hasLocation ? <p className="mt-0.5 text-xs text-muted-foreground">{location.unitLabel}</p> : null}
    </div>
  );
}

function TenantSafeLinks({ tenant, onEdit, onPreview }: Readonly<{ tenant: TenantWorkspaceRow; onEdit: (personId: string) => void; onPreview: (tenant: TenantWorkspaceRow) => void }>) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <EntityActions className="flex flex-wrap gap-2">
      <Button variant="secondary" className="min-h-11 px-3" onClick={() => onPreview(tenant)}>عرض</Button>
      <Button variant="secondary" className="min-h-11 px-3" onClick={() => onEdit(tenant.person.id)}>
        <Edit className="me-1 size-4" />تعديل
      </Button>
      {tenant.primaryContractId !== null && (
        <Button variant="secondary" className="min-h-11 px-3" onClick={() => (navigate as unknown as (opts: unknown) => void)({ to: '/contracts/$contractId', params: { contractId: tenant.primaryContractId! }, state: { backgroundLocation: location } as unknown as Record<string, unknown> })}>
          <FileText className="me-1 size-4" />فتح العقد
        </Button>
      )}
    </EntityActions>
  );
}

function TenantSummary({ rows, total }: Readonly<{ rows: TenantWorkspaceRow[]; total: number }>) {
  const activeContracts = rows.reduce((sum, tenant) => sum + tenant.activeContractCount, 0);
  const arrearsCount = rows.filter((tenant) => tenant.hasArrears).length;

  const items = [
    { label: 'إجمالي المستأجرين', value: total, icon: Users, hint: 'جميع السجلات المطابقة' },
    { label: 'العقود النشطة', value: activeContracts, icon: KeyRound, hint: 'ضمن الصفحة الحالية' },
    { label: 'بحاجة لمتابعة', value: arrearsCount, icon: AlertTriangle, hint: 'ضمن الصفحة الحالية' },
  ];

  return (
    <section data-tenant-summary aria-label="ملخص المستأجرين">
      <ResponsiveCardGrid desktopColumns={3}>
        {items.map(({ label, value, icon: Icon, hint }) => (
          <article key={label} className="group relative min-w-0 overflow-hidden rounded-xl border border-border/75 bg-card p-3 shadow-card sm:p-3.5">
            <div className="relative flex min-w-0 items-start justify-between gap-2.5">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-muted-foreground sm:text-xs">{label}</p>
                <p className="mt-1.5 text-xl font-black tabular-nums sm:text-2xl">{value}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-4 text-muted-foreground sm:text-[11px]">{hint}</p>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary/15 bg-primary/8 text-primary sm:size-10">
                <Icon className="size-4 sm:size-[1.05rem]" aria-hidden="true" />
              </span>
            </div>
          </article>
        ))}
      </ResponsiveCardGrid>
    </section>
  );
}

type TenantsWorkspaceProps = Readonly<{
  embedded?: boolean;
}>;

export function TenantsWorkspace({ embedded = false }: TenantsWorkspaceProps) {
  const navigate = useNavigate();
  const dialogNavigate = useDialogNavigate();
  const dialogLocation = useLocation();
  const routeSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const urlSearch = typeof routeSearch.search === 'string' ? routeSearch.search : '';
  const [search, setSearch] = useState(urlSearch);
  const [page, setPage] = useState(typeof routeSearch.page === 'number' && routeSearch.page > 0 ? routeSearch.page : 1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | undefined>();
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultTenantColumns]);

  useEffect(() => {
    if (embedded) return;
    void navigate({ to: '/tenants', replace: true, search: (previous: Record<string, unknown>) => ({ ...previous, search: search || undefined, page: page === 1 ? undefined : page }) });
  }, [embedded, navigate, page, search]);

  const params = useMemo(() => ({ search, page, pageSize }), [page, search]);
  const tenantsQuery = useTenantWorkspace(params);
  const rows = tenantsQuery.data?.rows ?? [];
  const totalCount = tenantsQuery.data?.count ?? 0;

  const openCreate = () => { setEditingPersonId(undefined); setFormOpen(true); };
  const openEdit = (personId: string) => { setEditingPersonId(personId); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingPersonId(undefined); tenantsQuery.refetch(); };

  const createAction = <Button onClick={openCreate}><Plus className="me-2 size-4" />إضافة مستأجر</Button>;

  const columns: ColumnDef<TenantWorkspaceRow>[] = [
    {
      key: 'name',
      header: 'الاسم',
      priority: 'identity',
      render: (tenant) => (
        <div className="flex flex-col gap-1">
          <span className="font-bold">{tenant.person.full_name}</span>
          {tenant.person.phone && <span className="text-xs text-muted-foreground" dir="ltr">{tenant.person.phone}</span>}
        </div>
      ),
    },
    {
      key: 'property',
      header: 'العقار والوحدة',
      priority: 'secondary',
      render: (tenant) => {
        const location = getTenantLocationText(tenant);
        return location.hasLocation ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold">{location.propertyLabel}</span>
            <span className="text-xs text-muted-foreground">{location.unitLabel}</span>
          </div>
        ) : '—';
      },
    },
    {
      key: 'contracts',
      header: 'العقود النشطة',
      priority: 'secondary',
      render: (tenant) => tenant.activeContractCount > 0 ? tenant.activeContractCount : '—',
    },
    {
      key: 'arrears',
      header: 'المتأخرات',
      priority: 'primary',
      render: (tenant) => tenant.hasArrears ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2.5 py-0.5 text-xs font-bold text-warning">
          <TriangleAlert className="size-3" />له متأخرات
        </span>
      ) : '—',
    },
    {
      key: 'actions',
      header: 'إجراءات',
      priority: 'actions',
      render: (tenant) => (
        <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          <Button variant="secondary" className="min-h-11 px-3" onClick={() => dialogNavigate({ to: '/tenants/$tenantId', params: { tenantId: tenant.person.id } })}>عرض</Button>
          <Button variant="secondary" className="min-h-11 px-3" onClick={() => openEdit(tenant.person.id)}>
            <Edit className="me-1 size-4" />تعديل
          </Button>
          {tenant.primaryContractId !== null && (
            <Button variant="secondary" className="min-h-11 px-3" onClick={() => (navigate as unknown as (opts: unknown) => void)({ to: '/contracts/$contractId', params: { contractId: tenant.primaryContractId! }, state: { backgroundLocation: dialogLocation } as unknown as Record<string, unknown> })}>
              <FileText className="me-1 size-4" />العقد
            </Button>
          )}
        </div>
      ),
    },
  ];

  const workspaceContent = (
    <>
      {!tenantsQuery.isLoading && !tenantsQuery.isError ? <TenantSummary rows={rows} total={totalCount} /> : null}

      <FilterBar
        searchValue={search}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        searchPlaceholder="بحث باسم المستأجر أو الهاتف أو الإيميل أو رقم الهوية"
        searchAriaLabel="بحث في المستأجرين"
        actions={(
          <DataTableColumnsMenu
            columns={tenantColumnOptions}
            visibleKeys={visibleColumnKeys}
            onChange={setVisibleColumnKeys}
          />
        )}
      />

      <section data-tenant-register className="min-w-0 space-y-2.5">
        <header className="flex min-h-11 items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/10 bg-primary/[0.06] text-primary">
              <Users className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black">سجل المستأجرين</h2>
              <p className="truncate text-[11px] font-medium text-muted-foreground">{rows.length} مستأجر في الصفحة الحالية</p>
            </div>
          </div>
        </header>

        <EntityTable
          aria-label="جدول المستأجرين"
          rows={rows}
          columns={columns}
          visibleColumnKeys={visibleColumnKeys}
          keyOf={(tenant) => tenant.person.id}
          mobileVisibleSecondaryKey="arrears"
          isLoading={tenantsQuery.isLoading}
          error={tenantsQuery.isError ? tenantsQuery.error : null}
          errorTitle="تعذر تحميل المستأجرين"
          onRetry={() => tenantsQuery.refetch()}
          emptyTitle="لا توجد سجلات مستأجرين"
          emptyDescription="سيظهر هنا أي شخص مصنف كمستأجر من نموذج الأشخاص الحالي."
          emptyAction={<Button onClick={openCreate}><Plus className="me-2 size-4" />إضافة مستأجر</Button>}
          pagination={{ page, pageSize, total: totalCount, onPageChange: setPage }}
          onRowClick={(tenant) => dialogNavigate({ to: '/tenants/$tenantId', params: { tenantId: tenant.person.id } })}
        />
      </section>
    </>
  );

  const workspace = embedded ? (
    <section data-workspace="tenants" data-visual-wave="malek-pro" dir="rtl" className="space-y-4 sm:space-y-5">
      <div className="flex justify-end">{createAction}</div>
      {workspaceContent}
    </section>
  ) : (
    <PageLayout dir="rtl" size="wide" visualVariant="malek-pro">
      <PageHeader
        title="المستأجرون"
        description="ملفات المستأجرين وعقودهم ووحداتهم وحالة المتابعة من مكان واحد."
        count={totalCount}
        action={createAction}
      />
      {workspaceContent}
    </PageLayout>
  );

  return (
    <>
      {workspace}
      <PersonFormModal open={formOpen} onClose={closeForm} personId={editingPersonId} defaultType="tenant" />
    </>
  );
}

export function TenantsPage() {
  return <TenantsWorkspace />;
}

export default TenantsPage;
