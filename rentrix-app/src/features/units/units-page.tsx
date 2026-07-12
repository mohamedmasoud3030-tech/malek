import { Link, useNavigate } from '@tanstack/react-router';
import { Building2, DoorOpen, Edit, Home } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { RouteLoadingState } from '@/components/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable } from '@/components/ui/data-table';
import { MobileCard } from '@/components/ui/mobile-card';
import { FilterBar } from '@/components/ui/filter-bar';
import { useProperties } from '@/features/properties/use-properties';
import { formatMoney, formatNumber } from '@/hooks/useCompanyFormatters';
import type { Property, Unit } from '@/types/domain';
import { normalizeUnitStatus, unitStatusLabels, unitStatusValues, type UnitStatus } from './unit-schema';
import { UnitFormModal } from './unit-form-modal';
import { useAllUnits } from './use-units';

type OccupancyFilter = 'all' | 'occupied' | 'open';

const unitStatusTone: Record<UnitStatus, 'green' | 'blue' | 'gold' | 'gray'> = {
  available: 'green',
  occupied: 'blue',
  maintenance: 'gold',
  reserved: 'gray',
};

export function getUnitPageStatus(unit: Pick<Unit, 'status'>): UnitStatus {
  return normalizeUnitStatus(String(unit.status));
}

export function summarizeUnitsForUnitsPage(units: Unit[]) {
  return {
    occupiedCount: units.filter((unit) => getUnitPageStatus(unit) === 'occupied').length,
    availableCount: units.filter((unit) => getUnitPageStatus(unit) === 'available').length,
    expectedRent: units.reduce((total, unit) => total + (unit.rent_amount ?? 0), 0),
  };
}

function buildPropertyMap(properties: Property[]) {
  return new Map(properties.map((property) => [property.id, property]));
}

export function UnitsPage() {
  const unitsQuery = useAllUnits();
  const propertiesQuery = useProperties({ page: 1, pageSize: 500, search: '', status: 'all' });
  const [search, setSearch] = useState('');
  const [propertyId, setPropertyId] = useState('all');
  const [status, setStatus] = useState<'all' | UnitStatus>('all');
  const [occupancy, setOccupancy] = useState<OccupancyFilter>('all');
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const navigate = useNavigate();

  const units = unitsQuery.data ?? [];
  const properties = propertiesQuery.data?.rows ?? [];
  const propertyById = useMemo(() => buildPropertyMap(properties), [properties]);

  const filteredUnits = useMemo(() => units.filter((unit) => {
    const unitStatus = getUnitPageStatus(unit);
    const property = propertyById.get(unit.property_id);
    const haystack = `${unit.unit_number} ${unit.floor ?? ''} ${unit.notes ?? ''} ${property?.title ?? ''}`.toLowerCase();
    const matchesSearch = deferredSearch.length === 0 || haystack.includes(deferredSearch);
    const matchesProperty = propertyId === 'all' || unit.property_id === propertyId;
    const matchesStatus = status === 'all' || unitStatus === status;
    const matchesOccupancy = occupancy === 'all' || (occupancy === 'occupied' ? unitStatus === 'occupied' : unitStatus !== 'occupied');
    return matchesSearch && matchesProperty && matchesStatus && matchesOccupancy;
  }), [deferredSearch, occupancy, propertyById, propertyId, status, units]);

  if (unitsQuery.isLoading && propertiesQuery.isLoading) return <RouteLoadingState />;

  const { occupiedCount, availableCount, expectedRent } = summarizeUnitsForUnitsPage(units);

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="الوحدات"
        description="عرض تشغيلي لكل الوحدات المسجلة مع روابط مباشرة للعقارات، مع إبقاء إضافة وتعديل الوحدات داخل صفحة العقار المرتبط."
        action={<Button asChild><Link to="/properties"><Building2 className="me-2 size-4" />العقارات</Link></Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="إجمالي الوحدات" value={formatNumber(units.length)} sub="كل الوحدات النشطة" icon={DoorOpen} accent="primary" />
        <KpiCard label="الوحدات المشغولة" value={formatNumber(occupiedCount)} sub="حسب حالة الوحدة" icon={Home} accent="sky" />
        <KpiCard label="الوحدات المتاحة" value={formatNumber(availableCount)} sub="جاهزة للتأجير" icon={DoorOpen} accent="emerald" />
        <KpiCard label="إجمالي الإيجار المتوقع" value={formatMoney(expectedRent)} sub="من قيم الإيجار المسجلة" icon={Building2} accent="amber" />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="رقم الوحدة، الدور، العقار"
        searchAriaLabel="بحث في الوحدات"
        filters={(
          <>
            <label className="min-w-0 flex-1 space-y-1 text-sm font-bold sm:min-w-36">
              <span className="sr-only">العقار</span>
              <Select aria-label="العقار" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
                <option value="all">كل العقارات</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
              </Select>
            </label>
            <label className="min-w-0 flex-1 space-y-1 text-sm font-bold sm:min-w-32">
              <span className="sr-only">الحالة</span>
              <Select aria-label="الحالة" value={status} onChange={(event) => setStatus(event.target.value as 'all' | UnitStatus)}>
                <option value="all">كل الحالات</option>
                {unitStatusValues.map((value) => <option key={value} value={value}>{unitStatusLabels[value]}</option>)}
              </Select>
            </label>
            <label className="min-w-0 flex-1 space-y-1 text-sm font-bold sm:min-w-32">
              <span className="sr-only">الإشغال</span>
              <Select aria-label="الإشغال" value={occupancy} onChange={(event) => setOccupancy(event.target.value as OccupancyFilter)}>
                <option value="all">كل الوحدات</option>
                <option value="occupied">مشغولة فقط</option>
                <option value="open">غير مشغولة</option>
              </Select>
            </label>
          </>
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle>سجل الوحدات</CardTitle>
          <CardDescription>{formatNumber(filteredUnits.length)} وحدة ضمن الفلاتر الحالية.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            aria-label="جدول الوحدات"
            rows={filteredUnits}
            columns={[
              { key: 'unit_number', header: 'الوحدة', render: (unit) => <span className="font-black">{unit.unit_number}</span> },
              { key: 'property', header: 'العقار', render: (unit) => {
                const property = propertyById.get(unit.property_id);
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
                return <StatusBadge tone={unitStatusTone[unitStatus]}>{unitStatusLabels[unitStatus]}</StatusBadge>;
              }},
              { key: 'rent', header: 'الإيجار', render: (unit) => <span dir="ltr" className="block font-bold">{formatMoney(unit.rent_amount)}</span> },
              { key: 'notes', header: 'ملاحظات', render: (unit) => unit.notes ?? '—' },
              { key: 'action', header: 'إجراء', render: (unit) => (
                <div className="flex gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                  <Button variant="secondary" onClick={() => setEditingUnit(unit)}>
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
            onRowClick={(unit) => navigate({
              to: '/properties/$propertyId/units/$unitId',
              params: { propertyId: unit.property_id, unitId: unit.id },
            })}
            renderMobileCard={(unit) => {
              const property = propertyById.get(unit.property_id);
              const unitStatus = getUnitPageStatus(unit);
              return (
                <MobileCard
                  title={`وحدة ${unit.unit_number}`}
                  subtitle={property ? `${property.title}${unit.floor ? ` · الدور ${unit.floor}` : ''}` : (unit.floor ? `الدور: ${unit.floor}` : 'العقار غير محدد')}
                  badge={<StatusBadge tone={unitStatusTone[unitStatus]} className="shrink-0">{unitStatusLabels[unitStatus]}</StatusBadge>}
                  stats={(
                    <div className="flex items-center justify-between gap-3">
                      {unit.notes ? <p className="min-w-0 flex-1 truncate text-xs leading-relaxed text-muted-foreground">{unit.notes}</p> : <span className="text-xs text-muted-foreground">بدون ملاحظات</span>}
                      {unit.rent_amount != null ? <p className="shrink-0 whitespace-nowrap text-sm font-black text-emerald-600 dark:text-emerald-400">{formatMoney(unit.rent_amount)}</p> : null}
                    </div>
                  )}
                  onClick={() => navigate({
                    to: '/properties/$propertyId/units/$unitId',
                    params: { propertyId: unit.property_id, unitId: unit.id },
                  })}
                  actions={(
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="min-h-11" onClick={(event) => { event.stopPropagation(); setEditingUnit(unit); }}>
                        <Edit className="me-1 size-4" aria-hidden="true" />
                        تعديل
                      </Button>
                      <Button variant="ghost" className="min-h-11" asChild>
                        <Link to="/properties/$propertyId/units/$unitId" params={{ propertyId: unit.property_id, unitId: unit.id }}>
                          التفاصيل
                        </Link>
                      </Button>
                    </div>
                  )}
                />
              );
            }}
            keyOf={(unit) => unit.id}
            isLoading={unitsQuery.isLoading || propertiesQuery.isLoading}
            error={(unitsQuery.isError || propertiesQuery.isError) ? new Error('تعذر تحميل الوحدات') : null}
            errorTitle="تعذر تحميل الوحدات"
            onRetry={() => { unitsQuery.refetch(); propertiesQuery.refetch(); }}
            emptyTitle="لا توجد وحدات مطابقة"
            emptyDescription="غيّر البحث أو الفلاتر لعرض وحدات أخرى، أو أضف وحدة من صفحة العقار المرتبط."
            emptyAction={<Button asChild><Link to="/properties">فتح العقارات</Link></Button>}
          />
        </CardContent>
      </Card>

      <UnitFormModal
        propertyId={editingUnit?.property_id ?? ''}
        unit={editingUnit}
        open={editingUnit !== null}
        onOpenChange={(open) => { if (!open) setEditingUnit(null); }}
      />
    </PageLayout>
  );
}
