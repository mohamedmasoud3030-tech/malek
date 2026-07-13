import { supabase } from '@/lib/supabase';

export type DashboardFinancialSummary = {
  total_collected: number;
  total_overdue_invoices: number;
  total_expenses: number;
  net_revenue: number;
};

export type DashboardOperationalKpis = {
  properties: number;
  units: number;
  activeContracts: number;
  expiringContracts30Days: number;
  vacantUnits: number;
  overdueInvoices: number;
};

export type DashboardOverview = {
  financial: DashboardFinancialSummary;
  operational: DashboardOperationalKpis;
};

type DashboardOverviewRpcResponse = Partial<{
  financial: Partial<DashboardFinancialSummary> | null;
  operational: Partial<DashboardOperationalKpis> | null;
}> | null;

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonthRange(date: Date): { p_from: string; p_to: string; p_as_of: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return { p_from: toISODate(firstDay), p_to: toISODate(lastDay), p_as_of: toISODate(date) };
}

export function normalizeDashboardOverview(data: DashboardOverviewRpcResponse): DashboardOverview {
  const financial = data?.financial ?? {};
  const operational = data?.operational ?? {};

  return {
    financial: {
      total_collected: toNumber(financial.total_collected),
      total_overdue_invoices: toNumber(financial.total_overdue_invoices),
      total_expenses: toNumber(financial.total_expenses),
      net_revenue: toNumber(financial.net_revenue),
    },
    operational: {
      properties: toNumber(operational.properties),
      units: toNumber(operational.units),
      activeContracts: toNumber(operational.activeContracts),
      expiringContracts30Days: toNumber(operational.expiringContracts30Days),
      vacantUnits: toNumber(operational.vacantUnits),
      overdueInvoices: toNumber(operational.overdueInvoices),
    },
  };
}

export async function getDashboardOverview(date = new Date()): Promise<DashboardOverview> {
  const { p_from, p_to, p_as_of } = getMonthRange(date);
  const { data, error } = await supabase.rpc('rpt_dashboard_overview', { p_from, p_to, p_as_of });
  if (error) throw error;
  return normalizeDashboardOverview(data as DashboardOverviewRpcResponse);
}

export const dashboardServiceTestUtils = { addDays, toISODate, getMonthRange };
