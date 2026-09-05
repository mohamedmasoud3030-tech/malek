import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import { fetchAllRows, fetchAllRowsInBatches } from '@/lib/paginatedRead';
import {
  TAX_PROFILE_MISSING,
  TAX_READINESS_READY,
  TAX_SCOPE_RENT,
  indexTaxAuthorityReadiness,
  resolveTaxAuthorityReadiness,
} from '@/features/financials/tax-authority/tax-readiness-boundary';
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

  // Pass 1 — pure per-contract schedule math (single authoritative algorithm
  // from billing-schedule.ts, Defect A6). No database round trips here.
  type PreparedObligation = {
    contract: (typeof contracts)[number];
    periodStart: Date;
    periodStartStr: string;
    periodEndStr: string;
    issueDate: Date;
    issueDateStr: string;
    dueDateStr: string;
    paymentCycle: string;
    billingDay: number;
    graceDays: number;
    blockedReason: string | null;
  };
  const prepared: PreparedObligation[] = contracts.map((c) => {
    const paymentCycle = c.payment_cycle as string;
    const billingDay = Number(c.billing_day ?? 1);
    const graceDays = Number(c.grace_days ?? 0);
    const period = getBillingPeriodForCycle(paymentCycle, today);
    const periodStartStr = formatLocalDate(period.start);
    const periodEndStr = formatLocalDate(period.end);
    const issueDate = getIssueDate(period.start, period.end, billingDay);
    const issueDateStr = formatLocalDate(issueDate);
    const dueDate = getDueDate(period.end, graceDays);
    const dueDateStr = formatLocalDate(dueDate);

    // Check blocking conditions (pure snapshot inspection, no queries)
    const blockedReason = getContractBlockedReason({
      agreement_id: c.agreement_id,
      collection_role_snapshot: c.collection_role_snapshot,
      operating_model_snapshot: c.operating_model_snapshot,
    });

    return {
      contract: c,
      periodStart: period.start,
      periodStartStr,
      periodEndStr,
      issueDate,
      issueDateStr,
      dueDateStr,
      paymentCycle,
      billingDay,
      graceDays,
      blockedReason,
    };
  });

  // Pass 2 — invoice existence for ALL contracts in one batched read instead
  // of one round trip per contract (billing-readiness query fan-out fix).
  // Same filter semantics as the previous per-contract probe; a deterministic
  // (contract_id, billing_period_start) → lowest invoice id map replaces the
  // unordered `.limit(1)` probe.
  const invoiceIdByKey = new Map<string, string>();
  if (prepared.length > 0) {
    type InvoiceProbe = { id: string; contract_id: string; billing_period_start: string };
    const periodStarts = [...new Set(prepared.map((p) => p.periodStartStr))];
    let invoiceRows: readonly InvoiceProbe[] = [];
    try {
      const result = await fetchAllRowsInBatches<InvoiceProbe, string>(
        prepared.map((p) => p.contract.id),
        (batch) =>
          supabase
            .from('invoices')
            .select('id, contract_id, billing_period_start')
            .in('contract_id', [...batch])
            .in('billing_period_start', periodStarts)
            .eq('charge_type', 'RENT')
            .is('deleted_at', null)
            .not('document_status', 'in', '("VOIDED","REVERSED")')
            .order('contract_id', { ascending: true })
            .order('billing_period_start', { ascending: true })
            .order('id', { ascending: true })
            .returns() as never,
      );
      invoiceRows = result.rows;
    } catch (error) {
      handleSupabaseError(error, 'تعذر التحقق من الفواتير');
    }
    for (const row of invoiceRows) {
      const key = `${row.contract_id}|${row.billing_period_start}`;
      // Rows arrive ordered by (contract_id, billing_period_start, id):
      // the first hit per key is the lowest id, kept for determinism.
      if (!invoiceIdByKey.has(key)) invoiceIdByKey.set(key, row.id);
    }
  }

  // Pass 3 — tax readiness, fail-closed on inability to verify (Defect A3).
  // Resolved once for every distinct issue date through the single governed
  // browser boundary (tax-readiness-boundary.ts ->
  // public.resolve_tax_authority_readiness), which derives the company from the
  // authenticated caller and delegates to the service_role-only internal tax
  // resolvers. One batched round trip replaces the previous per-date call to an
  // RPC the browser could never execute. Blocked obligations never reach the
  // tax authority.
  const taxIssueDates = [...new Set(
    prepared
      .filter((p) => !p.blockedReason)
      .map((p) => p.issueDateStr),
  )];
  const taxResultByIssueDate = new Map<string, { missing: boolean; checkFailed: boolean; blockedReason: string | null }>();
  const markTaxCheckFailed = (issueDateStr: string, reason: string) => {
    taxResultByIssueDate.set(issueDateStr, {
      missing: false,
      checkFailed: true,
      blockedReason: `TAX_CHECK_FAILED: ${reason}`,
    });
  };
  if (taxIssueDates.length > 0) {
    try {
      const readiness = indexTaxAuthorityReadiness(await resolveTaxAuthorityReadiness(taxIssueDates));
      for (const issueDateStr of taxIssueDates) {
        const status = readiness.get(issueDateStr)?.[TAX_SCOPE_RENT];
        if (status === TAX_READINESS_READY) {
          taxResultByIssueDate.set(issueDateStr, { missing: false, checkFailed: false, blockedReason: null });
        } else if (status === TAX_PROFILE_MISSING) {
          taxResultByIssueDate.set(issueDateStr, {
            missing: true,
            checkFailed: false,
            blockedReason: `TAX_PROFILE_MISSING: لا يوجد ملف ضريبي نافذ يغطي ${issueDateStr}`,
          });
        } else {
          // A date the tax authority did not answer for is never treated as
          // ready: unknown scope/status or a missing row fails closed.
          markTaxCheckFailed(issueDateStr, `لم تُرجع سلطة الضريبة حالة ${issueDateStr}`);
        }
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      for (const issueDateStr of taxIssueDates) markTaxCheckFailed(issueDateStr, reason);
    }
  }

  const obligations: BillingObligation[] = prepared.map((p) => {
    const invoiceId = invoiceIdByKey.get(`${p.contract.id}|${p.periodStartStr}`) ?? null;
    const invoiceExists = invoiceId !== null;

    let blockedReason = p.blockedReason;
    let taxCheckFailed = false;
    if (!blockedReason) {
      const tax = taxResultByIssueDate.get(p.issueDateStr);
      if (tax && (tax.missing || tax.checkFailed)) {
        blockedReason = tax.blockedReason;
        taxCheckFailed = tax.checkFailed;
      }
    }

    // Derive truthful status via authoritative single algorithm (Defect A1, A2, A3)
    const { status, blockedReason: finalBlockedReason } = deriveBillingStatus({
      periodStart: p.periodStart,
      issueDate: p.issueDate,
      today,
      invoiceExists,
      blockedReason,
      taxCheckFailed,
    });

    // FAILED and RECOVERED removed — no authoritative billing-attempt history exists today (Defect A2)
    // If future enhancement adds billing_attempts table, reintroduce with proof from authority.

    return {
      contract_id: p.contract.id as string,
      property_id: (p.contract.property_id as string) ?? null,
      unit_id: (p.contract.unit_id as string) ?? null,
      tenant_id: p.contract.tenant_id as string,
      rent_amount: Number(p.contract.rent_amount ?? 0),
      payment_cycle: p.paymentCycle,
      billing_day: p.billingDay,
      grace_days: p.graceDays,
      payment_terms_id: (p.contract.payment_terms_id as string) ?? null,
      agreement_id: (p.contract.agreement_id as string) ?? null,
      collection_role: (p.contract.collection_role_snapshot as string) ?? null,
      operating_model: (p.contract.operating_model_snapshot as string) ?? null,
      start_date: p.contract.start_date as string,
      end_date: p.contract.end_date as string,
      period_start: p.periodStartStr,
      period_end: p.periodEndStr,
      issue_date: p.issueDateStr,
      due_date: p.dueDateStr,
      invoice_exists: invoiceExists,
      invoice_id: invoiceId,
      blocked_reason: finalBlockedReason,
      status,
      isRecoverable: status === 'BLOCKED' || status === 'DUE',
    } satisfies BillingObligation;
  });

  return obligations;
}

export async function generateInvoicesFromActiveContracts(): Promise<number> {
  const { data, error } = await supabase.rpc('generate_invoices_from_active_contracts').returns<number>();
  if (error) throw error;
  return data ?? 0;
}
