import { Link } from '@tanstack/react-router';
import { Building2, DoorOpen, FileText, HandCoins, UserRoundCog, WalletCards } from 'lucide-react';
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
import { settlementStatusLabels, type OwnerSettlementRecord, type SettlementStatus } from '../services/owner-settlements-service';
import type { OwnerDetailState } from '../types';

function settlementBadgeTone(status: SettlementStatus) {
  if (status === 'paid') return 'success' as const;
  if (status === 'approved') return 'info' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'warning' as const;
}

export function OwnerDetailView({
  state,
  settlements,
  canOpenOwnerSettlements = false,
}: Readonly<{
  state: OwnerDetailState;
  /** Owner settlements (latest first). When omitted the whole section is hidden. */
  settlements?: readonly OwnerSettlementRecord[];
  /** Whether the current role may open the dedicated settlements workspace. */
  canOpenOwnerSettlements?: boolean;
}>) {
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

      {settlements !== undefined ? (
        <Card>
          <CardHeader className="gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><HandCoins className="size-6" /></div>
            <CardTitle className="text-base">تسويات المالك</CardTitle>
            <CardDescription>أحدث التسويات المعدة لهذا المالك عبر كل عقاراته.</CardDescription>
            {canOpenOwnerSettlements ? (
              <Button variant="secondary" asChild>
                <Link to="/owner-settlements">فتح مساحة التسويات</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {settlements.length === 0 ? (
              <p className="text-sm font-semibold text-muted-foreground">لا توجد تسويات مسجلة لهذا المالك حتى الآن.</p>
            ) : (
              <ul className="space-y-2" aria-label="قائمة تسويات المالك">
                {settlements.slice(0, 5).map((settlement) => (
                  <li
                    key={settlement.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm"
                  >
                    <span className="font-semibold">{settlement.property_title}</span>
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {settlement.period_start} → {settlement.period_end}
                    </span>
                    <span className="ms-auto flex items-center gap-2">
                      <StatusBadge tone={settlementBadgeTone(settlement.status)} dot>
                        {settlementStatusLabels[settlement.status]}
                      </StatusBadge>
                      <span className="font-bold" title="الصافي المستحق للمالك">
                        {formatMoney(settlement.net_payable_amount)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {settlements.length > 5 && canOpenOwnerSettlements ? (
              <p className="mt-2 text-xs text-muted-foreground">
                تُعرض أحدث ٥ تسويات — افتح مساحة التسويات لاستعراض السجل الكامل.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
