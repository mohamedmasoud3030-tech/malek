import { supabase } from '@/lib/supabase';

/**
 * Single canonical browser path to the tax authority.
 *
 * `public.resolve_active_tax_profile(uuid,date)` and
 * `public.resolve_active_fee_tax_treatment(uuid,text,date)` are internal
 * service helpers. Migration
 * `20260901000020_revoke_internal_and_trigger_rpc_execute.sql` revoked browser
 * EXECUTE on both and aborts if that boundary is re-opened, so calling them
 * from the browser always failed with SQLSTATE 42501. They also take a
 * caller-supplied `p_company_id`, which a browser grant would have turned into
 * a cross-company read.
 *
 * `public.resolve_tax_authority_readiness(date[])`
 * (migration `20260904000002_tax_authority_readiness_browser_boundary.sql`) is
 * the governed boundary in front of them. It accepts dates only, derives the
 * company from the authenticated caller, enforces
 * `financial.workspace.view`, and exposes readiness status alone — never a
 * profile id, tax code or rate.
 *
 * Do not add another browser call to either internal resolver: this module is
 * the only browser path to tax readiness.
 */

export const TAX_SCOPE_RENT = 'RENT';
export const TAX_SCOPE_RATE_MANAGEMENT_FEE = 'RATE_MANAGEMENT_FEE';
export const TAX_SCOPE_FIXED_MONTHLY = 'FIXED_MONTHLY';

export type TaxAuthorityScope =
  | typeof TAX_SCOPE_RENT
  | typeof TAX_SCOPE_RATE_MANAGEMENT_FEE
  | typeof TAX_SCOPE_FIXED_MONTHLY;

/**
 * The two fee tax scopes. Fee readiness is resolved per `company_fee_tax_treatments.fee_kind`,
 * so this is also the canonical column vocabulary for fee tax reads.
 */
export type TaxAuthorityFeeScope =
  | typeof TAX_SCOPE_RATE_MANAGEMENT_FEE
  | typeof TAX_SCOPE_FIXED_MONTHLY;

export const TAX_READINESS_READY = 'READY';
/** Preserved verbatim from the authoritative resolver's fail-closed signal. */
export const TAX_PROFILE_MISSING = 'TAX_PROFILE_MISSING';
/** Preserved verbatim from the authoritative fee resolver's fail-closed signal. */
export const FEE_TAX_TREATMENT_MISSING = 'FEE_TAX_TREATMENT_MISSING';

export type TaxAuthorityReadinessStatus =
  | typeof TAX_READINESS_READY
  | typeof TAX_PROFILE_MISSING
  | typeof FEE_TAX_TREATMENT_MISSING;

export type TaxAuthorityReadiness = Readonly<{
  /** Local calendar date `YYYY-MM-DD` the status was resolved for. */
  date: string;
  scope: TaxAuthorityScope;
  status: TaxAuthorityReadinessStatus;
}>;

const KNOWN_SCOPES: readonly string[] = [
  TAX_SCOPE_RENT,
  TAX_SCOPE_RATE_MANAGEMENT_FEE,
  TAX_SCOPE_FIXED_MONTHLY,
];

const KNOWN_STATUSES: readonly string[] = [
  TAX_READINESS_READY,
  TAX_PROFILE_MISSING,
  FEE_TAX_TREATMENT_MISSING,
];

/**
 * PostgREST returns a `date` column as `YYYY-MM-DD`; some drivers return an
 * ISO timestamp instead. Normalizing by string prefix keeps the key on the
 * intended calendar day and never shifts it through the local timezone.
 */
export function taxReadinessDateKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

type TaxAuthorityReadinessRow = Readonly<{
  effective_date?: unknown;
  tax_scope?: unknown;
  readiness_status?: unknown;
}>;

/**
 * Resolves tax authority readiness for the caller's own company.
 *
 * Throws when the governed boundary is unavailable or denies the caller, so
 * every consumer keeps its own fail-closed handling instead of mistaking an
 * authorization failure for "tax configured". An empty date list is not sent
 * to the database at all.
 */
export async function resolveTaxAuthorityReadiness(
  effectiveDates: readonly string[],
): Promise<TaxAuthorityReadiness[]> {
  const requested = [...new Set(effectiveDates.filter((date): date is string => Boolean(date)))].sort();
  if (requested.length === 0) return [];

  const { data, error } = await supabase.rpc('resolve_tax_authority_readiness', {
    p_effective_dates: requested,
  });
  if (error) throw error;

  const readiness: TaxAuthorityReadiness[] = [];
  for (const row of (data ?? []) as TaxAuthorityReadinessRow[]) {
    const date = taxReadinessDateKey(row?.effective_date);
    const scope = typeof row?.tax_scope === 'string' ? row.tax_scope : null;
    const status = typeof row?.readiness_status === 'string' ? row.readiness_status : null;
    if (!date || !scope || !status) continue;
    if (!KNOWN_SCOPES.includes(scope) || !KNOWN_STATUSES.includes(status)) continue;
    readiness.push({
      date,
      scope: scope as TaxAuthorityScope,
      status: status as TaxAuthorityReadinessStatus,
    });
  }
  return readiness;
}

/** Convenience lookup: date → scope → status for one readiness result set. */
export function indexTaxAuthorityReadiness(
  readiness: readonly TaxAuthorityReadiness[],
): ReadonlyMap<string, Readonly<Record<string, TaxAuthorityReadinessStatus>>> {
  const byDate = new Map<string, Record<string, TaxAuthorityReadinessStatus>>();
  for (const entry of readiness) {
    const scopes = byDate.get(entry.date) ?? {};
    scopes[entry.scope] = entry.status;
    byDate.set(entry.date, scopes);
  }
  return byDate;
}
