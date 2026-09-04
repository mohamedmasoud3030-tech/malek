import { supabase } from '@/lib/supabase';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';

export type ReadinessState = 'READY' | 'MISSING' | 'BLOCKED' | 'DRAFT_NEEDS_APPROVAL';

export type TaxReadiness = {
  state: ReadinessState;
  activeProfile: {
    id: string;
    tax_code: string;
    tax_rate: number;
    effective_from: string;
    effective_to: string | null;
    version_no: number;
    status: string;
  } | null;
  latestDraft: {
    id: string;
    tax_code: string;
    tax_rate: number;
    effective_from: string;
    status: string;
    created_by: string;
  } | null;
  errorCode: string | null;
};

export type FeeTaxReadiness = {
  feeKind: 'RATE_MANAGEMENT_FEE' | 'FIXED_MONTHLY';
  state: ReadinessState;
  activeTreatment: {
    id: string;
    tax_code: string;
    tax_rate: number;
    effective_from: string;
    effective_to: string | null;
    version_no: number;
    status: string;
  } | null;
  latestDraft: {
    id: string;
    tax_code: string;
    tax_rate: number;
    effective_from: string;
    status: string;
    created_by: string;
  } | null;
  errorCode: string | null;
};

export type FinanceReadiness = {
  companyId: string;
  checkedAt: string;
  rentTax: TaxReadiness;
  rateFeeTax: FeeTaxReadiness;
  fixedFeeTax: FeeTaxReadiness;
  accountingPeriod: { state: ReadinessState; openPeriod: { id: string; start_date: string; end_date: string } | null };
  chartOfAccounts: { state: ReadinessState; count: number };
  paymentMethods: { state: ReadinessState };
};

// The active tax profile/fee treatment is resolved through the governed
// browser boundary (migration 000070), which takes the company from the JWT
// only. The internals (resolve_active_tax_profile / resolve_active_fee_tax_-
// treatment) accept an arbitrary company id and stay service-role-only, so
// calling them from here would return 42501 for every signed-in user.
async function tryResolveActiveTaxProfile(date: string) {
  const { data, error } = await supabase.rpc('resolve_current_company_tax_profile', {
    p_effective_date: date,
  });
  if (error) {
    if (error.message.includes('TAX_PROFILE_MISSING')) {
      return { active: null, errorCode: 'TAX_PROFILE_MISSING' as const };
    }
    throw error;
  }
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown>) : (data as Record<string, unknown>);
  return { active: (row as never) ?? null, errorCode: null };
}

async function tryResolveActiveFeeTax(feeKind: string, date: string) {
  const { data, error } = await supabase.rpc('resolve_current_company_fee_tax_treatment', {
    p_fee_kind: feeKind,
    p_effective_date: date,
  });
  if (error) {
    if (error.message.includes('FEE_TAX_TREATMENT_MISSING')) {
      return { active: null, errorCode: 'FEE_TAX_TREATMENT_MISSING' as const };
    }
    throw error;
  }
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown>) : (data as Record<string, unknown>);
  return { active: (row as never) ?? null, errorCode: null };
}

export async function getFinanceReadiness(companyId: string): Promise<FinanceReadiness> {
  const today = getTodayLocalDateString();
  const checkedAt = new Date().toISOString();

  // Rent tax
  let rentTax: TaxReadiness;
  try {
    const { active, errorCode } = await tryResolveActiveTaxProfile(today);
    if (active) {
      const a = active as Record<string, unknown>;
      rentTax = {
        state: 'READY',
        activeProfile: {
          id: String((a.profile_id as string) ?? (a.id as string) ?? ''),
          tax_code: String(a.tax_code ?? ''),
          tax_rate: Number(a.tax_rate ?? 0),
          effective_from: String(a.effective_from ?? ''),
          effective_to: (a.effective_to as string) ?? null,
          version_no: Number((a.version_no as number) ?? 0),
          status: String((a.status as string) ?? 'ACTIVE'),
        },
        latestDraft: null,
        errorCode: null,
      };
    } else {
      const { data: drafts } = await supabase
        .from('company_tax_profiles')
        .select('id, tax_code, tax_rate, effective_from, status, created_by')
        .eq('company_id', companyId)
        .eq('status', 'DRAFT')
        .order('created_at', { ascending: false })
        .limit(1);
      const latestDraft = drafts && (drafts[0] as Record<string, unknown>) ? (drafts[0] as Record<string, unknown>) : null;
      rentTax = {
        state: latestDraft ? 'DRAFT_NEEDS_APPROVAL' : 'MISSING',
        activeProfile: null,
        latestDraft: latestDraft
          ? {
              id: String(latestDraft.id as string),
              tax_code: String(latestDraft.tax_code as string),
              tax_rate: Number(latestDraft.tax_rate as number),
              effective_from: String(latestDraft.effective_from as string),
              status: String(latestDraft.status as string),
              created_by: String(latestDraft.created_by as string),
            }
          : null,
        errorCode: errorCode as string | null,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    rentTax = {
      state: 'BLOCKED',
      activeProfile: null,
      latestDraft: null,
      errorCode: msg,
    };
  }

  async function getFeeReadiness(feeKind: 'RATE_MANAGEMENT_FEE' | 'FIXED_MONTHLY'): Promise<FeeTaxReadiness> {
    try {
      const { active, errorCode } = await tryResolveActiveFeeTax(feeKind, today);
      if (active) {
        const a = active as Record<string, unknown>;
        return {
          feeKind,
          state: 'READY',
          activeTreatment: {
            id: String((a.treatment_id as string) ?? (a.id as string) ?? ''),
            tax_code: String(a.tax_code ?? ''),
            tax_rate: Number(a.tax_rate ?? 0),
            effective_from: String(a.effective_from ?? ''),
            effective_to: (a.effective_to as string) ?? null,
            version_no: Number((a.version_no as number) ?? 0),
            status: String((a.status as string) ?? 'ACTIVE'),
          },
          latestDraft: null,
          errorCode: null,
        };
      } else {
        const { data: drafts } = await supabase
          .from('company_fee_tax_treatments')
          .select('id, tax_code, tax_rate, effective_from, status, created_by')
          .eq('company_id', companyId)
          .eq('fee_kind', feeKind)
          .eq('status', 'DRAFT')
          .order('created_at', { ascending: false })
          .limit(1);
        const latestDraft = drafts && (drafts[0] as Record<string, unknown>) ? (drafts[0] as Record<string, unknown>) : null;
        return {
          feeKind,
          state: latestDraft ? 'DRAFT_NEEDS_APPROVAL' : 'MISSING',
          activeTreatment: null,
          latestDraft: latestDraft
            ? {
                id: String(latestDraft.id as string),
                tax_code: String(latestDraft.tax_code as string),
                tax_rate: Number(latestDraft.tax_rate as number),
                effective_from: String(latestDraft.effective_from as string),
                status: String(latestDraft.status as string),
                created_by: String(latestDraft.created_by as string),
              }
            : null,
          errorCode: errorCode as string | null,
        };
      }
    } catch (e) {
      return {
        feeKind,
        state: 'BLOCKED',
        activeTreatment: null,
        latestDraft: null,
        errorCode: e instanceof Error ? e.message : String(e),
      };
    }
  }

  const rateFeeTax = await getFeeReadiness('RATE_MANAGEMENT_FEE');
  const fixedFeeTax = await getFeeReadiness('FIXED_MONTHLY');

  // Accounting period readiness
  let accountingPeriod: FinanceReadiness['accountingPeriod'];
  try {
    const { data, error } = await supabase.rpc('list_accounting_periods');
    if (error) throw error;
    const periods = Array.isArray(data) ? (data as unknown as { id: string; start_date: string; end_date: string; status: string }[]) : [];
    const open = periods.find((p) => p.status === 'OPEN') ?? null;
    accountingPeriod = {
      state: open ? 'READY' : 'MISSING',
      openPeriod: open ? { id: open.id, start_date: open.start_date, end_date: open.end_date } : null,
    };
  } catch {
    accountingPeriod = { state: 'BLOCKED', openPeriod: null };
  }

  // Chart and payment-method readiness must derive from one successful
  // authoritative snapshot. Calling the RPC twice could show contradictory
  // states and the old payment-method branch silently ignored its RPC error.
  let chartOfAccounts: FinanceReadiness['chartOfAccounts'];
  let paymentMethods: FinanceReadiness['paymentMethods'];
  try {
    const { data, error } = await supabase.rpc('list_chart_of_accounts');
    if (error) throw error;
    const accounts = Array.isArray(data) ? (data as unknown as { account_no: string }[]) : [];
    const count = accounts.length;
    chartOfAccounts = {
      state: count >= 18 ? 'READY' : count > 0 ? 'BLOCKED' : 'MISSING',
      count,
    };
    const hasCash = accounts.some((account) => account.account_no === '1111');
    const hasBank = accounts.some((account) => account.account_no === '1120');
    paymentMethods = { state: hasCash && hasBank ? 'READY' : 'MISSING' };
  } catch {
    chartOfAccounts = { state: 'BLOCKED', count: 0 };
    paymentMethods = { state: 'BLOCKED' };
  }

  return {
    companyId,
    checkedAt,
    rentTax,
    rateFeeTax,
    fixedFeeTax,
    accountingPeriod,
    chartOfAccounts,
    paymentMethods,
  };
}
