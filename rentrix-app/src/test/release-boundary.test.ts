/**
 * Release-boundary guard.
 *
 * The repository has exactly two browser-test categories and they must stay
 * distinct. If a future change blurs them, release verification quietly becomes
 * hermetic again — which is precisely the failure this test exists to prevent.
 *
 * It asserts, from the files on disk:
 *   1. the hermetic config ignores `e2e/release/**` and never targets a live host;
 *   2. the release config has no webServer and requires an explicit HTTPS target;
 *   3. the release suites fail closed — they never `test.skip` on missing env;
 *   4. the production smoke suite performs no mutating HTTP verb;
 *   5. the mutating journey is restricted to an isolated environment kind.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = resolve(import.meta.dirname, '../..');

function read(relativePath: string): string {
  return readFileSync(resolve(appRoot, relativePath), 'utf8');
}

const hermeticConfig = read('playwright.config.ts');
const releaseConfig = read('playwright.release.config.ts');
const envModule = read('e2e/release/env.ts');
const smokeSuite = read('e2e/release/production-smoke.spec.ts');
const journeySuite = read('e2e/release/real-stack-journey.spec.ts');

describe('release verification boundary', () => {
  it('keeps the hermetic suite from collecting the real-backend suites', () => {
    expect(hermeticConfig).toContain("testIgnore: ['release/**']");
  });

  it('keeps the hermetic suite pinned to a never-resolvable backend', () => {
    expect(hermeticConfig).toContain('e2e.supabase.invalid');
    expect(hermeticConfig).not.toMatch(/nnggcnpcuomwfuupupwg/);
  });

  it('requires the release config to target an already deployed HTTPS surface', () => {
    expect(releaseConfig).toContain('E2E_BASE_URL');
    expect(releaseConfig).toContain("!== 'https:'");
    // No webServer: release verification must never test a locally served build.
    expect(releaseConfig).not.toMatch(/webServer\s*:/);
    // Retries would turn a flaky release gate into a green one.
    expect(releaseConfig).toContain('retries: 0');
  });

  it('makes both real-backend suites fail closed instead of skipping', () => {
    for (const suite of [smokeSuite, journeySuite]) {
      expect(suite).not.toMatch(/test\.skip\(/);
      expect(suite).not.toMatch(/test\.fixme\(/);
      expect(suite).toContain('expectRealBackend');
    }
    // env.ts is where the fail-closed rule is implemented.
    expect(envModule).toContain('must fail, never skip');
    expect(envModule).not.toMatch(/process\.env\[[^\]]+\]\s*\?\?/);
  });

  it('keeps the production smoke suite strictly read-only', () => {
    expect(smokeSuite).toContain("expect(environmentKind()).toBe('production-readonly')");

    // The only POST permitted in this file is the read-only tenant-context
    // resolver `current_company_id`, which is a POST by PostgREST convention
    // and writes nothing. Every other mutating verb is forbidden outright.
    const postLines = smokeSuite
      .split('\n')
      .filter((line) => /method:\s*'POST'/.test(line));
    expect(postLines.length, 'the read-only allowance must not be vacuous').toBeGreaterThan(0);
    for (const line of postLines) {
      expect(line, 'only the read-only current_company_id RPC may be POSTed').toContain('current_company_id');
    }

    expect(smokeSuite).not.toMatch(/method:\s*'PATCH'/);
    expect(smokeSuite).not.toMatch(/method:\s*'DELETE'/);
    expect(smokeSuite).not.toMatch(/method:\s*'PUT'/);
    // No command-RPC that mutates may ever appear here.
    expect(smokeSuite).not.toMatch(/record_invoice_payment|create_contract|void_receipt|post_journal/);
  });

  it('confines the mutating journey to an isolated environment', () => {
    expect(journeySuite).toContain('assertIsolatedEnvironment()');
    expect(envModule).toContain("if (kind !== 'qa')");
    expect(envModule).toContain('E2E_ENVIRONMENT_KIND=qa');
  });

  it('rejects placeholder backends in the real-backend suites', () => {
    expect(envModule).toContain('\\.invalid');
    expect(envModule).toContain('example\\.supabase\\.co');
  });

  it('cleans up only the records it created', () => {
    expect(journeySuite).toContain('createdPropertyIds.push');
    expect(journeySuite).toMatch(/for \(const id of createdPropertyIds\)/);
  });
});
