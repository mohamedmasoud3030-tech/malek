import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const readRepoFile = (path: string) => readFileSync(`${repoRoot}${path}`, 'utf8');

const mandatoryEvidence = [
  'Install/typecheck/lint/build/test suite',
  'Financial tests and readiness gates',
  'Browser smoke across desktop/tablet/mobile',
  'Seeded authenticated staging journey',
  'Supabase live read-only readiness',
  'Financial invoice -> payment -> receipt -> void -> report proof',
  'Backend financial RPC/RLS/grant authorization proof',
  'Product/accounting decision gates',
  'Manual RTL/mobile/device validation',
] as const;

const requiredSeedEnv = ['E2E_BASE_URL', 'E2E_TEST_EMAIL', 'E2E_TEST_PASSWORD', 'SUPABASE_DB_URL', 'RENTRIX_STAGING_SEED_ID'] as const;

describe('release evidence gates', () => {
  it('keeps every mandatory 99.9% evidence item explicit and non-local-only', () => {
    const ledger = readRepoFile('docs/RELEASE_EVIDENCE_LEDGER.md');

    for (const item of mandatoryEvidence) {
      expect(ledger).toContain(item);
    }

    expect(ledger).toContain('Do not label a release candidate as 99.9% ready unless every mandatory evidence item is in its required state');
    expect(ledger).toContain('CI pass');
    expect(ledger).toContain('Operator verified');
    expect(ledger).toContain('Product decided');
  });

  it('documents seeded staging credentials, safe seed data, and stop conditions', () => {
    const runbook = readRepoFile('docs/SEEDED_STAGING_READINESS_RUNBOOK.md');

    for (const variable of requiredSeedEnv) {
      expect(runbook).toContain(variable);
    }

    expect(runbook).toContain('Do not use production tenants, owners, contracts, or real payment records');
    expect(runbook).toContain('invoice -> payment -> receipt -> void receipt/payment -> report proof -> statement proof -> audit proof');
    expect(runbook).toContain('Stop the release readiness claim');
    expect(runbook).toContain('Frontend permission denial is not backed by backend RLS/RPC/grant evidence');
  });
});
