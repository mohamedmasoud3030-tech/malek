import { useDeferredValue, useMemo, useState } from 'react';
import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { useNavigate } from '@tanstack/react-router';
import { useProperties } from '@/features/properties/use-properties';
import type { Property, Unit } from '@/types/domain';
import { normalizeUnitStatus, unitStatusLabels, unitStatusValues, type UnitStatus } from './unit-schema';
import { useAllUnits } from './use-units';

type OccupancyFilter = 'all' | 'occupied' | 'open';

export type UnitPageStatus = UnitStatus;

export function getUnitPageStatus(unit: Pick<Unit, 'status'>): UnitPageStatus {
  return normalizeUnitStatus(String(unit.status));
}

export function computeUnitKpis(units: Unit[]) {
  let occupiedCount = 0;
  let availableCount = 0;
  let expectedRent = 0;
  for (const unit of units) {
    const status = getUnitPageStatus(unit);
    if (status === 'occupied') occupiedCount++;
    if (status === 'available') availableCount++;
    expectedRent += unit.rent_amount ?? 0;
  }
  return { occupiedCount, availableCount, expectedRent };
}

function buildPropertyMap(properties: Property[]) {
  return new Map(properties.map((p) => [p.id, p]));
}

const ALL_PROPERTIES_PARAMS = { page: 1, pageSize: 500, search: '', status: 'all' as const };

export function useUnitsListController() {
  const unitsQuery = useAllUnits();
  const propertiesQuery = useProperties(ALL_PROPERTIES_PARAMS);

  const [search, setSearch] = useState('');
  const [propertyId, setPropertyId] = useState('all');
  const [status, setStatus] = useState<'all' | UnitStatus>('all');
  const [occupancy, setOccupancy] = useState<OccupancyFilter>('all');
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
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

  const kpis = useMemo(() => computeUnitKpis(units), [units]);

  // Canonical register filter language: every active narrowing surfaces once
  // as a removable chip and a single Clear All, exactly like Properties.
  const hasFilterValues = search.trim().length > 0 || propertyId !== 'all' || status !== 'all' || occupancy !== 'all';
  const activeFilters = useMemo((): ActiveFilterItem[] => [
    ...(search.trim()
      ? [{ key: 'search', label: 'بحث', value: search.trim(), onRemove: () => setSearch('') }]
      : []),
    ...(propertyId !== 'all'
      ? [{ key: 'property', label: 'العقار', value: propertyById.get(propertyId)?.title ?? 'عقار محدد', onRemove: () => setPropertyId('all') }]
      : []),
    ...(status !== 'all'
      ? [{ key: 'status', label: 'الحالة', value: unitStatusLabels[status as UnitStatus], onRemove: () => setStatus('all') }]
      : []),
    ...(occupancy !== 'all'
      ? [{ key: 'occupancy', label: 'الإشغال', value: occupancy === 'occupied' ? 'مشغولة فقط' : 'غير مشغولة', onRemove: () => setOccupancy('all') }]
      : []),
  ], [occupancy, propertyById, propertyId, search, status]);
  const clearFilters = () => { setSearch(''); setPropertyId('all'); setStatus('all'); setOccupancy('all'); };

  const isLoading = unitsQuery.isLoading && propertiesQuery.isLoading;
  const isError = unitsQuery.isError || propertiesQuery.isError;

  const openCreate = () => setIsCreateOpen(true);
  const closeCreate = () => setIsCreateOpen(false);
  const openEdit = (unit: Unit) => setEditingUnit(unit);
  const closeEdit = () => setEditingUnit(null);
  const navigate = useNavigate();
  const navigateToUnit = (unit: Unit) =>
    void navigate({
      to: '/properties/$propertyId/units/$unitId',
      params: { propertyId: unit.property_id, unitId: unit.id },
    });
  const refetchAll = () => { unitsQuery.refetch(); propertiesQuery.refetch(); };

  return {
    units,
    filteredUnits,
    properties,
    propertyById,
    kpis,
    isLoading,
    isError,
    search,
    setSearch,
    propertyId,
    setPropertyId,
    status,
    setStatus,
    occupancy,
    setOccupancy,
    editingUnit,
    isCreateOpen,
    openCreate,
    closeCreate,
    openEdit,
    closeEdit,
    navigateToUnit,
    unitsQuery,
    propertiesQuery,
    refetchAll,
    hasFilterValues,
    activeFilters,
    clearFilters,
    statusValues: unitStatusValues,
    statusLabels: unitStatusLabels,
  };
}
