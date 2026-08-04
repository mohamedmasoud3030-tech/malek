/**
 * Stage 3 — accounting-period service boundary.
 *
 * Listing is available to authenticated app users; creation and status
 * changes require ADMIN/MANAGER and are company-scoped server-side from the
 * JWT. HARD_CLOSED periods are immutable; reopening a SOFT_CLOSED period
 * requires an explicit reason. Every status change is audited.
 */
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { AccountingPeriod, AccountingPeriodInput, AccountingPeriodStatus, AccountingPeriodStatusInput, AccountingPeriodsList } from './accountingDomain';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return (value ?? {}) as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return value == null ? null : asString(value);
}

export async function listAccountingPeriods(): Promise<AccountingPeriod[]> {
  try {
    const { data, error } = await supabase.rpc('list_accounting_periods');
    if (error) throw error;
    const root = asRecord(data);
    const rows = Array.isArray(root.periods) ? root.periods : [];
    return rows.map((row) => {
      const r = asRecord(row);
      return {
        id: asString(r.id),
        company_id: asString(r.company_id),
        name: asString(r.name),
        start_date: asString(r.start_date),
        end_date: asString(r.end_date),
        status: (asString(r.status) || 'OPEN') as AccountingPeriodStatus,
        closed_at: asNullableString(r.closed_at),
        closed_by: asNullableString(r.closed_by),
        reopen_reason: asNullableString(r.reopen_reason),
        created_at: asString(r.created_at),
        created_by: asNullableString(r.created_by),
        updated_at: asString(r.updated_at),
      };
    });
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل الفترات المحاسبية');
    return [];
  }
}

export type CreateAccountingPeriodResult = Readonly<{
  success: boolean;
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: AccountingPeriodStatus;
}>;

export async function createAccountingPeriod(input: AccountingPeriodInput): Promise<CreateAccountingPeriodResult | null> {
  try {
    const { data, error } = await supabase.rpc('create_accounting_period', { p_payload: input });
    if (error) throw error;
    const r = asRecord(data);
    return {
      success: r.success !== false,
      id: asString(r.id),
      name: asString(r.name),
      start_date: asString(r.start_date),
      end_date: asString(r.end_date),
      status: (asString(r.status) || 'OPEN') as AccountingPeriodStatus,
    };
  } catch (error) {
    handleSupabaseError(error, 'تعذر إنشاء الفترة المحاسبية');
    return null;
  }
}

export type UpdateAccountingPeriodStatusResult = Readonly<{
  success: boolean;
  id: string;
  status: AccountingPeriodStatus;
  changed: boolean;
  old_status?: AccountingPeriodStatus;
}>;

export async function updateAccountingPeriodStatus(input: AccountingPeriodStatusInput): Promise<UpdateAccountingPeriodStatusResult | null> {
  try {
    const { data, error } = await supabase.rpc('update_accounting_period_status', { p_payload: input });
    if (error) throw error;
    const r = asRecord(data);
    return {
      success: r.success !== false,
      id: asString(r.id),
      status: (asString(r.status) || 'OPEN') as AccountingPeriodStatus,
      changed: r.changed === true,
      old_status: r.old_status ? (asString(r.old_status) as AccountingPeriodStatus) : undefined,
    };
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحديث حالة الفترة المحاسبية');
    return null;
  }
}

export async function listAccountingPeriodsEnvelope(): Promise<AccountingPeriodsList | null> {
  try {
    const { data, error } = await supabase.rpc('list_accounting_periods');
    if (error) throw error;
    return (data ?? {}) as AccountingPeriodsList;
  } catch (error) {
    handleSupabaseError(error, 'تعذر تحميل الفترات المحاسبية');
    return null;
  }
}

export type { JsonRecord };
