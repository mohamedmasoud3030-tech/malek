/**
 * Command center — property health.
 *
 * A transparent, deterministic read of which properties need intervention.
 * There is deliberately NO opaque 0–100 score: every classification below is
 * explainable from the metrics shown next to it, and all inputs are reads the
 * dashboard already performs (unit register, shared vacancy derivation,
 * complete maintenance read, property titles).
 *
 * Occupancy here is the unit-status truth already used by the occupancy KPI;
 * vacancy age comes from the shared vacancy derivation; maintenance pressure
 * comes from the complete maintenance register read.
 */
import type { Unit } from '@/types/domain';
import type { Maintenance } from '@/features/maintenance/maintenance-service';
import type { VacantUnitAnalyticsRow } from '@/features/units/vacancy-analytics';
import { normalizeMaintenancePriority, normalizeMaintenanceStatus } from '@/lib/maintenanceStatus';

export type PropertyHealthStatus = 'good' | 'watch' | 'critical';

export const propertyHealthLabels: Record<PropertyHealthStatus, string> = {
  good: 'جيد',
  watch: 'يحتاج متابعة',
  critical: 'يحتاج تدخل',
};

/** Documented thresholds — the whole classification logic. */
export const PROPERTY_HEALTH_THRESHOLDS = {
  /** Below this occupancy a property needs intervention. */
  criticalOccupancyBelow: 80,
  /** A vacancy at or beyond this age needs intervention. */
  criticalVacancyDays: 60,
} as const;

export type PropertyHealthRow = Readonly<{
  propertyId: string;
  title: string;
  status: PropertyHealthStatus;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  longestVacancyDays: number;
  openMaintenance: number;
  urgentMaintenance: number;
}>;

function normalizeUnitStatus(status: unknown): string {
  const normalized = String(status ?? '').trim().toLowerCase();
  return normalized === 'rented' ? 'occupied' : normalized;
}

export function classifyPropertyHealth(row: Omit<PropertyHealthRow, 'status'>): PropertyHealthStatus {
  const { criticalOccupancyBelow, criticalVacancyDays } = PROPERTY_HEALTH_THRESHOLDS;
  if (
    row.occupancyRate < criticalOccupancyBelow
    || row.longestVacancyDays >= criticalVacancyDays
    || row.urgentMaintenance > 0
  ) {
    return 'critical';
  }
  if (row.vacantUnits > 0 || row.openMaintenance > 0 || row.occupancyRate < 100) {
    return 'watch';
  }
  return 'good';
}

const statusRank: Record<PropertyHealthStatus, number> = {
  critical: 0,
  watch: 1,
  good: 2,
};

/**
 * Builds per-property health rows. Only properties with at least one unit are
 * included — an empty lot has no occupancy health to report here.
 */
export function buildPropertyHealthRows(params: {
  units: readonly Unit[] | undefined;
  vacantRows: readonly VacantUnitAnalyticsRow[] | undefined;
  maintenance: readonly Maintenance[] | undefined;
  propertyTitles: ReadonlyMap<string, string> | undefined;
}): readonly PropertyHealthRow[] {
  const { units, vacantRows, maintenance, propertyTitles } = params;
  const safeUnits = units ?? [];
  if (safeUnits.length === 0) return [];

  type Aggregate = {
    propertyId: string;
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    longestVacancyDays: number;
    openMaintenance: number;
    urgentMaintenance: number;
  };

  const byProperty = new Map<string, Aggregate>();

  for (const unit of safeUnits) {
    const aggregate = byProperty.get(unit.property_id) ?? {
      propertyId: unit.property_id,
      totalUnits: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      longestVacancyDays: 0,
      openMaintenance: 0,
      urgentMaintenance: 0,
    };
    aggregate.totalUnits += 1;
    const status = normalizeUnitStatus(unit.status);
    if (status === 'occupied') aggregate.occupiedUnits += 1;
    else if (status === 'available') aggregate.vacantUnits += 1;
    byProperty.set(unit.property_id, aggregate);
  }

  for (const row of vacantRows ?? []) {
    const aggregate = byProperty.get(row.propertyId);
    if (!aggregate) continue;
    aggregate.longestVacancyDays = Math.max(aggregate.longestVacancyDays, row.daysVacant);
  }

  for (const request of maintenance ?? []) {
    if (!request.property_id) continue;
    const aggregate = byProperty.get(request.property_id);
    if (!aggregate) continue;
    const status = normalizeMaintenanceStatus(request.status);
    if (status !== 'open' && status !== 'in_progress') continue;
    aggregate.openMaintenance += 1;
    if (normalizeMaintenancePriority(request.priority) === 'urgent') aggregate.urgentMaintenance += 1;
  }

  const rows: PropertyHealthRow[] = [];
  for (const aggregate of byProperty.values()) {
    if (aggregate.totalUnits === 0) continue;
    const occupancyRate = Math.round((aggregate.occupiedUnits / aggregate.totalUnits) * 100);
    const base = {
      propertyId: aggregate.propertyId,
      title: propertyTitles?.get(aggregate.propertyId) ?? 'عقار غير محدد',
      totalUnits: aggregate.totalUnits,
      occupiedUnits: aggregate.occupiedUnits,
      vacantUnits: aggregate.vacantUnits,
      occupancyRate,
      longestVacancyDays: aggregate.longestVacancyDays,
      openMaintenance: aggregate.openMaintenance,
      urgentMaintenance: aggregate.urgentMaintenance,
    };
    rows.push({ ...base, status: classifyPropertyHealth(base) });
  }

  rows.sort((a, b) => {
    if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status];
    if (a.occupancyRate !== b.occupancyRate) return a.occupancyRate - b.occupancyRate;
    if (a.longestVacancyDays !== b.longestVacancyDays) return b.longestVacancyDays - a.longestVacancyDays;
    return a.title.localeCompare(b.title, 'ar');
  });

  return rows;
}
