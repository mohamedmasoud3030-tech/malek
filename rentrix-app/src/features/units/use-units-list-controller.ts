import { useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { useProperties } from '@/features/properties/use-properties';
import type { Property, Unit } from '@/types/domain';
import { normalizeUnitStatus, unitStatusLabels, unitStatusValues, type UnitStatus } from './unit-schema';
import { useAllUnits } from './use-units';

type OccupancyFilter = 'all' | 'occupied' | 'open';

export type UnitPageStatus = UnitStatus;

export function getUnitPageStatus(unit: Pick<Unit, 'status'>): UnitPageStatus {
  return normalizeUnitStatus(String(unit.status));
}

/**
 * Pure helper: compute KPI metrics from a list of units.
 */
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

/**
 * Pure helper: build a property lookup map.
 */
function buildPropertyMap(properties: Property[]) {
  return new Map(properties.map((p) => [p.id, p]));
}

const ALL_PROPERTIES_PARAMS = { page: 1, pageSize: 500, search: '', status: 'all' as const };

/**
 * Controller hook for the Units list page.
 * Encapsulates: data fetching, filtering, KPI computation,
 * editing/creating unit modal state, and navigation.
 */
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

  const kpis = useMemo(() => computeUnitKpis(units), [units]);

  const isLoading = unitsQuery.isLoading && propertiesQuery.isLoading;
  const isError = unitsQuery.isError || propertiesQuery.isError;

  const openCreate = () => setIsCreateOpen(true);
  const closeCreate = () => setIsCreateOpen(false);
  const openEdit = (unit: Unit) => setEditingUnit(unit);
  const closeEdit = () => setEditingUnit(null);

  const navigateToUnit = (unit: Unit) => {
    navigate({ to: '/properties/$propertyId/units/$unitId', params: { propertyId: unit.property_id, unitId: unit.id } });
  };

  const navigateToProperty = (propId: string) => {
    navigate({ to: '/properties/$propertyId', params: { propertyId: propId } });
  };

  const refetchAll = () => { unitsQuery.refetch(); propertiesQuery.refetch(); };

  return {
    // Data
    units,
    filteredUnits,
    properties,
    propertyById,
    kpis,
    isLoading,
    isError,

    // Search & filter
    search,
    setSearch,
    propertyId,
    setPropertyId,
    status,
    setStatus,
    occupancy,
    setOccupancy,

    // Unit modal
    editingUnit,
    isCreateOpen,
    openCreate,
    closeCreate,
    openEdit,
    closeEdit,

    // Navigation
    navigateToUnit,
    navigateToProperty,

    // Query
    unitsQuery,
    propertiesQuery,
    refetchAll,

    // Constants
    statusValues: unitStatusValues,
    statusLabels: unitStatusLabels,
  };
}
