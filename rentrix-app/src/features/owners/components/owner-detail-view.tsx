import { Building2, DoorOpen, FileText, UserRoundCog, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AsyncContentState } from '@/components/async-content-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { EntityTable } from '@/components/ui/entity-table';
import { DetailFields } from '@/components/ui/detail-fields';
import { KpiCard } from '@/components/ui/kpi-card';
import { MobileCard } from '@/components/ui/mobile-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyNumber } from '@/lib/companyFormatters';
import { getOwnerDisplayName } from '../services/owner-service';
import type { OwnerDetailState } from '../types';

export function OwnerDetailView({ state }: Readonly<{ state: OwnerDetailState }>) {
  const companySettings = useCompanySettingsContract();

  if (state.status === 'loading') {
    return <AsyncContentState status="loading">{null}</AsyncContentState>;
  }
  if (state.status === 'error') {
    return (
      <AsyncContentState
        status="error"
        error={state.error}
        errorTitle="تعذر تحميل ملف المالك"
        errorFallbackMessage="تعذر تحميل ملف المالك."
        errorAction={<Button type="button" onClick={() => globalThis.location.reload()}>إعادة المحاولة</Button>}
      >
        {null}
      </AsyncContentState>
    );
  }
  if (state.status === 'unavailable') {
    return (
      <AsyncContentState
        status="empty"
        emptyTitle="ملف المالك غير متاح بأمان"
        emptyDescription={state.reason}
      >
        {null}
      </AsyncContentState>
    );
  }

  const { owner, properties, units, contracts, financialSummary } = state.snapshot;
  const activeContractsCount = contracts.filter((contract) => contract.status === 'active').length;

  return (
    <PageLayout dir="rtl" size="wide">
      <EntityDetailHeader
        title={getOwnerDisplayName(owner)}
        subtitle="ملف تعريف قراءة فقط للمالك يعرض بيانات التعريف والروابط المتاحة فقط."
        backTo="/owners"
        backLabel="إدارة الملاك"
      />
      <Card>
        <CardHeader className="gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UserRoundCog className="size-6" /></div>
          <CardTitle className="text-base">بيانات التواصل</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailFields
            columns={3}
            fields={[
              { label: 'الهاتف', value: owner.phone ? <span dir="ltr">{owner.phone}</span> : 'غير موثق' },
              { label: 'البريد الإلكتروني', value: owner.email ? <span dir="ltr">{owner.email}</span> : 'غير موثق' },
              { label: 'الحالة', value: <StatusBadge tone={owner.is_active ? 'success' : 'neutral'} dot>{owner.is_active ? 'نشط' : 'غير نشط'}</StatusBadge> },
            ]}
          />
        </CardContent>
      </Card>

      <ResponsiveCardGrid>
        <KpiCard label="العقارات" value={formatCompanyNumber(companySettings, properties.length)} icon={Building2} accent="primary" />
        <KpiCard label="الوحدات" value={formatCompanyNumber(companySettings, units.length)} icon={DoorOpen} accent="sky" />
        <KpiCard label="العقود النشطة" value={formatCompanyNumber(companySettings, activeContractsCount)} sub={`من أصل ${formatCompanyNumber(companySettings, contracts.length)} عقود`} icon={FileText} accent="emerald" />
        <KpiCard label="الرصيد المستحق" value={formatMoney(financialSummary.outstandingBalance)} sub={`${formatCompanyNumber(companySettings, financialSummary.outstandingInvoicesCount)} فواتير مفتوحة`} icon={WalletCards} accent="amber" />
      </ResponsiveCardGrid>

      <Card>
        <CardHeader><CardTitle>العقارات المرتبطة</CardTitle><CardDescription>تظهر فقط العلاقات النشطة الموجودة في `property_owners` مع عدد الوحدات والعقود لكل عقار.</CardDescription></CardHeader>
        <CardContent>
          <EntityTable
            aria-label="جدول عقارات المالك"
            rows={properties}
            columns={[
              { key: 'title', header: 'العقار', render: (property) => <span className="font-semibold">{property.title}</span> },
              { key: 'address', header: 'العنوان', render: (property) => property.address },
              { key: 'ownership', header: 'نسبة الملكية', render: (property) => {
                const pct = property.property_owners.find((link) => link.owner_id === owner.id && !link.ends_on)?.ownership_percentage ?? 100;
                return `${formatCompanyNumber(companySettings, pct)}%`;
              }},
              { key: 'units', header: 'الوحدات', render: (property) => formatCompanyNumber(companySettings, units.filter((u) => u.property_id === property.id).length) },
              { key: 'active_contracts', header: 'العقود النشطة', render: (property) => formatCompanyNumber(companySettings, contracts.filter((c) => c.property_id === property.id && c.status === 'active').length) },
              { key: 'status', header: 'الحالة', render: (property) => property.status },
            ]}
            keyOf={(property) => property.id}
            emptyTitle="لا توجد عقارات مرتبطة"
            emptyDescription="لا توجد علاقة ملكية نشطة موثقة لهذا المالك."
            renderMobileCard={(property) => {
              const ownershipPercentage = property.property_owners.find((link) => link.owner_id === owner.id && !link.ends_on)?.ownership_percentage ?? 100;
              const activeContracts = contracts.filter((contract) => contract.property_id === property.id && contract.status === 'active').length;
              return (
                <MobileCard
                  title={property.title}
                  subtitle={property.address}
                  badge={<StatusBadge tone={property.status === 'active' ? 'success' : 'neutral'} dot>{property.status === 'active' ? 'نشط' : property.status}</StatusBadge>}
                  stats={<div className="grid grid-cols-3 gap-2 text-center text-xs"><span><strong>{formatCompanyNumber(companySettings, ownershipPercentage)}%</strong><br />الملكية</span><span><strong>{formatCompanyNumber(companySettings, units.filter((unit) => unit.property_id === property.id).length)}</strong><br />الوحدات</span><span><strong>{formatCompanyNumber(companySettings, activeContracts)}</strong><br />عقود نشطة</span></div>}
                />
              );
            }}
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
