import { Link } from '@tanstack/react-router';
import { Building2, DoorOpen, Edit, Home, Plus } from 'lucide-react';
import { useUnitsListController, getUnitPageStatus } from './use-units-list-controller';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { RouteLoadingState } from '@/components/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { EntityTable } from '@/components/ui/entity-table';
import { MobileCard } from '@/components/ui/mobile-card';
import { FilterBar } from '@/components/ui/filter-bar';
import { formatMoney, formatNumber } from '@/hooks/useCompanyFormatters';
import { UnitFormModal } from './unit-form-modal';

const unitStatusTone = { available: 'success', occupied: 'info', maintenance: 'warning', reserved: 'neutral' } as const;

export function UnitsPage() {
  const ctrl = useUnitsListController();

  if (ctrl.isLoading) return <RouteLoadingState />;

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="الوحدات"
        description="عرض تشغيلي لكل الوحدات المسجلة مع تعديل مباشر وروابط تفصيل العقارات."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={ctrl.openCreate}><Plus className="me-2 size-4" />إضافة وحدة</Button>
            <Button asChild variant="secondary"><Link to="/properties"><Building2 className="me-2 size-4" />العقارات</Link></Button>
          </div>
        }
      />

      <ResponsiveCardGrid desktopColumns={4} gap="lg">
        <KpiCard label="إجمالي الوحدات" value={formatNumber(ctrl.units.length)} sub="كل الوحدات النشطة" icon={DoorOpen} />
        <KpiCard label="الوحدات المشغولة" value={formatNumber(ctrl.kpis.occupiedCount)} sub="حسب حالة الوحدة" icon={Home} />
        <KpiCard label="الوحدات المتاحة" value={formatNumber(ctrl.kpis.availableCount)} sub="جاهزة للتأجير" icon={DoorOpen} />
        <KpiCard label="إجمالي الإيجار المتوقع" value={formatMoney(ctrl.kpis.expectedRent)} sub="من قيم الإيجار المسجلة" icon={Building2} />
      </ResponsiveCardGrid>

      <FilterBar
        searchValue={ctrl.search}
        onSearchChange={ctrl.setSearch}
        searchPlaceholder="رقم الوحدة، الدور، العقار"
        searchAriaLabel="بحث في الوحدات"
        filters={
          <>
            <label className="min-w-0 flex-1 space-y-1 text-sm font-bold sm:min-w-36">
              <span className="sr-only">العقار</span>
              <Select aria-label="العقار" value={ctrl.propertyId} onChange={(event) => ctrl.setPropertyId(event.target.value)}>
                <option value="all">كل العقارات</option>
                {ctrl.properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </label>
            <label className="min-w-0 flex-1 space-y-1 text-sm font-bold sm:min-w-32">
              <span className="sr-only">الحالة</span>
              <Select aria-label="الحالة" value={ctrl.status} onChange={(event) => ctrl.setStatus(event.target.value as 'all' | typeof ctrl.status)}>
                <option value="all">كل الحالات</option>
                {ctrl.statusValues.map((v) => <option key={v} value={v}>{ctrl.statusLabels[v]}</option>)}
              </Select>
            </label>
            <label className="min-w-0 flex-1 space-y-1 text-sm font-bold sm:min-w-32">
              <span className="sr-only">الإشغال</span>
              <Select aria-label="الإشغال" value={ctrl.occupancy} onChange={(event) => ctrl.setOccupancy(event.target.value as typeof ctrl.occupancy)}>
                <option value="all">كل الوحدات</option>
                <option value="occupied">مشغولة فقط</option>
                <option value="open">غير مشغولة</option>
              </Select>
            </label>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>سجل الوحدات</CardTitle>
          <CardDescription>{formatNumber(ctrl.filteredUnits.length)} وحدة ضمن الفلاتر الحالية.</CardDescription>
        </CardHeader>
        <CardContent>
          <EntityTable
            aria-label="جدول الوحدات"
            rows={ctrl.filteredUnits}
            columns={[
              { key: 'unit_number', header: 'الوحدة', render: (unit) => <span className="font-bold">{unit.unit_number}</span> },
              { key: 'property', header: 'العقار', render: (unit) => {
                const property = ctrl.propertyById.get(unit.property_id);
                return property ? (
                  <Link
                    className="font-bold text-primary hover:underline"
                    to="/properties/$propertyId"
                    params={{ propertyId: property.id }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {property.title}
                  </Link>
                ) : '—';
              }},
              { key: 'floor', header: 'الدور', render: (unit) => unit.floor ?? '—' },
              { key: 'status', header: 'الحالة', render: (unit) => {
                const unitStatus = getUnitPageStatus(unit);
                return <StatusBadge tone={unitStatusTone[unitStatus]}>{ctrl.statusLabels[unitStatus]}</StatusBadge>;
              }},
              { key: 'rent', header: 'الإيجار', render: (unit) => <span dir="ltr" className="block font-bold">{formatMoney(unit.rent_amount)}</span> },
              { key: 'notes', header: 'ملاحظات', render: (unit) => unit.notes ?? '—' },
              { key: 'action', header: 'إجراء', render: (unit) => (
                <div className="flex gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                  <Button variant="secondary" onClick={() => ctrl.openEdit(unit)}>
                    <Edit className="me-1 size-4" aria-hidden="true" />
                    تعديل
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link to="/properties/$propertyId/units/$unitId" params={{ propertyId: unit.property_id, unitId: unit.id }}>
                      التفاصيل
                    </Link>
                  </Button>
                </div>
              )},
            ]}
            onRowClick={ctrl.navigateToUnit}
            renderMobileCard={(unit) => {
              const property = ctrl.propertyById.get(unit.property_id);
              const unitStatus = getUnitPageStatus(unit);
              return (
                <MobileCard
                  title={`وحدة ${unit.unit_number}`}
                  subtitle={property ? `${property.title}${unit.floor ? ` · الدور ${unit.floor}` : ''}` : (unit.floor ? `الدور: ${unit.floor}` : 'العقار غير محدد')}
                  badge={<StatusBadge tone={unitStatusTone[unitStatus]} className="shrink-0">{ctrl.statusLabels[unitStatus]}</StatusBadge>}
                  stats={
                    <div className="flex items-center justify-between gap-3">
                      {unit.notes ? <p className="min-w-0 flex-1 truncate text-xs leading-relaxed text-muted-foreground">{unit.notes}</p> : <span className="text-xs text-muted-foreground">بدون ملاحظات</span>}
                      {unit.rent_amount != null ? <p className="shrink-0 whitespace-nowrap text-sm font-bold text-success" dir="ltr">{formatMoney(unit.rent_amount)}</p> : null}
                    </div>
                  }
                  onClick={() => ctrl.navigateToUnit(unit)}
                  actions={
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="min-h-11" onClick={(event) => { event.stopPropagation(); ctrl.openEdit(unit); }}>
                        <Edit className="me-1 size-4" aria-hidden="true" />
                        تعديل
                      </Button>
                      <Button variant="ghost" className="min-h-11" asChild>
                        <Link to="/properties/$propertyId/units/$unitId" params={{ propertyId: unit.property_id, unitId: unit.id }}>
                          التفاصيل
                        </Link>
                      </Button>
                    </div>
                  }
                />
              );
            }}
            keyOf={(unit) => unit.id}
            isLoading={ctrl.unitsQuery.isLoading || ctrl.propertiesQuery.isLoading}
            error={ctrl.isError ? new Error('تعذر تحميل الوحدات') : null}
            errorTitle="تعذر تحميل الوحدات"
            onRetry={ctrl.refetchAll}
            emptyTitle="لا توجد وحدات مطابقة"
            emptyDescription="غيّر البحث أو الفلاتر لعرض وحدات أخرى، أو أضف وحدة مرتبطة بعقار قائم."
            emptyAction={<Button onClick={ctrl.openCreate}><Plus className="me-2 size-4" />إضافة وحدة</Button>}
          />
        </CardContent>
      </Card>

      <UnitFormModal
        propertyId=""
        unit={null}
        open={ctrl.isCreateOpen}
        onOpenChange={(open) => { if (!open) ctrl.closeCreate(); }}
      />

      <UnitFormModal
        propertyId={ctrl.editingUnit?.property_id ?? ''}
        unit={ctrl.editingUnit}
        open={ctrl.editingUnit !== null}
        onOpenChange={(open) => { if (!open) ctrl.closeEdit(); }}
      />
    </PageLayout>
  );
}
