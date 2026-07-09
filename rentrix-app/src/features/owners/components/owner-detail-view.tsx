import { Building2, DoorOpen, FileText, UserRoundCog, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AsyncContentState } from '@/components/async-content-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { EntityTable } from '@/components/ui/entity-table';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { formatCompanyNumber } from '@/lib/companyFormatters';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { getOwnerDisplayName } from '../ownerService';
import type { OwnerDetailState } from '../types';

export function OwnerDetailView({ state }: Readonly<{ state: OwnerDetailState }>) {
  if (state.status === 'loading') {
    return (
      <PageLayout>
        <AsyncContentState status="loading">{null}</AsyncContentState>
      </PageLayout>
    );
  }
  if (state.status === 'error') {
    return (
      <PageLayout>
        <AsyncContentState
          status="error"
          error={state.error}
          errorTitle="تعذر تحميل ملف المالك"
          errorFallbackMessage="تعذر تحميل ملف المالك."
          errorAction={<Button type="button" onClick={() => globalThis.location.reload()}>إعادة المحاولة</Button>}
        >
          {null}
        </AsyncContentState>
      </PageLayout>
    );
  }
  if (state.status === 'unavailable') {
    return (
      <PageLayout>
        <AsyncContentState
          status="empty"
          emptyTitle="ملف المالك غير متاح بأمان"
          emptyDescription={state.reason}
        >
          {null}
        </AsyncContentState>
      </PageLayout>
    );
  }

  const { owner, properties, units, contracts, financialSummary } = state.snapshot;
  const activeContractsCount = contracts.filter((contract) => contract.status === 'active').length;

  return (
    <PageLayout>
      <PageHeader
        title={getOwnerDisplayName(owner)}
        description="ملف تعريف قراءة فقط للمالك يعرض بيانات التعريف والروابط المتاحة فقط."
        secondaryActions={(
          <Button asChild variant="secondary">
            <a href="/owners">العودة لإدارة الملاك</a>
          </Button>
        )}
      />

      <Card>
        <CardHeader className="gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UserRoundCog className="size-6" /></div>
          <div><CardTitle>{getOwnerDisplayName(owner)}</CardTitle><CardDescription>ملف تعريف قراءة فقط للمالك يعرض بيانات التعريف والروابط المتاحة فقط.</CardDescription></div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div><p className="text-xs font-bold text-muted-foreground">الهاتف</p><p className="font-black">{owner.phone || 'غير موثق'}</p></div>
          <div><p className="text-xs font-bold text-muted-foreground">البريد الإلكتروني</p><p className="font-black">{owner.email || 'غير موثق'}</p></div>
          <div><p className="text-xs font-bold text-muted-foreground">الحالة</p><p className="font-black">{owner.is_active ? 'نشط' : 'غير نشط'}</p></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="flex items-center justify-between pt-6"><div><p className="text-sm font-bold text-muted-foreground">العقارات</p><p className="text-3xl font-black">{formatCompanyNumber(defaultCompanyLocalSettings, properties.length)}</p></div><Building2 className="size-7 text-primary" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between pt-6"><div><p className="text-sm font-bold text-muted-foreground">الوحدات</p><p className="text-3xl font-black">{formatCompanyNumber(defaultCompanyLocalSettings, units.length)}</p></div><DoorOpen className="size-7 text-primary" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between pt-6"><div><p className="text-sm font-bold text-muted-foreground">العقود النشطة</p><p className="text-3xl font-black">{formatCompanyNumber(defaultCompanyLocalSettings, activeContractsCount)}</p><p className="text-xs text-muted-foreground">من أصل {formatCompanyNumber(defaultCompanyLocalSettings, contracts.length)} عقود</p></div><FileText className="size-7 text-primary" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between pt-6"><div><p className="text-sm font-bold text-muted-foreground">الرصيد المستحق</p><p className="text-2xl font-black" dir="ltr">{formatMoney(financialSummary.outstandingBalance)}</p><p className="text-xs text-muted-foreground">{formatCompanyNumber(defaultCompanyLocalSettings, financialSummary.outstandingInvoicesCount)} فواتير مفتوحة</p></div><WalletCards className="size-7 text-primary" /></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>العقارات المرتبطة</CardTitle><CardDescription>تظهر فقط العلاقات النشطة الموجودة في `property_owners` مع عدد الوحدات والعقود لكل عقار.</CardDescription></CardHeader>
        <CardContent>
          <EntityTable
            aria-label="جدول عقارات المالك"
            rows={properties}
            columns={[
              { key: 'title', header: 'العقار', render: (property) => <span className="font-black">{property.title}</span> },
              { key: 'address', header: 'العنوان', render: (property) => property.address },
              { key: 'ownership', header: 'نسبة الملكية', render: (property) => {
                const pct = property.property_owners.find((link) => link.owner_id === owner.id && !link.ends_on)?.ownership_percentage ?? 100;
                return `${formatCompanyNumber(defaultCompanyLocalSettings, pct)}%`;
              }},
              { key: 'units', header: 'الوحدات', render: (property) => formatCompanyNumber(defaultCompanyLocalSettings, units.filter((u) => u.property_id === property.id).length) },
              { key: 'active_contracts', header: 'العقود النشطة', render: (property) => formatCompanyNumber(defaultCompanyLocalSettings, contracts.filter((c) => c.property_id === property.id && c.status === 'active').length) },
              { key: 'status', header: 'الحالة', render: (property) => property.status },
            ]}
            keyOf={(property) => property.id}
            emptyTitle="لا توجد عقارات مرتبطة"
            emptyDescription="لا توجد علاقة ملكية نشطة موثقة لهذا المالك."
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
