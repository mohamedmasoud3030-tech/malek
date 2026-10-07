import { supabase } from '@/lib/supabase';
import { toFinancialNumber } from '../financialMath';

export type TenantStatementLine = {
  date: string | null;
  description: string | null;
  type: string | null;
  debit: number;
  credit: number;
  balance: number;
};

export type TenantStatementReport = {
  contractId: string | null;
  tenantName: string | null;
  tenantPhone: string | null;
  unitName: string | null;
  propertyName: string | null;
  startDate: string | null;
  endDate: string | null;
  lines: TenantStatementLine[];
  finalBalance: number;
  error: string | null;
};

export type OwnerStatementTransaction = {
  date: string | null;
  details: string | null;
  type: string | null;
  propertyName: string | null;
  gross: number;
  deduction: number;
  net: number;
};

export type OwnerStatementReport = {
  ownerName: string | null;
  commissionType: string | null;
  commissionValue: number;
  transactions: OwnerStatementTransaction[];
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  periodFrom: string | null;
  periodTo: string | null;
  error: string | null;
};

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number {
  return toFinancialNumber(typeof value === 'string' || typeof value === 'number' ? value : 0);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function normalizeTenantStatementReport(payload: unknown): TenantStatementReport {
  const root = asRecord(payload);
  return {
    contractId: asString(root.contract_id),
    tenantName: asString(root.tenant_name),
    tenantPhone: asString(root.tenant_phone),
    unitName: asString(root.unit_name),
    propertyName: asString(root.property_name),
    startDate: asString(root.start_date),
    endDate: asString(root.end_date),
    lines: asArray(root.lines).map((line) => {
      const row = asRecord(line);
      return {
        date: asString(row.date),
        description: asString(row.description),
        type: asString(row.type),
        debit: asNumber(row.debit),
        credit: asNumber(row.credit),
        balance: asNumber(row.balance),
      };
    }),
    finalBalance: asNumber(root.final_balance),
    error: asString(root.error),
  };
}

export function normalizeOwnerStatementReport(payload: unknown): OwnerStatementReport {
  const root = asRecord(payload);
  return {
    ownerName: asString(root.owner_name),
    commissionType: asString(root.commission_type),
    commissionValue: asNumber(root.commission_value),
    transactions: asArray(root.transactions).map((transaction) => {
      const row = asRecord(transaction);
      return {
        date: asString(row.date),
        details: asString(row.details),
        type: asString(row.type),
        propertyName: asString(row.property_name),
        gross: asNumber(row.gross),
        deduction: asNumber(row.deduction),
        net: asNumber(row.net),
      };
    }),
    totalGross: asNumber(root.total_gross),
    totalDeductions: asNumber(root.total_deductions),
    totalNet: asNumber(root.total_net),
    periodFrom: asString(root.period_from),
    periodTo: asString(root.period_to),
    error: asString(root.error),
  };
}

export async function getTenantStatementReport(contractId: string): Promise<TenantStatementReport> {
  const { data, error } = await (supabase.rpc as unknown as Rpc)('rpt_tenant_statement', {
    p_contract_id: contractId,
  });
  if (error) throw error;
  return normalizeTenantStatementReport(data);
}

export async function getOwnerStatementReport(params: { ownerId: string; dateFrom: string; dateTo: string }): Promise<OwnerStatementReport> {
  const { data, error } = await (supabase.rpc as unknown as Rpc)('rpt_owner_statement', {
    p_owner_id: params.ownerId,
    p_from: params.dateFrom,
    p_to: params.dateTo,
  });
  if (error) throw error;
  return normalizeOwnerStatementReport(data);
}
