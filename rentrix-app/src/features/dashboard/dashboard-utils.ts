import type { ContractListItem } from '@/features/contracts/services/contractService';
import type { OverdueInvoiceReportRow } from '@/features/financials/reports/financialReportsService';

export const DASHBOARD_WINDOW_DAYS = 30;
export const MAX_EXPIRING_ROWS = 5;
export const MAX_OVERDUE_ROWS = 5;

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

export function calculateDaysRemaining(endDate: string, today: Date) {
  const t = Date.parse(`${toDateInputValue(today)}T00:00:00.000Z`);
  const e = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(t) || !Number.isFinite(e)) return 0;
  return Math.max(0, Math.ceil((e - t) / 86_400_000));
}

function getContractLocation(c: ContractListItem) {
  const prop = c.properties?.title ?? 'عقار غير محدد';
  return c.units?.unit_number ? `${prop} / وحدة ${c.units.unit_number}` : prop;
}

export type ExpiringContractRow = {
  id: string; contractNumber: string; tenantName: string;
  location: string; endDate: string; daysRemaining: number;
};

export function buildExpiringContracts(
  contracts: ContractListItem[] | undefined,
  today: Date,
): ExpiringContractRow[] {
  const cutoff = addDays(today, DASHBOARD_WINDOW_DAYS);
  return (contracts ?? [])
    .filter((c) => {
      if (!c.end_date) return false;
      const d = Date.parse(`${c.end_date}T00:00:00.000Z`);
      return Number.isFinite(d) && d >= Date.now() && d <= cutoff.getTime();
    })
    .slice(0, MAX_EXPIRING_ROWS)
    .map((c) => ({
      id: c.id,
      contractNumber: c.id.slice(0, 8),
      tenantName: c.people?.full_name ?? 'مستأجر',
      location: getContractLocation(c),
      endDate: c.end_date ?? '',
      daysRemaining: calculateDaysRemaining(c.end_date ?? '', today),
    }));
}

export type OverdueTenantRow = {
  invoiceId: string; tenantName: string; location: string;
  dueDate: string; daysOverdue: number; remainingAmount: number;
};

export function buildOverdueTenantRows(
  rows: OverdueInvoiceReportRow[] | undefined,
): OverdueTenantRow[] {
  return (rows ?? [])
    .slice()
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, MAX_OVERDUE_ROWS)
    .map((row) => ({
      invoiceId: row.invoiceId,
      tenantName: row.tenantName ?? 'مستأجر غير محدد',
      location: row.unitNumber
        ? `${row.propertyTitle ?? 'عقار'} / وحدة ${row.unitNumber}`
        : (row.propertyTitle ?? 'عقار غير محدد'),
      dueDate: row.dueDate,
      daysOverdue: row.daysOverdue,
      remainingAmount: row.remainingAmount,
    }));
}
