import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows } from '@/lib/paginatedRead';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import {
  deriveBillingStatus,
  formatLocalDate,
  getBillingPeriodForCycle,
  getContractBlockedReason,
  getDueDate,
  getIssueDate,
  type BillingStatus,
} from './billing-schedule';

export type { BillingStatus } from './billing-schedule';

export type BillingObligation = {
  contract_id: string;
  property_id: string | null;
  unit_id: string | null;
  tenant_id: string;
  rent_amount: number;
  payment_cycle: string;
  billing_day: number;
  grace_days: number;
  payment_terms_id: string | null;
  agreement_id: string | null;
  collection_role: string | null;
  operating_model: string | null;
  start_date: string;
  end_date: string;
  period_start: string;
  period_end: string;
  issue_date: string;
  due_date: string;
  invoice_exists: boolean;
  invoice_id: string | null;
  blocked_reason: string | null;
  status: BillingStatus;
  isRecoverable: boolean;
};

// Server-backed authoritative schedule is preferred, but we keep a client helper
// that is proven bit-for-bit equivalent to server's generate_invoices logic via PGlite tests.
// The helper lives in billing-schedule.ts as single source of truth.

export async function getBillingReadiness(companyId: string): Promise<BillingObligation[]> {
  if (!companyId) throw new Error('Company ID is required for billing readiness');

  // Use pagination contract to avoid silent 200 truncation (Defect A5)
  const { rows: contracts } = await fetchAllRows<{
    id: string;
    property_id: string | null;
    unit_id: string | null;
    tenant_id: string;
    rent_amount: number;
    payment_cycle: string;
    billing_day: number | null;
    grace_days: number | null;
    payment_terms_id: string | null;
    agreement_id: string | null;
    collection_role_snapshot: string | null;
    operating_model_snapshot: string | null;
    start_date: string;
    end_date: string;
  }>(() =>
    supabase
      .from('contracts')
      .select('id, property_id, unit_id, tenant_id, rent_amount, payment_cycle, billing_day, grace_days, payment_terms_id, agreement_id, collection_role_snapshot, operating_model_snapshot, start_date, end_date')
      .is('deleted_at', null)
      .ilike('status', 'active')
      .order('id')
      .returns() as never,
  );

  const today = new Date();
  const obligations: BillingObligation[] = [];

  for (const c of contracts) {
    const paymentCycle = c.payment_cycle as string;
    const billingDay = Number(c.billing_day ?? 1);
    const graceDays = Number(c.grace_days ?? 0);

    // Use single authoritative algorithm from billing-schedule.ts (Defect A6)
    const period = getBillingPeriodForCycle(paymentCycle, today);
    const periodStartStr = formatLocalDate(period.start);
    const periodEndStr = formatLocalDate(period.end);
    const issueDate = getIssueDate(period.start, period.end, billingDay);
    const issueDateStr = formatLocalDate(issueDate);
    const dueDate = getDueDate(period.end, graceDays);
    const dueDateStr = formatLocalDate(dueDate);

    // Check invoice existence
    const { data: existingInvoices, error: invError } = await supabase
      .from('invoices')
      .select('id')
      .eq('contract_id', c.id)
      .eq('charge_type', 'RENT')
      .eq('billing_period_start', periodStartStr)
      .is('deleted_at', null)
      .not('document_status', 'in', '("VOIDED","REVERSED")')
      .limit(1);
    if (invError) handleSupabaseError(invError, 'تعذر التحقق من الفواتير');

    const invoiceExists = (existingInvoices?.length ?? 0) > 0;
    const invoiceId = invoiceExists ? (existingInvoices![0] as { id: string }).id : null;

    // Check blocking conditions
    let blockedReason: string | null = getContractBlockedReason({
      agreement_id: c.agreement_id,
      collection_role_snapshot: c.collection_role_snapshot,
      operating_model_snapshot: c.operating_model_snapshot,
    });

    let taxCheckFailed = false;

    if (!blockedReason) {
      // Tax readiness check — fail closed on inability to verify (Defect A3)
      try {
        const { error: taxError } = await supabase.rpc('resolve_active_tax_profile', {
          p_company_id: companyId,
          p_effective_date: issueDateStr,
        });
        if (taxError) {
          if (taxError.message.includes('TAX_PROFILE_MISSING')) {
            blockedReason = `TAX_PROFILE_MISSING: لا يوجد ملف ضريبي نافذ يغطي ${issueDateStr}`;
          } else {
            // Any other tax RPC error → CHECK_FAILED fail closed, never READY
            taxCheckFailed = true;
            blockedReason = `TAX_CHECK_FAILED: ${taxError.message}`;
          }
        }
      } catch (e) {
        taxCheckFailed = true;
        blockedReason = e instanceof Error ? e.message : String(e);
      }
    }

    // Derive truthful status via authoritative single algorithm (Defect A1, A2, A3)
    const { status, blockedReason: finalBlockedReason } = deriveBillingStatus({
      periodStart: period.start,
      issueDate,
      today,
      invoiceExists,
      blockedReason,
      taxCheckFailed,
    });

    // FAILED and RECOVERED removed — no authoritative billing-attempt history exists today (Defect A2)
    // If future enhancement adds billing_attempts table, reintroduce with proof from authority.

    obligations.push({
      contract_id: c.id as string,
      property_id: (c.property_id as string) ?? null,
      unit_id: (c.unit_id as string) ?? null,
      tenant_id: c.tenant_id as string,
      rent_amount: Number(c.rent_amount ?? 0),
      payment_cycle: paymentCycle,
      billing_day: billingDay,
      grace_days: graceDays,
      payment_terms_id: (c.payment_terms_id as string) ?? null,
      agreement_id: (c.agreement_id as string) ?? null,
      collection_role: (c.collection_role_snapshot as string) ?? null,
      operating_model: (c.operating_model_snapshot as string) ?? null,
      start_date: c.start_date as string,
      end_date: c.end_date as string,
      period_start: periodStartStr,
      period_end: periodEndStr,
      issue_date: issueDateStr,
      due_date: dueDateStr,
      invoice_exists: invoiceExists,
      invoice_id: invoiceId,
      blocked_reason: finalBlockedReason,
      status,
      isRecoverable: status === 'BLOCKED' || status === 'DUE',
    });
  }

  return obligations;
}

export async function generateInvoicesFromActiveContracts(): Promise<number> {
  const { data, error } = await supabase.rpc('generate_invoices_from_active_contracts').returns<number>();
  if (error) throw error;
  return data ?? 0;
}
