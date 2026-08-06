import { Link } from '@tanstack/react-router';
import { Edit, FileText, Mail, Phone, Plus, ReceiptText, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { ListStateBody } from '@/components/layout/list-state-body';
import { Button } from '@/components/ui/button';
import { EntityActions } from '@/components/ui/entity-actions';
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
    <div className="rounded-2xl border bg-background px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
        <Icon className="size-3.5" /><span>{label}</span>
      </div>
      <p className="mt-1 text-sm font-black" dir={dir}>{valueOrDash(value)}</p>
    </div>
  );
}

function TenantLocation({ tenant }: Readonly<{ tenant: TenantWorkspaceRow }>) {
  const location = getTenantLocationText(tenant);
  return (
    <div className="rounded-2xl border bg-muted/30 p-3">
      <p className="text-xs font-bold text-muted-foreground">الوحدة/العقار</p>
      <p className="mt-1 font-black">{location.hasLocation ? location.propertyLabel : '—'}</p>
      {location.hasLocation ? <p className="text-xs text-muted-foreground">{location.unitLabel}</p> : null}
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

function TenantCard({ tenant, onEdit }: Readonly<{ tenant: TenantWorkspaceRow; onEdit: (personId: string) => void }>) {
  return (
    <MobileCard
      title={tenant.person.full_name}
      subtitle={`عقود نشطة: ${tenant.activeContractCount}`}
      badge={<span className="shrink-0 rounded-full border bg-card px-2.5 py-1 text-[11px] font-black text-muted-foreground">مستأجر</span>}
      meta={(
        <div className="grid gap-2 sm:grid-cols-3">
          <InfoPill icon={Phone} label="الهاتف" value={tenant.person.phone} dir="ltr" />
          <InfoPill icon={Mail} label="الإيميل" value={tenant.person.email} dir="ltr" />
          <InfoPill icon={ShieldCheck} label="رقم الهوية" value={tenant.person.national_id} />
        </div>
      )}
      stats={<TenantLocation tenant={tenant} />}
      actions={(
        <div className="w-full rounded-2xl border border-dashed p-3">
          <p className="mb-2 text-xs font-bold text-muted-foreground">روابط آمنة</p>
          <TenantSafeLinks tenant={tenant} onEdit={onEdit} />
        </div>
      )}
      onClick={() => onEdit(tenant.person.id)}
    />
  );
}

function TenantWorkspaceContent({ isError, isLoading, onCreate, onEdit, onRetry, rows }: Readonly<{ isError: boolean; isLoading: boolean; onCreate: () => void; onEdit: (personId: string) => void; onRetry: () => void; rows: TenantWorkspaceRow[] }>) {
  return (
    <ListStateBody
      status={isLoading ? 'loading' : isError ? 'error' : rows.length === 0 ? 'empty' : 'ready'}
      errorTitle="تعذر تحميل المستأجرين"
      emptyTitle="لا توجد سجلات مستأجرين"
      emptyDescription="سيظهر هنا أي شخص مصنف كمستأجر من نموذج الأشخاص الحالي."
      emptyAction={(
        <Button onClick={onCreate}>
          <Plus className="me-2 size-4" />إضافة مستأجر
        </Button>
      )}
      errorAction={<Button onClick={onRetry}>إعادة المحاولة</Button>}
    >
      <div className="grid gap-4">{rows.map((tenant) => <TenantCard key={tenant.person.id} tenant={tenant} onEdit={onEdit} />)}</div>
    </ListStateBody>
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
  const totalPages = Math.max(1, Math.ceil((tenantsQuery.data?.count ?? 0) / pageSize));

  const openCreate = () => { setEditingPersonId(undefined); setFormOpen(true); };
  const openEdit = (personId: string) => { setEditingPersonId(personId); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingPersonId(undefined); tenantsQuery.refetch(); };

  const createAction = <Button onClick={openCreate}><Plus className="me-2 size-4" />إضافة مستأجر</Button>;

  const workspaceContent = (
    <>
      <FilterBar
        searchValue={search}
        onSearchChange={(value) => { setSearch(value); setPage(1); }}
        searchPlaceholder="بحث باسم المستأجر أو الهاتف أو الإيميل أو رقم الهوية"
        searchAriaLabel="بحث في المستأجرين"
      />

      <TenantWorkspaceContent isError={tenantsQuery.isError} isLoading={tenantsQuery.isLoading} onCreate={openCreate} onEdit={openEdit} onRetry={() => tenantsQuery.refetch()} rows={rows} />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>الصفحة {page} من {totalPages}</span>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>السابق</Button>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((v) => Math.min(totalPages, v + 1))}>التالي</Button>
        </div>
      </div>
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
        description="عرض مستقل للمستأجرين مبني بأمان على بيانات الأشخاص والعقود والفواتير الحالية."
        count={tenantsQuery.data?.count ?? 0}
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
