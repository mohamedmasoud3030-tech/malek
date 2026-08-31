import { AlertTriangle, Building2, Edit, Eye, FileText, KeyRound, Plus, TriangleAlert, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { PersonFormModal } from '@/features/people/person-form-modal';
import { TenantPreviewDialog } from './components/TenantPreviewDialog';
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

function getTenantLocationText(tenant: TenantWorkspaceRow) {
  return {
    hasLocation: tenant.propertyTitle !== null || tenant.unitNumber !== null,
    propertyLabel: tenant.propertyTitle ?? 'عقار غير محدد',
    unitLabel: tenant.unitNumber ? `وحدة ${tenant.unitNumber}` : 'وحدة غير محددة',
  };
}

function TenantSummary({ rows, total }: Readonly<{ rows: TenantWorkspaceRow[]; total: number }>) {
  const activeContracts = rows.reduce((sum, tenant) => sum + tenant.activeContractCount, 0);
  const arrearsCount = rows.filter((tenant) => tenant.hasArrears).length;
  const assignedCount = rows.filter((tenant) => tenant.propertyTitle !== null || tenant.unitNumber !== null).length;

  const items = [
    { label: 'إجمالي المستأجرين', value: total, icon: Users, hint: 'جميع السجلات المطابقة' },
    { label: 'العقود النشطة', value: activeContracts, icon: KeyRound, hint: 'ضمن الصفحة الحالية' },
    { label: 'مرتبطون بوحدات', value: assignedCount, icon: Building2, hint: 'لديهم عقار أو وحدة حالية' },
    { label: 'بحاجة لمتابعة', value: arrearsCount, icon: AlertTriangle, hint: 'ضمن الصفحة الحالية' },
  ];

  return (
    <section data-tenant-summary aria-label="ملخص المستأجرين">
      <RegisterMetricStrip
        aria-label="ملخص المستأجرين"
        items={items.map((item) => ({
          id: item.label,
          label: item.label,
          value: item.value,
          hint: item.hint,
          icon: item.icon,
          hideWhenEmpty: item.label === 'بحاجة لمتابعة',
          tone: item.label === 'بحاجة لمتابعة' ? 'warning' : 'default',
        }))}
      />
    </section>
  );
}

type TenantsWorkspaceProps = Readonly<{
  embedded?: boolean;
}>;

export function TenantsWorkspace({ embedded = false }: TenantsWorkspaceProps) {
  const navigate = useNavigate();
  const routeSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const urlSearch = typeof routeSearch.search === 'string' ? routeSearch.search : '';
  const [search, setSearch] = useState(urlSearch);
  const [page, setPage] = useState(typeof routeSearch.page === 'number' && routeSearch.page > 0 ? routeSearch.page : 1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | undefined>();
  const [previewTenantId, setPreviewTenantId] = useState<string | null>(null);
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
  const openPreview = (tenant: TenantWorkspaceRow) => setPreviewTenantId(tenant.person.id);
  const closePreview = () => setPreviewTenantId(null);
  const openFullDetail = (tenant: TenantWorkspaceRow) => void navigate({ to: '/tenants/$tenantId', params: { tenantId: tenant.person.id } });
  const openContract = (contractId: string) => void navigate({ to: '/contracts/$contractId', params: { contractId } });

  const createAction = <Button onClick={openCreate}><Plus className="me-2 size-4" />إضافة مستأجر</Button>;

  const columns = useMemo((): ColumnDef<TenantWorkspaceRow>[] => [
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
        <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-xs font-bold text-warning">
          <TriangleAlert className="size-3" />له متأخرات
        </span>
      ) : '—',
    },
    {
      key: 'actions',
      header: 'إجراءات',
      priority: 'actions',
      render: (tenant) => (
        <div className="flex items-center" onClick={(event) => event.stopPropagation()}>
          <ActionMenu
            label={`إجراءات ${tenant.person.full_name}`}
            items={[
              ...(tenant.primaryContractId !== null ? [{
                id: 'contract',
                label: 'فتح العقد',
                icon: FileText,
                onClick: () => openContract(tenant.primaryContractId!),
              }] : []),
              {
                id: 'preview',
                label: 'معاينة',
                icon: Eye,
                onClick: () => openPreview(tenant),
              },
              {
                id: 'details',
                label: 'التفاصيل الكاملة',
                icon: Users,
                onClick: () => openFullDetail(tenant),
              },
              {
                id: 'edit',
                label: 'تعديل',
                icon: Edit,
                onClick: () => openEdit(tenant.person.id),
              },
            ]}
          />
        </div>
      ),
    },
  ], [navigate]);

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
        <EntityTable
          aria-label="جدول المستأجرين"
          rows={rows}
          columns={columns}
          visibleColumnKeys={visibleColumnKeys}
          mobileCardType="tenant"
          mobileSupportingKey="property"
          mobilePrimaryMetaKeys={['contracts']}
          mobileSecondaryMetaKeys={['arrears']}
          mobileCardPrimaryAction={(tenant) => ({
            label: 'معاينة',
            icon: Eye,
            variant: 'default',
            onClick: () => openPreview(tenant),
            ariaLabel: `معاينة ${tenant.person.full_name}`,
          })}
          mobileCardActions={(tenant) => [
            {
              label: 'التفاصيل الكاملة',
              icon: Users,
              variant: 'secondary',
              onClick: () => openFullDetail(tenant),
              ariaLabel: `فتح ملف ${tenant.person.full_name}`,
            },
            {
              label: 'تعديل',
              icon: Edit,
              variant: 'secondary',
              onClick: () => openEdit(tenant.person.id),
              ariaLabel: `تعديل ${tenant.person.full_name}`,
            },
            ...(tenant.primaryContractId !== null
              ? [{
                  label: 'العقد',
                  icon: FileText,
                  variant: 'secondary' as const,
                  onClick: () => openContract(tenant.primaryContractId!),
                  ariaLabel: `فتح عقد ${tenant.person.full_name}`,
                }]
              : []),
          ]}
          keyOf={(tenant) => tenant.person.id}
          isLoading={tenantsQuery.isLoading}
          error={tenantsQuery.isError ? tenantsQuery.error : null}
          errorTitle="تعذر تحميل المستأجرين"
          onRetry={() => tenantsQuery.refetch()}
          emptyTitle="لا توجد سجلات مستأجرين"
          emptyDescription="سيظهر هنا أي شخص مصنف كمستأجر من نموذج الأشخاص الحالي."
          emptyAction={<Button onClick={openCreate}><Plus className="me-2 size-4" />إضافة مستأجر</Button>}
          pagination={{ page, pageSize, total: totalCount, onPageChange: setPage }}
          onRowClick={openPreview}
        />
      </section>

      <TenantPreviewDialog
        tenantId={previewTenantId ?? ''}
        open={previewTenantId !== null}
        onOpenChange={(open) => { if (!open) closePreview(); }}
        onEdit={(personId) => { closePreview(); openEdit(personId); }}
      />
    </>
  );

  return (
    <>
      <EmbeddableWorkspace
        embedded={embedded}
        workspaceName="tenants"
        dir="rtl"
        size="wide"
        title="المستأجرون"
        count={totalCount}
        primaryAction={createAction}
      >
        {workspaceContent}
      </EmbeddableWorkspace>
      <PersonFormModal open={formOpen} onClose={closeForm} personId={editingPersonId} defaultType="tenant" />
    </>
  );
}

export function TenantsPage() {
  return <TenantsWorkspace />;
}

export default TenantsPage;
