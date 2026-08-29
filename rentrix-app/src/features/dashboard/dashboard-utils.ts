/**
 * R1 — Dashboard Truth: presentation adapters only.
 *
 * The authoritative KPI numbers and the bounded work-queue rows both come from
 * the server read model (rpt_dashboard_snapshot). These helpers translate the
 * server queue rows into the display shapes the queue cards render — they
 * never filter, count, or derive an authoritative number.
 */
import type { DashboardQueueContractRow } from './dashboard-snapshot';

export const DASHBOARD_WINDOW_DAYS = 30;

export function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatQueueLocation(propertyTitle: string | null, unitNumber: string | null) {
  const property = propertyTitle ?? 'عقار غير محدد';
  return unitNumber ? `${property} / وحدة ${unitNumber}` : property;
}

export type ExpiringContractRow = {
  id: string; contractNumber: string; tenantName: string;
  location: string; endDate: string; daysRemaining: number;
};

export function buildExpiringContracts(rows: DashboardQueueContractRow[] | undefined): ExpiringContractRow[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    contractNumber: row.reference ?? 'عقد بلا مرجع تجاري',
    tenantName: row.tenantName ?? 'مستأجر',
    location: formatQueueLocation(row.propertyTitle, row.unitNumber),
    endDate: row.endDate,
    daysRemaining: row.daysRemaining,
  }));
}


