import type { ContractListItem } from '@/features/contracts/services/contractService';
import { isContractStatus } from '@/lib/contractStatus';
import type { Unit } from '@/types/domain';

const DAY_MS = 24 * 60 * 60 * 1000;
export const VACANCY_RISK_WINDOW_DAYS = 60;

/**
 * Vacancy aging buckets: presentation grouping over the shared vacancy
 * derivation above. The days-vacant number of each row stays authoritative —
 * bucketing only decides which presentation lane a row sits in.
 */
export type VacancyAgingBucketKey = 'days_0_15' | 'days_16_30' | 'days_31_60' | 'days_61_plus';

export const vacancyAgingBucketOrder: readonly VacancyAgingBucketKey[] = [
  'days_0_15',
  'days_16_30',
  'days_31_60',
  'days_61_plus',
];

export const vacancyAgingBucketLabels: Record<VacancyAgingBucketKey, string> = {
  days_0_15: '0–15 يوم',
  days_16_30: '16–30 يوم',
  days_31_60: '31–60 يوم',
  days_61_plus: '+60 يوم',
};

export function vacancyAgingBucketForDays(daysVacant: number): VacancyAgingBucketKey {
  if (daysVacant <= 15) return 'days_0_15';
  if (daysVacant <= 30) return 'days_16_30';
  if (daysVacant <= 60) return 'days_31_60';
  return 'days_61_plus';
}

export function buildVacancyAgingBuckets(
  vacantRows: readonly VacantUnitAnalyticsRow[],
): Record<VacancyAgingBucketKey, number> {
  const buckets: Record<VacancyAgingBucketKey, number> = {
    days_0_15: 0,
    days_16_30: 0,
    days_31_60: 0,
    days_61_plus: 0,
  };
  for (const row of vacantRows) {
    buckets[vacancyAgingBucketForDays(row.daysVacant)] += 1;
  }
  return buckets;
}

export type VacancySinceSource = 'contract_end' | 'unit_created';

export type VacantUnitAnalyticsRow = Readonly<{
  unitId: string;
  propertyId: string;
  unitNumber: string;
  propertyTitle: string;
  referenceRent: number | null;
  lastContractEndDate: string | null;
  vacancySince: string;
  vacancySinceSource: VacancySinceSource;
  daysVacant: number;
}>;

export type VacancyRiskContractRow = Readonly<{
  contractId: string;
  unitId: string;
  tenantName: string;
  propertyTitle: string;
  unitNumber: string;
  endDate: string;
  daysRemaining: number;
}>;

export type VacancyAnalytics = Readonly<{
  totalUnits: number;
  occupiedUnits: number;
  availableUnits: number;
  nonRentableUnits: number;
  occupancyRate: number;
  vacancyRate: number;
  averageVacancyDays: number;
  referenceVacantRent: number;
  previousMonthOccupancyRate: number;
  occupancyChangePoints: number;
  previousMonthEnd: string;
  vacantRows: readonly VacantUnitAnalyticsRow[];
  vacancyRiskRows: readonly VacancyRiskContractRow[];
}>;

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const dateOnly = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : null;
}

function toUtcTimestamp(dateOnly: string): number {
  return Date.parse(`${dateOnly}T00:00:00.000Z`);
}

function calendarDayDiff(later: string, earlier: string): number {
  return Math.max(0, Math.round((toUtcTimestamp(later) - toUtcTimestamp(earlier)) / DAY_MS));
}

function addDays(dateOnly: string, days: number): string {
  const date = new Date(toUtcTimestamp(dateOnly));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getPreviousMonthEnd(asOf: string): string {
  const [year, month] = asOf.split('-').map(Number);
  const firstOfCurrentMonth = new Date(Date.UTC(year, month - 1, 1));
  firstOfCurrentMonth.setUTCDate(0);
  return firstOfCurrentMonth.toISOString().slice(0, 10);
}

function normalizeUnitStatus(status: unknown): string {
  const normalized = String(status ?? '').trim().toLowerCase();
  return normalized === 'rented' ? 'occupied' : normalized;
}

function referenceRent(value: unknown): number | null {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * A terminated lease stops occupying the unit when it was actually terminated,
 * not at its original contractual end date. `terminate_contract_atomic` updates
 * the row timestamp, so that timestamp is the best existing effective-end
 * authority for terminated rows. Expired/active historical rows keep end_date.
 */
function effectiveContractEnd(contract: ContractListItem): string {
  if (!isContractStatus(contract.status, 'terminated')) return contract.end_date;
  const updatedAt = toDateOnly(contract.updated_at);
  if (!updatedAt) return contract.end_date;
  return updatedAt < contract.end_date ? updatedAt : contract.end_date;
}

function isHistoryContract(contract: ContractListItem): boolean {
  return !isContractStatus(contract.status, 'draft');
}

function contractCoversDate(contract: ContractListItem, date: string): boolean {
  if (!isHistoryContract(contract)) return false;
  return contract.start_date <= date && effectiveContractEnd(contract) >= date;
}

function hasCommittedSuccessor(current: ContractListItem, contracts: readonly ContractListItem[]): boolean {
  if (!current.unit_id) return false;
  const successorCutoff = addDays(current.end_date, 30);

  return contracts.some((candidate) => {
    if (candidate.id === current.id || candidate.unit_id !== current.unit_id || !isHistoryContract(candidate)) return false;
    if (candidate.renewed_from_id === current.id) return true;
    return candidate.start_date > current.end_date && candidate.start_date <= successorCutoff;
  });
}

/**
 * Shared operating derivation for Dashboard + Reports.
 *
 * Truth rules:
 * - vacancy means unit.status === `available` only;
 * - maintenance/reserved units are NOT silently counted as vacant;
 * - days vacant starts at the latest effective contract end, falling back to
 *   the unit creation date for units that have never been leased;
 * - historical occupancy is reconstructed from contract coverage at the end of
 *   the previous month, not from today's unit status;
 * - near-expiry vacancy risk excludes contracts that already have a committed
 *   successor/renewal.
 */
export function buildVacancyAnalytics(
  units: readonly Unit[] | undefined,
  contracts: readonly ContractListItem[] | undefined,
  propertyTitles: ReadonlyMap<string, string> | undefined,
  asOf: string,
): VacancyAnalytics {
  const safeUnits = units ?? [];
  const safeContracts = contracts ?? [];
  const totalUnits = safeUnits.length;
  const previousMonthEnd = getPreviousMonthEnd(asOf);

  const contractsByUnit = new Map<string, ContractListItem[]>();
  for (const contract of safeContracts) {
    if (!contract.unit_id || !isHistoryContract(contract)) continue;
    const current = contractsByUnit.get(contract.unit_id) ?? [];
    current.push(contract);
    contractsByUnit.set(contract.unit_id, current);
  }

  let occupiedUnits = 0;
  let availableUnits = 0;
  let nonRentableUnits = 0;
  let previousMonthOccupied = 0;

  const vacantRows: VacantUnitAnalyticsRow[] = [];

  for (const unit of safeUnits) {
    const status = normalizeUnitStatus(unit.status);
    if (status === 'occupied') occupiedUnits += 1;
    else if (status === 'available') availableUnits += 1;
    else nonRentableUnits += 1;

    const unitContracts = contractsByUnit.get(unit.id) ?? [];
    if (unitContracts.some((contract) => contractCoversDate(contract, previousMonthEnd))) {
      previousMonthOccupied += 1;
    }

    if (status !== 'available') continue;

    const latestEnded = unitContracts
      .map((contract) => ({ contract, effectiveEnd: effectiveContractEnd(contract) }))
      .filter(({ effectiveEnd }) => effectiveEnd <= asOf)
      .sort((a, b) => b.effectiveEnd.localeCompare(a.effectiveEnd))[0];

    const createdAt = toDateOnly(unit.created_at) ?? asOf;
    const vacancySince = latestEnded?.effectiveEnd ?? (createdAt <= asOf ? createdAt : asOf);

    vacantRows.push({
      unitId: unit.id,
      propertyId: unit.property_id,
      unitNumber: unit.unit_number || '—',
      propertyTitle: propertyTitles?.get(unit.property_id) ?? 'عقار غير محدد',
      referenceRent: referenceRent(unit.rent_amount),
      lastContractEndDate: latestEnded?.effectiveEnd ?? null,
      vacancySince,
      vacancySinceSource: latestEnded ? 'contract_end' : 'unit_created',
      daysVacant: calendarDayDiff(asOf, vacancySince),
    });
  }

  vacantRows.sort((a, b) => b.daysVacant - a.daysVacant || a.propertyTitle.localeCompare(b.propertyTitle, 'ar') || a.unitNumber.localeCompare(b.unitNumber, 'ar', { numeric: true }));

  const referenceVacantRent = vacantRows.reduce((total, row) => total + (row.referenceRent ?? 0), 0);
  const averageVacancyDays = vacantRows.length > 0
    ? Math.round(vacantRows.reduce((total, row) => total + row.daysVacant, 0) / vacantRows.length)
    : 0;

  const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
  const vacancyRate = totalUnits > 0 ? (availableUnits / totalUnits) * 100 : 0;
  const previousMonthOccupancyRate = totalUnits > 0 ? (previousMonthOccupied / totalUnits) * 100 : 0;

  const riskCutoff = addDays(asOf, VACANCY_RISK_WINDOW_DAYS);
  const vacancyRiskRows = safeContracts
    .filter((contract) => (
      Boolean(contract.unit_id)
      && isContractStatus(contract.status, 'active')
      && contract.end_date >= asOf
      && contract.end_date <= riskCutoff
      && !hasCommittedSuccessor(contract, safeContracts)
    ))
    .sort((a, b) => a.end_date.localeCompare(b.end_date))
    .map((contract) => ({
      contractId: contract.id,
      unitId: contract.unit_id!,
      tenantName: contract.people?.full_name ?? '—',
      propertyTitle: contract.properties?.title ?? propertyTitles?.get(contract.property_id) ?? 'عقار غير محدد',
      unitNumber: contract.units?.unit_number ?? '—',
      endDate: contract.end_date,
      daysRemaining: calendarDayDiff(contract.end_date, asOf),
    }));

  return {
    totalUnits,
    occupiedUnits,
    availableUnits,
    nonRentableUnits,
    occupancyRate,
    vacancyRate,
    averageVacancyDays,
    referenceVacantRent,
    previousMonthOccupancyRate,
    occupancyChangePoints: occupancyRate - previousMonthOccupancyRate,
    previousMonthEnd,
    vacantRows,
    vacancyRiskRows,
  };
}
