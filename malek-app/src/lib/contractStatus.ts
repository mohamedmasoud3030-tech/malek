/**
 * Contract-status casing helpers.
 *
 * Why this exists: the contracts.status CHECK constraint historically allowed
 * both modern lowercase values ('draft' | 'active' | 'expired' | 'terminated')
 * and legacy uppercase ones ('ACTIVE' | 'ENDED') — see the contracts table in
 * supabase/migrations/20260901000000_canonical_baseline.sql, whose own unit-overlap
 * guard deliberately compares lower(status). Live rows can therefore carry
 * either casing, so any exact-match equality, status-keyed lookup, or
 * server-side .eq('status', ...) filter silently misclassifies legacy rows.
 * Route every comparison/lookup through these helpers instead.
 *
 * Business mapping: 'ENDED' is the legacy spelling of today's 'expired'
 * (عقد منتهي المدة). Unknown/empty values fall back to 'draft' so display code
 * always resolves to a safe, neutral bucket instead of rendering blanks.
 */
import type { SemanticTone } from '@/components/ui/status-badge';
export type CanonicalContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export const contractStatusLabels: Record<CanonicalContractStatus, string> = {
  draft: 'مسودة',
  active: 'نشط',
  expired: 'منتهي',
  terminated: 'ملغي',
};

export const contractStatusTone: Record<CanonicalContractStatus, SemanticTone> = {
  draft: 'neutral',
  active: 'success',
  expired: 'warning',
  terminated: 'danger',
};

const CONTRACT_STATUS_CASE_VARIANTS: Readonly<Record<CanonicalContractStatus, readonly string[]>> = {
  draft: ['draft'],
  active: ['active', 'ACTIVE'],
  expired: ['expired', 'ENDED'],
  terminated: ['terminated'],
};

function coerceStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase();
}

export function normalizeContractStatus(status: string | null | undefined): CanonicalContractStatus {
  switch (coerceStatus(status)) {
    case 'active':
      return 'active';
    case 'expired':
    case 'ended':
      return 'expired';
    case 'terminated':
      return 'terminated';
    case 'draft':
    default:
      return 'draft';
  }
}

/** Every stored spelling a canonical status may have in the database. */
export function getContractStatusVariants(status: string | null | undefined): string[] {
  return [...CONTRACT_STATUS_CASE_VARIANTS[normalizeContractStatus(status)]];
}

export function isContractStatus(status: string | null | undefined, canonical: CanonicalContractStatus): boolean {
  return normalizeContractStatus(status) === canonical;
}
