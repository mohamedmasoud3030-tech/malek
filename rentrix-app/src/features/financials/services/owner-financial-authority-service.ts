import { supabase } from '@/lib/supabase';

export type OwnerFinancialPeriod = Readonly<{
  tenant_collections: number;
  management_fees: Readonly<{
    amount: number;
    breakdown?: Record<string, unknown>;
  }>;
  owner_expenses: number;
  fee_vat: number;
  authorized_adjustments: number;
  adjustments_note?: string | null;
  net_payable: number;
}>;

export type OwnerFinancialLifecycle = Readonly<{
  settled_pending_net: number;
  paid_net: number;
  remaining_payable: number;
  draft_count: number;
  approved_count: number;
  paid_count: number;
  cancelled_count: number;
}>;

export type OwnerFinancialPosition = Readonly<{
  owner_id: string;
  basis?: string | null;
  operating_model?: string | null;
  period: OwnerFinancialPeriod;
  lifecycle_all_time: OwnerFinancialLifecycle;
  owner_funds: Readonly<{ held: number }>;
}>;

export type OwnerStatementSummary = Readonly<{
  total_gross: number;
  total_deductions: number;
  total_net: number | null;
}>;

export type OwnerFinancialAuthority = Readonly<{
  position: OwnerFinancialPosition;
  statement: OwnerStatementSummary;
}>;

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`استجابة ${label} غير صالحة من الخادم`);
  }
  return value as Record<string, unknown>;
}

function requiredNumber(value: unknown, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`استجابة ${label} لا تحتوي قيمة مالية صالحة`);
  return parsed;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`استجابة ${label} ناقصة المعرّف`);
  return value;
}

function parsePosition(value: unknown): OwnerFinancialPosition {
  const root = asRecord(value, 'الموقف المالي للمالك');
  const period = asRecord(root.period, 'فترة الموقف المالي');
  const managementFees = asRecord(period.management_fees, 'رسوم الإدارة');
  const lifecycle = asRecord(root.lifecycle_all_time, 'دورة تسويات المالك');
  const ownerFunds = asRecord(root.owner_funds, 'أموال المالك');

  return {
    owner_id: requiredString(root.owner_id, 'الموقف المالي للمالك'),
    basis: typeof root.basis === 'string' ? root.basis : null,
    operating_model: typeof root.operating_model === 'string' ? root.operating_model : null,
    period: {
      tenant_collections: requiredNumber(period.tenant_collections, 'تحصيلات الفترة'),
      management_fees: {
        amount: requiredNumber(managementFees.amount, 'رسوم الإدارة'),
        breakdown: managementFees.breakdown && typeof managementFees.breakdown === 'object' && !Array.isArray(managementFees.breakdown)
          ? managementFees.breakdown as Record<string, unknown>
          : undefined,
      },
      owner_expenses: requiredNumber(period.owner_expenses, 'مصروفات المالك'),
      fee_vat: requiredNumber(period.fee_vat, 'ضريبة رسوم الإدارة'),
      authorized_adjustments: requiredNumber(period.authorized_adjustments, 'التعديلات المعتمدة'),
      adjustments_note: typeof period.adjustments_note === 'string' ? period.adjustments_note : null,
      net_payable: requiredNumber(period.net_payable, 'صافي مستحق الفترة'),
    },
    lifecycle_all_time: {
      settled_pending_net: requiredNumber(lifecycle.settled_pending_net, 'التسويات المعلقة'),
      paid_net: requiredNumber(lifecycle.paid_net, 'التسويات المدفوعة'),
      remaining_payable: requiredNumber(lifecycle.remaining_payable, 'المتبقي المستحق'),
      draft_count: requiredNumber(lifecycle.draft_count, 'عدد المسودات'),
      approved_count: requiredNumber(lifecycle.approved_count, 'عدد التسويات المعتمدة'),
      paid_count: requiredNumber(lifecycle.paid_count, 'عدد التسويات المدفوعة'),
      cancelled_count: requiredNumber(lifecycle.cancelled_count, 'عدد التسويات الملغاة'),
    },
    owner_funds: {
      held: requiredNumber(ownerFunds.held, 'أموال المالك المحتجزة'),
    },
  };
}

function parseStatement(value: unknown): OwnerStatementSummary {
  const root = asRecord(value, 'كشف حساب المالك');
  return {
    total_gross: requiredNumber(root.total_gross, 'إجمالي كشف المالك'),
    total_deductions: requiredNumber(root.total_deductions, 'إجمالي استقطاعات كشف المالك'),
    // Some deployed statement versions expose an explicit net and some do not.
    // Never derive it client-side: surface it only when the server supplied it.
    total_net: optionalNumber(root.total_net ?? root.net_total ?? root.net_payable),
  };
}

export async function getOwnerFinancialAuthority(
  ownerId: string,
  from: string,
  to: string,
): Promise<OwnerFinancialAuthority> {
  const args = { p_owner_id: ownerId, p_from: from, p_to: to };
  const [positionResult, statementResult] = await Promise.all([
    supabase.rpc('rpt_owner_financial_position', args),
    supabase.rpc('rpt_owner_statement', args),
  ]);

  if (positionResult.error) throw positionResult.error;
  if (statementResult.error) throw statementResult.error;

  const position = parsePosition(positionResult.data);
  if (position.owner_id !== ownerId) throw new Error('الموقف المالي المسترجع لا يخص المالك المطلوب');

  return {
    position,
    statement: parseStatement(statementResult.data),
  };
}
