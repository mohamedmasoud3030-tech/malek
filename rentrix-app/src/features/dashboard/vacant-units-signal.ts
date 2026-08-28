/**
 * P3 — Today: vacant and out-of-service units signal.
 *
 * Today already received a server-authoritative vacant *count*
 * (`occupancy.vacant_units`) but never said **which** units, and units parked
 * in maintenance — an operational problem, not an opportunity — were invisible
 * entirely. This module turns the canonical units read into bounded
 * presentation rows plus the counts that have no server-side equivalent.
 *
 * Authority discipline:
 * - the vacant KPI stays the server snapshot number; this module never
 *   overrides it with a browser count;
 * - `listUnits` pages through every row and fails closed on truncation
 *   (`fetchAllRows`), so the out-of-service counts below are complete-set
 *   aggregates rather than a capped prefix;
 * - reference rent stays labelled as reference context; contract price
 *   governs and is not recomputed here.
 */
import type { Unit } from '@/types/domain';
import type { UnitStatus } from '@/features/units/unit-schema';

/** Bounded presentation rows for the Today queue card. Never a KPI source. */
export const VACANT_UNITS_ROW_LIMIT = 4;

export type VacantUnitAttentionStatus = Extract<UnitStatus, 'available' | 'maintenance' | 'reserved'>;

export type VacantUnitRow = Readonly<{
  unitId: string;
  propertyId: string;
  title: string;
  location: string;
  status: VacantUnitAttentionStatus;
  statusLabel: string;
  /** Reference rent only — the contract price governs actual revenue. */
  referenceRent: number | null;
}>;

export type VacantUnitsSignal = Readonly<{
  /** Units free to re-let (status `available`). */
  availableCount: number;
  /** Units withdrawn from letting because of a problem (status `maintenance`). */
  outOfServiceCount: number;
  /** Held units awaiting contract completion (status `reserved`). */
  reservedCount: number;
  /** Everything above: the units that are not currently earning. */
  attentionCount: number;
  rows: readonly VacantUnitRow[];
}>;

export const EMPTY_VACANT_UNITS_SIGNAL: VacantUnitsSignal = {
  availableCount: 0,
  outOfServiceCount: 0,
  reservedCount: 0,
  attentionCount: 0,
  rows: [],
};

export const vacantUnitStatusLabels: Record<VacantUnitAttentionStatus, string> = {
  available: 'شاغرة',
  maintenance: 'متوقفة للصيانة',
  reserved: 'محجوزة',
};

/** Out-of-service first (a problem), then vacant (an opportunity), then held. */
const statusRank: Record<VacantUnitAttentionStatus, number> = {
  maintenance: 0,
  available: 1,
  reserved: 2,
};

function isAttentionStatus(status: string): status is VacantUnitAttentionStatus {
  return status === 'available' || status === 'maintenance' || status === 'reserved';
}

function toReferenceRent(value: unknown): number | null {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function buildVacantUnitsSignal(
  units: readonly Unit[] | undefined,
  propertyTitles: ReadonlyMap<string, string> | undefined,
  rowLimit = VACANT_UNITS_ROW_LIMIT,
): VacantUnitsSignal {
  if (!units || units.length === 0) return EMPTY_VACANT_UNITS_SIGNAL;

  const attentionUnits = units.filter((unit) => isAttentionStatus(String(unit.status)));
  if (attentionUnits.length === 0) return EMPTY_VACANT_UNITS_SIGNAL;

  let availableCount = 0;
  let outOfServiceCount = 0;
  let reservedCount = 0;

  const rows: VacantUnitRow[] = attentionUnits.map((unit) => {
    const status = String(unit.status) as VacantUnitAttentionStatus;
    if (status === 'available') availableCount += 1;
    else if (status === 'maintenance') outOfServiceCount += 1;
    else reservedCount += 1;

    const propertyTitle = propertyTitles?.get(unit.property_id) ?? 'عقار غير محدد';
    return {
      unitId: unit.id,
      propertyId: unit.property_id,
      title: unit.unit_number ? `وحدة ${unit.unit_number}` : 'وحدة بلا رقم',
      location: propertyTitle,
      status,
      statusLabel: vacantUnitStatusLabels[status],
      referenceRent: toReferenceRent((unit as { rent_amount?: unknown }).rent_amount),
    };
  });

  rows.sort((a, b) => {
    if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status];
    if (a.location !== b.location) return a.location.localeCompare(b.location, 'ar');
    return a.title.localeCompare(b.title, 'ar', { numeric: true });
  });

  return {
    availableCount,
    outOfServiceCount,
    reservedCount,
    attentionCount: attentionUnits.length,
    rows: rows.slice(0, Math.max(0, rowLimit)),
  };
}
