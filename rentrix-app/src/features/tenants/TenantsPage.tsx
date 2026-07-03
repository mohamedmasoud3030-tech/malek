import { Link } from '@tanstack/react-router';
import { FileText, Mail, Phone, ReceiptText, ShieldCheck, TriangleAlert, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ListFilterBar } from '../../components/layout/list-filter-bar';
import { ListPagination } from '../../components/layout/list-pagination';
import { ListStateBody } from '../../components/layout/list-state-body';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EntityActions } from '../../components/ui/entity-actions';
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

function TenantSafeLinks({ tenant }: Readonly<{ tenant: TenantWorkspaceRow }>) {
  const hasLinks = tenant.primaryContractId !== null || tenant.hasInvoices || tenant.hasArrears;
  if (!hasLinks) return <p className="text-sm text-muted-foreground">لا توجد روابط متاحة حتى الآن</p>;
  return (
    <EntityActions className="flex flex-wrap gap-2">
      {tenant.primaryContractId !== null && (
        <Button variant="secondary" className="min-h-11 px-3" asChild>
          <Link to="/contracts/$contractId" params={{ contractId: tenant.primaryContractId }}>
            <FileText className="ml-1 size-4" />العقد
          </Link>
        </Button>
      )}
      {tenant.hasInvoices && (
        <Button variant="secondary" className="min-h-11 px-3" asChild>
          <Link to="/invoices">
            <ReceiptText className="ml-1 size-4" />الفواتير
          </Link>
        </Button>
      )}
      {tenant.hasArrears && (
        <Button variant="secondary" className="min-h-11 px-3 text-amber-700" asChild>
          <Link to="/arrears">
            <TriangleAlert className="ml-1 size-4" />المتأخرات
          </Link>
        </Button>
      )}
    </EntityActions>
  );
}

function TenantCard({ tenant }: Readonly<{ tenant: TenantWorkspaceRow }>) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black text-primary">مستأجر</p>
            <h3 className="mt-1 text-xl font-black">{tenant.person.full_name}</h3>
          </div>
          <div className="rounded-full border bg-card px-3 py-1 text-xs font-black text-muted-foreground">
            عقود نشطة: <span className="text-foreground">{tenant.activeContractCount}</span>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <InfoPill icon={Phone} label="الهاتف" value={tenant.person.phone} dir="ltr" />
          <InfoPill icon={Mail} label="الإيميل" value={tenant.person.email} dir="ltr" />
          <InfoPill icon={ShieldCheck} label="رقم الهوية" value={tenant.person.national_id} />
        </div>
        <TenantLocation tenant={tenant} />
        <div className="rounded-2xl border border-dashed p-3">
          <p className="mb-2 text-xs font-bold text-muted-foreground">روابط آمنة</p>
          <TenantSafeLinks tenant={tenant} />
        </div>
      </CardContent>
    </Card>
  );
}

function TenantWorkspaceContent({ isError, isLoading, onRetry, rows }: Readonly<{ isError: boolean; isLoading: boolean; onRetry: () => void; rows: TenantWorkspaceRow[] }>) {
  return (
    <ListStateBody
      status={isLoading ? 'loading' : isError ? 'error' : rows.length === 0 ? 'empty' : 'ready'}
      errorTitle="تعذر تحميل المستأجرين"
      emptyTitle="لا توجد سجلات مستأجرين"
      emptyDescription="سيظهر هنا أي شخص مصنف كمستأجر من نموذج الأشخاص الحالي."
      errorAction={<Button onClick={onRetry}>إعادة المحاولة</Button>}
    >
      <div className="grid gap-4">{rows.map((tenant) => <TenantCard key={tenant.person.id} tenant={tenant} />)}</div>
    </ListStateBody>
  );
}

export function TenantsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const params = useMemo(() => ({ search, page, pageSize }), [page, search]);
  const tenantsQuery = useTenantWorkspace(params);
  const rows = tenantsQuery.data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((tenantsQuery.data?.count ?? 0) / pageSize));

  return (
    <div className="space-y-6" dir="rtl">
      <Card className="overflow-hidden border-primary/10 bg-gradient-to-l from-primary/10 via-background to-background">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary"><Users className="size-4" />مساحة عمل مسترجعة</div>
            <div>
              <h2 className="text-2xl font-black">المستأجرين</h2>
              <p className="text-sm text-muted-foreground">عرض مستقل للمستأجرين مبني بأمان على بيانات الأشخاص والعقود والفواتير الحالية.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-bold text-muted-foreground">
            إجمالي النتائج: <span className="text-foreground">{tenantsQuery.data?.count ?? 0}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <ListFilterBar
            search={{
              value: search,
              onChange: (value: string) => { setSearch(value); setPage(1); },
              placeholder: "بحث باسم المستأجر أو الهاتف أو الإيميل أو رقم الهوية"
            }}
          />
        </CardContent>
      </Card>

      <TenantWorkspaceContent isError={tenantsQuery.isError} isLoading={tenantsQuery.isLoading} onRetry={() => tenantsQuery.refetch()} rows={rows} />

      <ListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
export default TenantsPage;
