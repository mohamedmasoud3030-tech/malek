/**
 * Stage 3 — chart-of-accounts service boundary.
 *
 * Read + idempotent provisioning only. The chart is company-scoped server-side
 * (the RPCs derive the company from the authenticated JWT); browsers can never
 * choose another company's chart. Direct account mutation stays a database
 * concern (RLS + constraints); no generic account-write UI is introduced here.
 */
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { ChartAccount, ChartOfAccountsList, ProvisionResult } from './accountingDomain';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export async function listChartOfAccounts(): Promise<ChartAccount[]> {
  try {
    const { data, error } = await supabase.rpc('list_chart_of_accounts');
    if (error) throw error;
    const root = asRecord(data);
    const rows = Array.isArray(root.accounts) ? root.accounts : [];
    return rows.map((row) => {
      const r = asRecord(row);
      return {
        id: asString(r.id),
        no: asString(r.account_no ?? r.no),
        name: asString(r.name),
        company_id: asString(r.company_id),
        account_type: (asString(r.account_type) || 'other') as ChartAccount['account_type'],
        normal_balance: (asString(r.normal_balance) || 'debit') as ChartAccount['normal_balance'],
        currency_code: asString(r.currency_code) || 'OMR',
        precision: asNumber(r.precision) || 3,
        is_active: r.is_active !== false,
        created_at: asString(r.created_at),
        updated_at: asString(r.updated_at),
      };
    });
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل دليل الحسابات');
    return [];
  }
}

/**
 * Idempotently provisions the required Stage 3 accounts for the caller's
 * company (ADMIN/MANAGER only; company comes from the JWT). Customized account
 * names are never overwritten.
 */
export async function ensureRequiredAccounts(): Promise<ProvisionResult | null> {
  try {
    const { data, error } = await supabase.rpc('ensure_company_chart_of_accounts');
    if (error) throw error;
    const root = asRecord(data);
    const accounts = Array.isArray(root.accounts) ? root.accounts : [];
    return {
      success: root.success !== false,
      company_id: asString(root.company_id),
      created_count: asNumber(root.created_count),
      existing_count: asNumber(root.existing_count),
      accounts: accounts.map((row) => {
        const r = asRecord(row);
        return {
          account_no: asString(r.account_no),
          name: asString(r.name),
          account_type: asString(r.account_type),
          normal_balance: asString(r.normal_balance),
          currency_code: asString(r.currency_code),
          precision: asNumber(r.precision),
        };
      }),
    };
  } catch (error) {
    handleSupabaseError(error, 'تعذر تجهيز دليل الحسابات');
    return null;
  }
}

/** Convenience typed read of the raw RPC envelope (used by tests/tools). */
export async function listChartOfAccountsEnvelope(): Promise<ChartOfAccountsList | null> {
  try {
    const { data, error } = await supabase.rpc('list_chart_of_accounts');
    if (error) throw error;
    return (data ?? {}) as ChartOfAccountsList;
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل دليل الحسابات');
    return null;
  }
}

export type { JsonRecord };
