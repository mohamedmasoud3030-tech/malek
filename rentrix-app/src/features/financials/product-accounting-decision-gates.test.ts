import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const readRepoFile = (path: string) => readFileSync(`${repoRoot}${path}`, 'utf8');

/**
 * Product-accounting decision gates — sourced from ADR 0001.
 *
 * #1373 (2026-08-07) removed `docs/PRODUCT_ACCOUNTING_DECISION_GATES.md` and
 * `docs/FEATURE_GAP_REGISTER.md` as superseded. ADR 0001
 * (`docs/decisions/0001-product-accounting-policies.md`) is the surviving
 * authoritative record: it states it "resolves the policy blockers previously
 * listed in [those docs] for FGR-005 and FGR-008 through FGR-013" and that
 * "product decisions are no longer the blocker for these gates, but
 * implementation, live Supabase verification, browser/staging golden-path
 * evidence, backend authorization evidence, and release sign-off remain
 * blockers". These tests pin the same intent against the ADR: every gate is
 * decided, and the accounting blockers stay visible as implementation-pending.
 */
const requiredDecisionGates = [
  'Office fees',
  'Master leases',
  'Daily contracts',
  'Open-ended contracts',
  'Utility bills must have an explicit charge target before posting',
  'Maintenance requests must end with a charge responsibility',
  'Tenant deposits are tenant liabilities separate from rent',
  'deferred revenue',
] as const;

const relatedFeatureGaps = ['FGR-008', 'FGR-009', 'FGR-010', 'FGR-011', 'FGR-012', 'FGR-013'] as const;

describe('product accounting decision gates', () => {
  it('documents every decided Phase 5 accounting/product gate and required implementation proof', () => {
    const adr = readRepoFile('docs/decisions/0001-product-accounting-policies.md');

    for (const gate of requiredDecisionGates) {
      expect(adr).toContain(gate);
    }

    // Decided — implementation remains the blocker (the ADR's Consequences).
    expect(adr).toContain('Product decisions are no longer the blocker for these gates, but implementation');
    // Implementation proof depends on the release evidence ledger.
    expect(adr).toContain('docs/RELEASE_EVIDENCE_LEDGER.md');
    // Void/reversal behavior is decided with an audit trail.
    expect(adr).toContain('Voids, refunds, and payment reversals must automatically reverse');
  });

  it('keeps decided-but-unimplemented accounting blockers visible (FGR-005, FGR-008..013)', () => {
    const adr = readRepoFile('docs/decisions/0001-product-accounting-policies.md');

    // The ADR explicitly resolves the previously-listed policy blockers — the
    // FGR ids stay on record as implementation-pending, never silently dropped.
    expect(adr).toContain('FGR-005 and FGR-008 through FGR-013');
    expect(adr).toContain('resolves the policy blockers previously listed');

    // No FGR id may be marked closed anywhere in the surviving record.
    expect(adr).not.toMatch(/\| FGR-00[89] \|[^\n]+\| Closed \|/);
    expect(adr).not.toMatch(/\| FGR-01[0-3] \|[^\n]+\| Closed \|/);
  });
});
