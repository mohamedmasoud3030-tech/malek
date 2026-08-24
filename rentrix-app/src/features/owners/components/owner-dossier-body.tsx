import { Link } from '@tanstack/react-router';
import {
  Activity,
  Building2,
  DoorOpen,
  FileText,
  HandCoins,
  ReceiptText,
  UserRoundCog,
  WalletCards,
} from 'lucide-react';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailFields } from '@/components/ui/detail-fields';
import { EntityTable } from '@/components/ui/entity-table';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { useDialogNavigate } from '@/app/router/background-location';
import { formatCompanyMoney, formatCompanyNumber, formatCompanyDate } from '@/lib/companyFormatters';
import { businessReferenceOrLabel } from '@/lib/business-reference';
import { getOwnerDisplayName } from '../services/owner-service';
import {
  settlementStatusLabels,
  type OwnerSettlementRecord,
  type SettlementStatus,
} from '../services/owner-settlements-service';
import type { OwnerActivityRecord } from '@/services/owner-workspace-service';
import type { OwnerDetailSnapshot } from '../services/owner-service';

function settlementBadgeTone(status: SettlementStatus) {
  if (status === 'paid') return 'success' as const;
  if (status === 'approved') return 'info' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'warning' as const;
}

const unitStatusLabels: Record<string, string> = {
  occupied: 'مشغولة',
  available: 'متاحة',
  maintenance: 'صيانة',
  reserved: 'محجوزة',
};

function unitStatusTone(status: string): 'success' | 'info' | 'warning' | 'neutral' {
  if (status === 'occupied') return 'success';
  if (status === 'available') return 'info';
  if (status === 'maintenance' || status === 'reserved') return 'warning';
  return 'neutral';
}

const invoiceStatusLabels: Record<string, string> = {
  PAID: 'مدفوعة',
  paid: 'مدفوعة',
  PARTIALLY_PAID: 'مدفوعة جزئياً',
  partial: 'مدفوعة جزئياً',
  UNPAID: 'غير مدفوعة',
  unpaid: 'غير مدفوعة',
  OVERDUE: 'متأخرة',
  overdue: 'متأخرة',
  VOID: 'ملغاة',
  void: 'ملغاة',
};

function invoiceStatusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  const normalized = status.toUpperCase();
  if (normalized === 'PAID') return 'success';
  if (normalized === 'OVERDUE') return 'danger';
  if (normalized === 'VOID') return 'neutral';
  return 'warning';
}

function getInvoiceRemaining(invoice: { amount: number; paid_amount: number }): number {
  return Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount));
}

export function OwnerDossierBody({
  snapshot,
  settlements,
  canOpenOwnerSettlements = false,
  activity,
}: Readonly<{
  snapshot: OwnerDetailSnapshot;
  settlements?: readonly OwnerSettlementRecord[];
  canOpenOwnerSettlements?: boolean;
  activity?: readonly OwnerActivityRecord[];
}>) {
  const companySettings = useCompanySettingsContract();
  const dialogNavigate = useDialogNavigate();
  const { owner, properties, units, contracts, invoices, financialSummary } = snapshot;

  const activeContracts = contracts.filter((contract) => contract.status === 'active');
  const openInvoices = invoices
    .filter((invoice) => !invoice.deleted_at && getInvoiceRemaining(invoice) > 0)
    .sort((left, right) => (left.due_date ?? left.created_at ?? '').localeCompare(right.due_date ?? right.created_at ?? ''));

  const propertyTitleById = new Map(properties.map((property) => [property.id, property.title ?? 'عقار غير محدد']));
  const unitNumberById = new Map(units.map((unit) => [unit.id, unit.unit_number]));
  const unitPropertyIdById = new Map(units.map((unit) => [unit.id, unit.property_id]));

  const ownerUnitCount = units.length;
  const occupiedUnits = units.filter((unit) => unit.status === 'occupied').length;
  const availableUnits = units.filter((unit) => unit.status === 'available').length;
  const maintenanceUnits = units.filter((unit) => unit.status === 'maintenance').length;
  const reservedUnits = units.filter((unit) => unit.status === 'reserved').length;

  return (
    <div className="space-y-5">
      {/* Identity + contact */}
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UserRoundCog className="size-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                {/* h2: the owner's name is the page-level identity, directly under
                    the page h1 (CardTitle is h3 and would skip a level — axe heading-order). */}
                <h2 className="text-lg font-semibold leading-6 sm:text-xl">{getOwnerDisplayName(owner)}</h2>
                <CardDescription className="mt-1">بيانات التواصل والهوية الأساسية للمالك.</CardDescription>
              </div>
            </div>
            <StatusBadge tone={owner.is_active ? 'success' : 'neutral'} dot>
              {owner.is_active ? 'نشط' : 'غير نشط'}
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent>
          <DetailFields
            columns={3}
            fields={[
              { label: 'الهاتف', value: owner.phone ? <span dir="ltr">{owner.phone}</span> : 'غير موثق' },
              { label: 'البريد الإلكتروني', value: owner.email ? <span dir="ltr">{owner.email}</span> : 'غير موثق' },
              { label: 'رقم الهوية', value: owner.national_id ? <span dir="ltr">{owner.national_id}</span> : 'غير موثق' },
              { label: 'الرقم الضريبي', value: owner.tax_number ? <span dir="ltr">{owner.tax_number}</span> : 'غير موثق' },
              { label: 'العنوان', value: owner.address ?? 'غير موثق', wide: true },
              { label: 'ملاحظات', value: owner.notes ?? '—', wide: true },
            ]}
          />
        </CardContent>
      </Card>

      {/* KPIs */}
      <ResponsiveCardGrid>
        <KpiCard label="العقارات" value={formatCompanyNumber(companySettings, properties.length)} icon={Building2} accent="primary" />
        <KpiCard label="الوحدات" value={formatCompanyNumber(companySettings, ownerUnitCount)} icon={DoorOpen} accent="sky" />
        <KpiCard label="العقود النشطة" value={formatCompanyNumber(companySettings, activeContracts.length)} sub={`من أصل ${formatCompanyNumber(companySettings, contracts.length)} عقود`} icon={FileText} accent="emerald" />
        <KpiCard label="مستحقات المستأجرين" value={formatCompanyMoney(companySettings, financialSummary.outstandingBalance)} sub={`${formatCompanyNumber(companySettings, financialSummary.outstandingInvoicesCount)} فواتير مفتوحة`} icon={WalletCards} accent="amber" />
      </ResponsiveCardGrid>

      {/* Related properties */}
      <Card>
        <CardHeader>
          <CardTitle>العقارات المرتبطة</CardTitle>
          <CardDescription>العلاقات النشطة فقط، مع عدد الوحدات والعقود لكل عقار.</CardDescription>
        </CardHeader>
        <CardContent>
          <EntityTable
            aria-label="جدول عقارات المالك"
            rows={properties}
            columns={[
              // The register itself is the navigation affordance (row click on desktop,
              // the primary button on the mobile card). Rendering an inner <Link> here
              // would nest interactive controls inside the mobile card's button
              // (invalid HTML, duplicate focus stops) and shrink the target below the
              // 44px floor, so the identity cell is plain text like every other register.
              { key: 'title', header: 'العقار', render: (property) => <span className="font-semibold text-primary">{property.title}</span> },
              { key: 'address', header: 'العنوان', render: (property) => property.address ?? '—' },
              { key: 'ownership', header: 'نسبة الملكية', render: (property) => {
                const pct = property.property_owners.find((link) => link.owner_id === owner.id && !link.ends_on)?.ownership_percentage ?? 100;
                return `${formatCompanyNumber(companySettings, pct)}%`;
              }},
              { key: 'units', header: 'الوحدات', render: (property) => formatCompanyNumber(companySettings, units.filter((unit) => unit.property_id === property.id).length) },
              { key: 'active_contracts', header: 'العقود النشطة', render: (property) => formatCompanyNumber(companySettings, contracts.filter((contract) => contract.property_id === property.id && contract.status === 'active').length) },
              { key: 'status', header: 'الحالة', render: (property) => property.status },
            ]}
            keyOf={(property) => property.id}
            emptyTitle="لا توجد عقارات مرتبطة"
            emptyDescription="لا توجد علاقة ملكية نشطة موثقة لهذا المالك. يمكنك ربط المالك بعقار من صفحة العقارات."
            onRowClick={(property) => dialogNavigate({ to: '/properties/$propertyId', params: { propertyId: property.id } })}
          />
        </CardContent>
      </Card>

      {/* Related units */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DoorOpen className="size-5 text-primary" aria-hidden="true" />الوحدات المرتبطة</CardTitle>
          <CardDescription>ملخص الوحدات عبر عقارات المالك، مع قائمة الوحدات المسجلة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ownerUnitCount === 0 ? (
            <p className="text-sm font-semibold text-muted-foreground">لا توجد وحدات مسجلة عبر عقارات هذا المالك.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="info">{formatCompanyNumber(companySettings, occupiedUnits)} مشغولة</StatusBadge>
                <StatusBadge tone="info">{formatCompanyNumber(companySettings, availableUnits)} متاحة</StatusBadge>
                {maintenanceUnits > 0 ? <StatusBadge tone="warning">{formatCompanyNumber(companySettings, maintenanceUnits)} صيانة</StatusBadge> : null}
                {reservedUnits > 0 ? <StatusBadge tone="warning">{formatCompanyNumber(companySettings, reservedUnits)} محجوزة</StatusBadge> : null}
              </div>
              <ul className="space-y-2" aria-label="قائمة وحدات المالك">
                {units.slice(0, 12).map((unit) => (
                  <li key={unit.id}>
                    <button
                      type="button"
                      onClick={() => dialogNavigate({
                        to: '/properties/$propertyId/units/$unitId',
                        params: { propertyId: unit.property_id, unitId: unit.id },
                      })}
                      className="flex min-h-11 w-full flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-start text-sm transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                    >
                      <span className="font-bold">وحدة {unit.unit_number}</span>
                      <span className="text-xs text-muted-foreground">{propertyTitleById.get(unit.property_id) ?? 'عقار غير محدد'}{unit.floor ? ` · الدور ${unit.floor}` : ''}</span>
                      <span className="ms-auto flex items-center gap-2">
                        <StatusBadge tone={unitStatusTone(unit.status)}>{unitStatusLabels[unit.status] ?? unit.status}</StatusBadge>
                        <span className="text-xs font-semibold tabular-nums" dir="ltr">{formatCompanyMoney(companySettings, unit.rent_amount)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {units.length > 12 ? (
                <p className="text-xs text-muted-foreground">تُعرض أول 12 وحدة — افتح العقار لاستعراض باقي الوحدات.</p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* Contracts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" aria-hidden="true" />العقود المرتبطة</CardTitle>
          <CardDescription>عقود الإيجار عبر عقارات المالك مع الحالة والفترة.</CardDescription>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <p className="text-sm font-semibold text-muted-foreground">لا توجد عقود مسجلة عبر عقارات هذا المالك.</p>
          ) : (
            <ul className="space-y-2" aria-label="قائمة عقود المالك">
              {contracts.slice(0, 10).map((contract) => {
                const unitId = contract.unit_id ?? '';
                const unitPropertyId = unitPropertyIdById.get(unitId) ?? contract.property_id;
                return (
                  <li key={contract.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{businessReferenceOrLabel(contract, 'عقد مسجل')}</span>
                        <StatusBadge tone={contract.status === 'active' ? 'success' : 'neutral'}>{contract.status === 'active' ? 'نشط' : contract.status}</StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {propertyTitleById.get(contract.property_id) ?? 'عقار غير محدد'}
                        {unitNumberById.has(unitId) ? ` · وحدة ${unitNumberById.get(unitId)}` : ''}
                        {' · '}
                        <span dir="ltr">{formatCompanyDate(companySettings, contract.start_date)} → {formatCompanyDate(companySettings, contract.end_date)}</span>
                      </p>
                    </div>
                    <Button variant="secondary" className="min-h-11" onClick={() => dialogNavigate({ to: '/contracts/$contractId', params: { contractId: contract.id } })}>
                      فتح العقد
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          {contracts.length > 10 ? (
            <p className="mt-2 text-xs text-muted-foreground">تُعرض أحدث 10 عقود — افتح العقار لاستعراض السجل الكامل.</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Financial context — tenant receivables, never presented as owner balance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ReceiptText className="size-5 text-primary" aria-hidden="true" />فواتير المستأجرين على العقارات</CardTitle>
          <CardDescription>المبالغ المتبقية على فواتير مستأجرين عبر عقارات المالك — لا تمثل رصيداً مستحقاً للمالك؛ صافي التسوية المستحق للمالك يُعرض في قسم تسويات المالك.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="info">{formatCompanyNumber(companySettings, openInvoices.length)} فواتير مفتوحة</StatusBadge>
            <StatusBadge tone={financialSummary.outstandingBalance > 0 ? 'warning' : 'success'}>
              إجمالي المتبقي على المستأجرين: {formatCompanyMoney(companySettings, financialSummary.outstandingBalance)}
            </StatusBadge>
          </div>
          {openInvoices.length === 0 ? (
            <p className="text-sm font-semibold text-muted-foreground">لا توجد فواتير مفتوحة على هذا المالك.</p>
          ) : (
            <ul className="space-y-2" aria-label="فواتير المالك المفتوحة">
              {openInvoices.slice(0, 8).map((invoice) => (
                <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-sm">
                  <span className="min-w-0 font-bold">{businessReferenceOrLabel(invoice, 'فاتورة مسجلة')}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={invoiceStatusTone(invoice.status)}>{invoiceStatusLabels[invoice.status] ?? invoice.status}</StatusBadge>
                    <span className="font-semibold tabular-nums" dir="ltr">{formatCompanyMoney(companySettings, getInvoiceRemaining(invoice))}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Settlements */}
      {settlements !== undefined ? (
        <Card>
          <CardHeader className="gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><HandCoins className="size-6" aria-hidden="true" /></div>
            <CardTitle className="text-base">تسويات المالك</CardTitle>
            <CardDescription>أحدث التسويات المعدة لهذا المالك عبر كل عقاراته.</CardDescription>
            {canOpenOwnerSettlements ? (
              <Button variant="secondary" className="min-h-11" asChild>
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
                      <span className="font-bold tabular-nums" title="الصافي المستحق للمالك" dir="ltr">
                        {formatCompanyMoney(companySettings, settlement.net_payable_amount)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {settlements.length > 5 && canOpenOwnerSettlements ? (
              <p className="mt-2 text-xs text-muted-foreground">
                تُعرض أحدث 5 تسويات — افتح مساحة التسويات لاستعراض السجل الكامل.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Activity (real audit source) */}
      {activity !== undefined ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="size-5 text-primary" aria-hidden="true" />آخر النشاط</CardTitle>
            <CardDescription>أحداث الحوكمة الموثقة المرتبطة بملف المالك.</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm font-semibold text-muted-foreground">لا يوجد نشاط موثق مرتبط بهذا المالك بعد.</p>
            ) : (
              <ul className="space-y-2" aria-label="سجل نشاط المالك">
                {activity.slice(0, 8).map((record) => (
                  <li key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="font-bold">{record.action}</span>
                      {record.description ? <span className="ms-2 text-xs text-muted-foreground">{record.description}</span> : null}
                    </span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground" dir="ltr">{record.occurredAt.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Documents */}
      <ContextualDocumentsSection entityType="owner" entityId={owner.id} entityLabel="المالك" />
    </div>
  );
}
