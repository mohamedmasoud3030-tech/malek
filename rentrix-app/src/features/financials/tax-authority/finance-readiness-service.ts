import { supabase } from '@/lib/supabase';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import {
  FEE_TAX_TREATMENT_MISSING,
  TAX_PROFILE_MISSING,
  TAX_READINESS_READY,
  TAX_SCOPE_FIXED_MONTHLY,
  TAX_SCOPE_RATE_MANAGEMENT_FEE,
  TAX_SCOPE_RENT,
  indexTaxAuthorityReadiness,
  resolveTaxAuthorityReadiness,
  type TaxAuthorityFeeScope,
  type TaxAuthorityReadinessStatus,
  type TaxAuthorityScope,
} from './tax-readiness-boundary';

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
  feeKind: TaxAuthorityFeeScope;
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

/**
 * READY / MISSING authority for every tax scope, resolved in one governed
 * round trip through public.resolve_tax_authority_readiness. The internal
 * resolvers (resolve_active_tax_profile / resolve_active_fee_tax_treatment) are
 * service_role-only and are never called from the browser.
 */
async function loadTaxAuthorityReadiness(
  today: string,
): Promise<Readonly<Record<string, TaxAuthorityReadinessStatus>>> {
  const readiness = indexTaxAuthorityReadiness(await resolveTaxAuthorityReadiness([today]));
  return readiness.get(today) ?? {};
}

/**
 * Presentation detail for a scope the authority already reported as READY.
 * The rows are read under the existing company RLS policy
 * (company_tax_profiles_company_read / company_fee_tax_treatments_company_read),
 * so this never widens what the caller may see; it only supplies the rate and
 * window the readiness card displays. The READY/MISSING decision itself always
 * comes from the governed resolver above.
 */
async function readCoveringTaxProfile(companyId: string, date: string) {
  const { data } = await supabase
    .from('company_tax_profiles')
    .select('id, tax_code, tax_rate, effective_from, effective_to, version_no, status')
    .eq('company_id', companyId)
    .in('status', ['APPROVED', 'ACTIVE', 'SUPERSEDED'])
    .lte('effective_from', date)
    .or(`effective_to.is.null,effective_to.gte.${date}`)
    .order('effective_from', { ascending: false })
    .order('version_no', { ascending: false })
    .limit(1);
  const row = data?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id ?? ''),
    tax_code: String(row.tax_code ?? ''),
    tax_rate: Number(row.tax_rate ?? 0),
    effective_from: String(row.effective_from ?? ''),
    effective_to: (row.effective_to as string) ?? null,
    version_no: Number(row.version_no ?? 0),
    status: String(row.status ?? 'ACTIVE'),
  };
}

async function readCoveringFeeTaxTreatment(companyId: string, feeKind: TaxAuthorityFeeScope, date: string) {
  const { data } = await supabase
    .from('company_fee_tax_treatments')
    .select('id, tax_code, tax_rate, effective_from, effective_to, version_no, status')
    .eq('company_id', companyId)
    .eq('fee_kind', feeKind)
    .eq('status', 'ACTIVE')
    .lte('effective_from', date)
    .or(`effective_to.is.null,effective_to.gte.${date}`)
    .order('effective_from', { ascending: false })
    .order('version_no', { ascending: false })
    .limit(1);
  const row = data?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id ?? ''),
    tax_code: String(row.tax_code ?? ''),
    tax_rate: Number(row.tax_rate ?? 0),
    effective_from: String(row.effective_from ?? ''),
    effective_to: (row.effective_to as string) ?? null,
    version_no: Number(row.version_no ?? 0),
    status: String(row.status ?? 'ACTIVE'),
  };
}

async function readLatestTaxDraft(companyId: string) {
  const { data } = await supabase
    .from('company_tax_profiles')
    .select('id, tax_code, tax_rate, effective_from, status, created_by')
    .eq('company_id', companyId)
    .eq('status', 'DRAFT')
    .order('created_at', { ascending: false })
    .limit(1);
  const row = data?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id ?? ''),
    tax_code: String(row.tax_code ?? ''),
    tax_rate: Number(row.tax_rate ?? 0),
    effective_from: String(row.effective_from ?? ''),
    status: String(row.status ?? 'DRAFT'),
    created_by: String(row.created_by ?? ''),
  };
}

async function readLatestFeeTaxDraft(companyId: string, feeKind: TaxAuthorityFeeScope) {
  const { data } = await supabase
    .from('company_fee_tax_treatments')
    .select('id, tax_code, tax_rate, effective_from, status, created_by')
    .eq('company_id', companyId)
    .eq('fee_kind', feeKind)
    .eq('status', 'DRAFT')
    .order('created_at', { ascending: false })
    .limit(1);
  const row = data?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id ?? ''),
    tax_code: String(row.tax_code ?? ''),
    tax_rate: Number(row.tax_rate ?? 0),
    effective_from: String(row.effective_from ?? ''),
    status: String(row.status ?? 'DRAFT'),
    created_by: String(row.created_by ?? ''),
  };
}

export async function getFinanceReadiness(companyId: string): Promise<FinanceReadiness> {
  const today = getTodayLocalDateString();
  const checkedAt = new Date().toISOString();

  // One governed readiness resolution covers rent tax and both fee tax scopes.
  // A failure to reach the authority blocks every tax card: readiness is never
  // inferred from an authorization or transport error.
  let scopes: Readonly<Record<string, TaxAuthorityReadinessStatus>>;
  let readinessError: string | null = null;
  try {
    scopes = await loadTaxAuthorityReadiness(today);
  } catch (e) {
    scopes = {};
    readinessError = e instanceof Error ? e.message : String(e);
  }

  let rentTax: TaxReadiness;
  const rentStatus = scopes[TAX_SCOPE_RENT];
  if (readinessError !== null || rentStatus === undefined) {
    rentTax = {
      state: 'BLOCKED',
      activeProfile: null,
      latestDraft: null,
      errorCode: readinessError ?? TAX_PROFILE_MISSING,
    };
  } else if (rentStatus === TAX_READINESS_READY) {
    rentTax = {
      state: 'READY',
      activeProfile: await readCoveringTaxProfile(companyId, today),
      latestDraft: null,
      errorCode: null,
    };
  } else {
    const latestDraft = await readLatestTaxDraft(companyId);
    rentTax = {
      state: latestDraft ? 'DRAFT_NEEDS_APPROVAL' : 'MISSING',
      activeProfile: null,
      latestDraft,
      errorCode: TAX_PROFILE_MISSING,
    };
  }

  async function getFeeReadiness(
    feeKind: TaxAuthorityFeeScope,
    scope: TaxAuthorityScope,
  ): Promise<FeeTaxReadiness> {
    const status = scopes[scope];
    if (readinessError !== null || status === undefined) {
      return {
        feeKind,
        state: 'BLOCKED',
        activeTreatment: null,
        latestDraft: null,
        errorCode: readinessError ?? FEE_TAX_TREATMENT_MISSING,
      };
    }
    if (status === TAX_READINESS_READY) {
      return {
        feeKind,
        state: 'READY',
        activeTreatment: await readCoveringFeeTaxTreatment(companyId, feeKind, today),
        latestDraft: null,
        errorCode: null,
      };
    }
    const latestDraft = await readLatestFeeTaxDraft(companyId, feeKind);
    return {
      feeKind,
      state: latestDraft ? 'DRAFT_NEEDS_APPROVAL' : 'MISSING',
      activeTreatment: null,
      latestDraft,
      errorCode: FEE_TAX_TREATMENT_MISSING,
    };
  }

  const rateFeeTax = await getFeeReadiness('RATE_MANAGEMENT_FEE', TAX_SCOPE_RATE_MANAGEMENT_FEE);
  const fixedFeeTax = await getFeeReadiness('FIXED_MONTHLY', TAX_SCOPE_FIXED_MONTHLY);

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
