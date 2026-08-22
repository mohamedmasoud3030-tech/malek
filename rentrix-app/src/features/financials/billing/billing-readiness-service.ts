import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';

export type BillingStatus = 'NOT_DUE' | 'DUE' | 'GENERATED' | 'BLOCKED' | 'FAILED' | 'RECOVERED';

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

function getPeriodForCycle(paymentCycle: string, refDate: Date): { start: Date; end: Date } {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  switch (paymentCycle) {
    case 'monthly':
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0),
      };
    case 'quarterly': {
      const quarter = Math.floor(month / 3);
      const qStartMonth = quarter * 3;
      return {
        start: new Date(year, qStartMonth, 1),
        end: new Date(year, qStartMonth + 3, 0),
      };
    }
    case 'semi_annual': {
      if (month <= 5) {
        return { start: new Date(year, 0, 1), end: new Date(year, 5, 30) };
      } else {
        return { start: new Date(year, 6, 1), end: new Date(year, 11, 31) };
      }
    }
    case 'annual':
      return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
    default:
      return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
  }
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getBillingReadiness(): Promise<BillingObligation[]> {
  // Fetch active contracts with billing policy
  const { data: contracts, error: contractsError } = await supabase
    .from('contracts')
    .select('id, property_id, unit_id, tenant_id, rent_amount, payment_cycle, billing_day, grace_days, payment_terms_id, agreement_id, collection_role_snapshot, operating_model_snapshot, start_date, end_date')
    .is('deleted_at', null)
    .ilike('status', 'active')
    .order('id')
    .limit(200);
  if (contractsError) handleSupabaseError(contractsError, 'تعذر تحميل العقود النشطة');

  const today = new Date();
  const todayStr = getTodayLocalDateString();
  const obligations: BillingObligation[] = [];

  for (const c of contracts ?? []) {
    const paymentCycle = c.payment_cycle as string;
    const billingDay = Number(c.billing_day ?? 1);
    const graceDays = Number(c.grace_days ?? 0);

    const period = getPeriodForCycle(paymentCycle, today);
    const periodStartStr = formatLocalDate(period.start);
    const periodEndStr = formatLocalDate(period.end);

    // Issue date anchored to billing_day inside current period
    const issueDate = new Date(period.start);
    issueDate.setDate(Math.min(billingDay, period.end.getDate()));
    const issueDateStr = formatLocalDate(issueDate);

    const dueDate = new Date(period.end);
    dueDate.setDate(dueDate.getDate() + graceDays);
    const dueDateStr = formatLocalDate(dueDate);

    // Check if invoice exists for this billing period
    const { data: existingInvoices, error: invError } = await supabase
      .from('invoices')
      .select('id')
      .eq('contract_id', c.id)
      .eq('charge_type', 'RENT')
      .eq('billing_period_start', periodStartStr)
      .is('deleted_at', null)
      .not('document_status', 'in', '(\"VOIDED\",\"REVERSED\")')
      .limit(1);
    if (invError) handleSupabaseError(invError, 'تعذر التحقق من الفواتير');

    const invoiceExists = (existingInvoices?.length ?? 0) > 0;
    const invoiceId = invoiceExists ? (existingInvoices![0] as { id: string }).id : null;

    // Check blocking conditions
    let blockedReason: string | null = null;
    let status: BillingStatus;

    if (!c.agreement_id) {
      blockedReason = 'AGREEMENT_MISSING: لا توجد اتفاقية إدارة مرتبطة';
      status = 'BLOCKED';
    } else if (!c.collection_role_snapshot || !c.operating_model_snapshot) {
      blockedReason = 'MODEL_SNAPSHOT_MISSING: العقد ليس OWNER_AGENCY مُجمد بالكامل';
      status = 'BLOCKED';
    } else {
      // Check tax profile for issue date
      try {
        const { data: companyIdData } = await supabase.from('company_settings').select('company_id').limit(1).maybeSingle();
        const companyId = companyIdData ? (companyIdData as { company_id: string }).company_id : null;
        if (companyId) {
          const { error: taxError } = await supabase.rpc('resolve_active_tax_profile', {
            p_company_id: companyId,
            p_effective_date: issueDateStr,
          });
          if (taxError && taxError.message.includes('TAX_PROFILE_MISSING')) {
            blockedReason = `TAX_PROFILE_MISSING: لا يوجد ملف ضريبي نافذ يغطي ${issueDateStr}`;
            status = 'BLOCKED';
          }
        }
      } catch {
        // ignore, will be handled as not blocked
      }

      if (!blockedReason) {
        if (invoiceExists) {
          status = 'GENERATED';
        } else {
          // Check if period is in future
          if (period.start > today) {
            status = 'NOT_DUE';
          } else {
            status = 'DUE';
          }
        }
      } else {
        status = 'BLOCKED';
      }
    }

    // Check if previously blocked now recovered? For now, if invoice exists and was previously blocked, mark RECOVERED
    // We don't have history, so keep GENERATED for existing

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
      blocked_reason: blockedReason,
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
