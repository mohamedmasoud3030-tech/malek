import { Link } from '@tanstack/react-router';
import { AlertTriangle, Edit, FileText, KeyRound, Mail, Phone, Plus, ReceiptText, ShieldCheck, TriangleAlert, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { AsyncContentState } from '@/components/async-content-state';
import { Button } from '@/components/ui/button';
import { EntityActions } from '@/components/ui/entity-actions';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { MobileCard } from '@/components/ui/mobile-card';
import { PersonFormModal } from '@/features/people/person-form-modal';
import type { TenantWorkspaceRow } from './tenantWorkspaceService';
import { useTenantWorkspace } from './useTenantWorkspace';

const pageSize = 10;

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

function TenantSafeLinks({ tenant, onEdit }: Readonly<{ tenant: TenantWorkspaceRow; onEdit: (personId: string) => void }>) {
  return (
    <EntityActions className="flex flex-wrap gap-2">
      <Button variant="secondary" className="min-h-11 px-3" onClick={() => onEdit(tenant.person.id)}>
        <Edit className="me-1 size-4" />تعديل
      </Button>
      <Button variant="secondary" className="min-h-11 px-3" asChild>
        <Link to="/reports">
          <ReceiptText className="me-1 size-4" />كشف الحساب
        </Link>
      </Button>
      {tenant.primaryContractId !== null && (
        <Button variant="secondary" className="min-h-11 px-3" asChild>
          <Link to="/contracts/$contractId" params={{ contractId: tenant.primaryContractId }}>
            <FileText className="me-1 size-4" />العقد
          </Link>
        </Button>
      )}
      {tenant.hasInvoices && (
        <Button variant="secondary" className="min-h-11 px-3" asChild>
          <Link to="/invoices">
            <ReceiptText className="me-1 size-4" />الفواتير
          </Link>
        </Button>
      )}
      {tenant.hasArrears && (
        <Button variant="secondary" className="min-h-11 px-3 text-warning" asChild>
          <Link to="/arrears">
            <TriangleAlert className="me-1 size-4" />المتأخرات
          </Link>
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
    { label: 'بحاجة لمتابعة', value: arrearsCount, icon: AlertTriangle, hint: 'لديهم متأخرات' },
  ];

  return (
    <section data-tenant-summary aria-label="ملخص المستأجرين" className="grid gap-3 sm:grid-cols-3">
      {items.map(({ label, value, icon: Icon, hint }) => (
        <div key={label} className="group relative overflow-hidden rounded-2xl border border-border/75 bg-card p-4 shadow-card">
          <div className="absolute inset-inline-end-0 inset-block-start-0 size-24 rounded-full bg-primary/7 blur-2xl transition group-hover:bg-primary/12" aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">{hint}</p>
            </div>
            <span className="grid size-11 place-items-center rounded-xl border border-primary/15 bg-primary/8 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}

type TenantsWorkspaceProps = Readonly<{
  embedded?: boolean;
}>;

export function TenantsWorkspace({ embedded = false }: TenantsWorkspaceProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | undefined>();
  const params = useMemo(() => ({ search, page, pageSize }), [page, search]);
  const tenantsQuery = useTenantWorkspace(params);
  const rows = tenantsQuery.data?.rows ?? [];
  const totalCount = tenantsQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const openCreate = () => { setEditingPersonId(undefined); setFormOpen(true); };
  const openEdit = (personId: string) => { setEditingPersonId(personId); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingPersonId(undefined); tenantsQuery.refetch(); };

  const createAction = <Button onClick={openCreate}><Plus className="me-2 size-4" />إضافة مستأجر</Button>;

  const columns: ColumnDef<TenantWorkspaceRow>[] = [
    {
      key: 'name',
      header: 'الاسم',
      render: (tenant) => (
        <div className="flex flex-col gap-1">
          <span className="font-bold">{tenant.person.full_name}</span>
          {tenant.person.phone && (
            <span className="text-xs text-muted-foreground" dir="ltr">{tenant.person.phone}</span>
          )}
        </div>
      ),
    },
    {
      key: 'property',
      header: 'العقار والوحدة',
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
      render: (tenant) => tenant.activeContractCount > 0 ? tenant.activeContractCount : '—',
    },
    {
      key: 'arrears',
      header: 'المتأخرات',
      render: (tenant) => tenant.hasArrears ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2.5 py-0.5 text-xs font-bold text-warning">
          <TriangleAlert className="size-3" />له متأخرات
        </span>
      ) : '—',
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (tenant) => (
        <div
          className="flex flex-wrap gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Button variant="secondary" className="min-h-11 px-3" onClick={() => openEdit(tenant.person.id)}>
            <Edit className="me-1 size-4" />تعديل
          </Button>
          {tenant.primaryContractId !== null && (
            <Button variant="secondary" className="min-h-11 px-3" asChild>
              <Link to="/contracts/$contractId" params={{ contractId: tenant.primaryContractId }}>
                <FileText className="me-1 size-4" />العقد
              </Link>
            </Button>
          )}
          {tenant.hasArrears && (
            <Button variant="secondary" className="min-h-11 px-3 text-warning" asChild>
              <Link to="/arrears">
                <TriangleAlert className="me-1 size-4" />المتأخرات
              </Link>
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
      />

      <section
        data-tenant-register
        className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border/70 bg-muted/35 px-4 py-4 sm:px-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/9 text-primary">
                <Users className="size-4.5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-black">سجل المستأجرين</h2>
            </div>
            <p className="mt-1.5 text-xs font-medium text-muted-foreground">
              {rows.length} مستأجر في الصفحة الحالية.
            </p>
          </div>
        </header>

        <div className="p-3 sm:p-4">
          <AsyncContentState
            status={tenantsQuery.isLoading ? 'loading' : tenantsQuery.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready'}
            error={tenantsQuery.error}
            errorTitle="تعذر تحميل المستأجرين"
            errorAction={<Button onClick={() => tenantsQuery.refetch()}>إعادة المحاولة</Button>}
            emptyTitle="لا توجد سجلات مستأجرين"
            emptyDescription="سيظهر هنا أي شخص مصنف كمستأجر من نموذج الأشخاص الحالي."
            emptyAction={<Button onClick={openCreate}><Plus className="me-2 size-4" />إضافة مستأجر</Button>}
          >
            <EntityTable
              aria-label="جدول المستأجرين"
              rows={rows}
              columns={columns}
              keyOf={(tenant) => tenant.person.id}
              isLoading={tenantsQuery.isLoading}
              error={tenantsQuery.isError ? tenantsQuery.error : null}
              errorTitle="تعذر تحميل المستأجرين"
              onRetry={() => tenantsQuery.refetch()}
              emptyTitle="لا توجد سجلات مستأجرين"
              emptyDescription="سيظهر هنا أي شخص مصنف كمستأجر من نموذج الأشخاص الحالي."
              emptyAction={<Button onClick={openCreate}><Plus className="me-2 size-4" />إضافة مستأجر</Button>}
              pagination={{
                page,
                pageSize,
                total: totalCount,
                onPageChange: setPage,
              }}
              onRowClick={(tenant) => openEdit(tenant.person.id)}
              enableViewModeToggle
              viewModeStorageKey="rentrix:view-mode:tenants"
              renderMobileCard={(tenant) => {
                const location = getTenantLocationText(tenant);
                return (
                  <MobileCard
                    title={tenant.person.full_name}
                    subtitle={`عقود نشطة: ${tenant.activeContractCount}`}
                    badge={(
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-[11px] font-black text-primary">
                        <Users className="size-3" aria-hidden="true" />مستأجر
                      </span>
                    )}
                    meta={(
                      <div className="grid gap-2 sm:grid-cols-3">
                        <InfoPill icon={Phone} label="الهاتف" value={tenant.person.phone} dir="ltr" />
                        <InfoPill icon={Mail} label="الإيميل" value={tenant.person.email} dir="ltr" />
                        <InfoPill icon={ShieldCheck} label="رقم الهوية" value={tenant.person.national_id} />
                      </div>
                    )}
                    stats={<TenantLocation tenant={tenant} />}
                    actions={(
                      <div className="w-full rounded-xl border border-dashed border-border/80 bg-background/70 p-3">
                        <p className="mb-2 text-xs font-bold text-muted-foreground">الإجراءات والروابط</p>
                        <TenantSafeLinks tenant={tenant} onEdit={openEdit} />
                      </div>
                    )}
                    onClick={() => openEdit(tenant.person.id)}
                  />
                );
              }}
            />
          </AsyncContentState>
        </div>
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
        title="المستأجرين"
        description="مساحة تشغيل موحدة لمتابعة المستأجر والعقد والوحدة والحالة المالية من مكان واحد."
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
