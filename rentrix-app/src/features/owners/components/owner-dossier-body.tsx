import { useMemo } from 'react';
import {
  Activity,
  Building2,
  DoorOpen,
  FileText,
  UserRoundCog,
} from 'lucide-react';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { Button } from '@/components/ui/button';
import { DetailFields } from '@/components/ui/detail-fields';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { useDialogNavigate } from '@/app/router/background-location';
import { formatCompanyMoney, formatCompanyNumber, formatCompanyDate } from '@/lib/companyFormatters';
import { businessReferenceOrLabel } from '@/lib/business-reference';
import { getOwnerDisplayName } from '../services/owner-service';
import type { OwnerActivityRecord } from '@/services/owner-workspace-service';
import type { OwnerDetailSnapshot } from '../services/owner-service';
import { OwnerAgreementsSection } from './owner-agreements-section';

export type OwnerDossierSection = 'overview' | 'portfolio' | 'records';

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

export function OwnerDossierBody({
  snapshot,
  activity,
  section,
}: Readonly<{
  snapshot: OwnerDetailSnapshot;
  activity?: readonly OwnerActivityRecord[];
  section?: OwnerDossierSection;
}>) {
  const companySettings = useCompanySettingsContract();
  const dialogNavigate = useDialogNavigate();
  const { owner, properties, units, contracts } = snapshot;

  const activeContracts = contracts.filter((contract) => contract.status === 'active');
  const propertyTitleById = new Map(properties.map((property) => [property.id, property.title ?? 'عقار غير محدد']));
  const unitNumberById = new Map(units.map((unit) => [unit.id, unit.unit_number]));

  const ownerUnitCount = units.length;
  const occupiedUnits = units.filter((unit) => unit.status === 'occupied').length;
  const availableUnits = units.filter((unit) => unit.status === 'available').length;
  const maintenanceUnits = units.filter((unit) => unit.status === 'maintenance').length;
  const reservedUnits = units.filter((unit) => unit.status === 'reserved').length;

  const dossierPropertyColumns: ColumnDef<typeof properties[number]>[] = useMemo(() => [
    { key: 'title', header: 'العقار', priority: 'identity', render: (property) => <span className="font-semibold text-primary">{property.title}</span> },
    { key: 'address', header: 'العنوان', priority: 'secondary', render: (property) => property.address ?? '—' },
    { key: 'ownership', header: 'نسبة الملكية', priority: 'secondary', render: (property) => {
      const pct = property.property_owners.find((link) => link.owner_id === owner.id && !link.ends_on)?.ownership_percentage ?? 100;
      return `${formatCompanyNumber(companySettings, pct)}%`;
    }},
    { key: 'units', header: 'الوحدات', priority: 'detail', render: (property) => formatCompanyNumber(companySettings, units.filter((unit) => unit.property_id === property.id).length) },
    { key: 'active_contracts', header: 'العقود النشطة', priority: 'detail', render: (property) => formatCompanyNumber(companySettings, contracts.filter((contract) => contract.property_id === property.id && contract.status === 'active').length) },
    { key: 'status', header: 'الحالة', priority: 'secondary', render: (property) => property.status },
  ], [owner.id, companySettings, units, contracts]);

  return (
    <div className="space-y-6">
      {(!section || section === 'overview') ? (
        <div className="space-y-5" data-owner-detail-overview>
          <section aria-labelledby="owner-identity-heading">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <UserRoundCog className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 id="owner-identity-heading" className="truncate text-lg font-semibold leading-6 sm:text-xl">{getOwnerDisplayName(owner)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">بيانات التواصل والهوية الأساسية للمالك.</p>
                </div>
              </div>
              <StatusBadge tone={owner.is_active ? 'success' : 'neutral'} dot>
                {owner.is_active ? 'نشط' : 'غير نشط'}
              </StatusBadge>
            </header>
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
          </section>

          <ResponsiveCardGrid>
            <KpiCard label="العقارات" value={formatCompanyNumber(companySettings, properties.length)} icon={Building2} accent="primary" />
            <KpiCard label="الوحدات" value={formatCompanyNumber(companySettings, ownerUnitCount)} icon={DoorOpen} accent="sky" />
            <KpiCard label="العقود النشطة" value={formatCompanyNumber(companySettings, activeContracts.length)} sub={`من أصل ${formatCompanyNumber(companySettings, contracts.length)} عقود`} icon={FileText} accent="emerald" />
          </ResponsiveCardGrid>
        </div>
      ) : null}

      {(!section || section === 'portfolio') ? (
        <div className="space-y-6" data-owner-detail-portfolio>
          <OwnerAgreementsSection ownerId={owner.id} />

          <section aria-labelledby="owner-properties-heading">
            <header className="border-b border-border/60 pb-2.5">
              <h3 id="owner-properties-heading" className="text-base font-black">العقارات المرتبطة</h3>
              <p className="mt-1 text-sm text-muted-foreground">العلاقات النشطة فقط، مع عدد الوحدات والعقود لكل عقار.</p>
            </header>
            <div className="pt-3">
              <EntityTable
                aria-label="جدول عقارات المالك"
                rows={properties}
                columns={dossierPropertyColumns}
                keyOf={(property) => property.id}
                emptyTitle="لا توجد عقارات مرتبطة"
                emptyDescription="لا توجد علاقة ملكية نشطة موثقة لهذا المالك. يمكنك ربط المالك بعقار من صفحة العقارات."
                onRowClick={(property) => dialogNavigate({ to: '/properties/$propertyId', params: { propertyId: property.id } })}
                mobileSummaryKeys={['address', 'ownership', 'units', 'active_contracts']}
              />
            </div>
          </section>

          <section className="border-t border-border/60 pt-4" aria-labelledby="owner-units-heading">
            <header className="border-b border-border/60 pb-2.5">
              <h3 id="owner-units-heading" className="flex items-center gap-2 text-base font-black"><DoorOpen className="size-5 text-primary" aria-hidden="true" />الوحدات المرتبطة</h3>
              <p className="mt-1 text-sm text-muted-foreground">ملخص الوحدات عبر عقارات المالك، مع قائمة الوحدات المسجلة.</p>
            </header>
            {ownerUnitCount === 0 ? (
              <p className="py-4 text-sm font-semibold text-muted-foreground">لا توجد وحدات مسجلة عبر عقارات هذا المالك.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 py-3">
                  <StatusBadge tone="info">{formatCompanyNumber(companySettings, occupiedUnits)} مشغولة</StatusBadge>
                  <StatusBadge tone="info">{formatCompanyNumber(companySettings, availableUnits)} متاحة</StatusBadge>
                  {maintenanceUnits > 0 ? <StatusBadge tone="warning">{formatCompanyNumber(companySettings, maintenanceUnits)} صيانة</StatusBadge> : null}
                  {reservedUnits > 0 ? <StatusBadge tone="warning">{formatCompanyNumber(companySettings, reservedUnits)} محجوزة</StatusBadge> : null}
                </div>
                <ul className="divide-y divide-border/60" aria-label="قائمة وحدات المالك">
                  {units.slice(0, 12).map((unit) => (
                    <li key={unit.id}>
                      <button
                        type="button"
                        onClick={() => dialogNavigate({
                          to: '/properties/$propertyId/units/$unitId',
                          params: { propertyId: unit.property_id, unitId: unit.id },
                        })}
                        className="flex min-h-11 w-full flex-wrap items-center gap-2 py-3 text-start text-sm transition hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
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
                  <p className="mt-2 text-xs text-muted-foreground">تُعرض أول 12 وحدة — افتح العقار لاستعراض باقي الوحدات.</p>
                ) : null}
              </>
            )}
          </section>

          <section className="border-t border-border/60 pt-4" aria-labelledby="owner-contracts-heading">
            <header className="border-b border-border/60 pb-2.5">
              <h3 id="owner-contracts-heading" className="flex items-center gap-2 text-base font-black"><FileText className="size-5 text-primary" aria-hidden="true" />العقود المرتبطة</h3>
              <p className="mt-1 text-sm text-muted-foreground">عقود الإيجار عبر عقارات المالك مع الحالة والفترة.</p>
            </header>
            {contracts.length === 0 ? (
              <p className="py-4 text-sm font-semibold text-muted-foreground">لا توجد عقود مسجلة عبر عقارات هذا المالك.</p>
            ) : (
              <ul className="divide-y divide-border/60" aria-label="قائمة عقود المالك">
                {contracts.slice(0, 10).map((contract) => {
                  const unitId = contract.unit_id ?? '';
                  return (
                    <li key={contract.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{businessReferenceOrLabel(contract, 'عقد مسجل')}</span>
                          <StatusBadge tone={contract.status === 'active' ? 'success' : 'neutral'}>{contract.status === 'active' ? 'نشط' : contract.status}</StatusBadge>
                        </div>
                        <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                          {propertyTitleById.get(contract.property_id) ?? 'عقار غير محدد'}
                          {unitNumberById.has(unitId) ? ` · وحدة ${unitNumberById.get(unitId)}` : ''}
                          {' · '}
                          <span dir="ltr">{formatCompanyDate(companySettings, contract.start_date)} → {formatCompanyDate(companySettings, contract.end_date)}</span>
                        </p>
                      </div>
                      <Button variant="secondary" className="min-h-11 shrink-0" onClick={() => dialogNavigate({ to: '/contracts/$contractId', params: { contractId: contract.id } })}>
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
          </section>
        </div>
      ) : null}

      {(!section || section === 'records') ? (
        <div className="space-y-5" data-owner-detail-records>
          {activity !== undefined ? (
            <section aria-labelledby="owner-activity-heading">
              <header className="border-b border-border/60 pb-2.5">
                <h3 id="owner-activity-heading" className="flex items-center gap-2 text-base font-black"><Activity className="size-5 text-primary" aria-hidden="true" />آخر النشاط</h3>
                <p className="mt-1 text-sm text-muted-foreground">أحداث الحوكمة الموثقة المرتبطة بملف المالك.</p>
              </header>
              {activity.length === 0 ? (
                <p className="py-4 text-sm font-semibold text-muted-foreground">لا يوجد نشاط موثق مرتبط بهذا المالك بعد.</p>
              ) : (
                <ul className="divide-y divide-border/60" aria-label="سجل نشاط المالك">
                  {activity.slice(0, 8).map((record) => (
                    <li key={record.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                      <span className="min-w-0">
                        <span className="font-bold">{record.action}</span>
                        {record.description ? <span className="ms-2 text-xs text-muted-foreground">{record.description}</span> : null}
                      </span>
                      <span className="whitespace-nowrap text-xs text-muted-foreground" dir="ltr">{record.occurredAt.slice(0, 10)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          <div className="border-t border-border/60 pt-4">
            <ContextualDocumentsSection entityType="owner" entityId={owner.id} entityLabel="المالك" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
