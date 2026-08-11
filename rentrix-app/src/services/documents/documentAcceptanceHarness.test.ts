/**
 * WP-06 — E2E harness integrity guard.
 *
 * The document acceptance suite needs a session fixture and a fake Supabase
 * boundary. Both are test support, but a sloppy harness can quietly weaken
 * the very guarantees the suite claims to prove. These tests pin the harness
 * contract itself:
 *
 *  - the fixture token is structurally valid but INTENTIONALLY unverifiable,
 *    so it can never authenticate against a real environment;
 *  - its subject, role and company claim match the seeded user/membership
 *    exactly, so the production company-resolution path is exercised rather
 *    than bypassed;
 *  - the fake backend stays FAIL-CLOSED: unknown tables/RPCs must not be
 *    answered with a permissive success;
 *  - realtime/WebSocket tolerance is limited to the known fake endpoint and
 *    must not mask real application errors or failed HTTP requests.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCEPTANCE_EMAIL,
  buildAcceptanceAccessToken,
  buildAcceptanceSession,
} from '../../../e2e/support/document-acceptance-session';
import { IDS } from '../../../e2e/support/fake-supabase-backend';

const e2eDir = resolve(import.meta.dirname, '../../../e2e');
const read = (relativePath: string) => readFileSync(resolve(e2eDir, relativePath), 'utf8');

const decodeSegment = (segment: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

describe('acceptance session fixture — shaped, bound, and unusable elsewhere', () => {
  const token = buildAcceptanceAccessToken(IDS.user, IDS.company, Math.floor(Date.now() / 1000) + 3600);
  const [header, payload, signature] = token.split('.');

  it('is a three-segment JWT the browser can decode', () => {
    expect(token.split('.')).toHaveLength(3);
    expect(decodeSegment(header)).toMatchObject({ typ: 'JWT' });
  });

  it('carries the company claim exactly where production reads it', () => {
    const claims = decodeSegment(payload) as { app_metadata?: Record<string, unknown> };
    expect(claims.app_metadata?.company_id).toBe(IDS.company);
  });

  it('binds subject, audience, role and email to the seeded identity', () => {
    const claims = decodeSegment(payload) as Record<string, unknown>;
    expect(claims.sub).toBe(IDS.user);
    expect(claims.aud).toBe('authenticated');
    expect(claims.role).toBe('authenticated');
    expect(claims.email).toBe(ACCEPTANCE_EMAIL);
  });

  it('matches the seeded session user and the seeded company membership', () => {
    const session = buildAcceptanceSession() as { access_token: string; user: { id: string; app_metadata: Record<string, unknown> } };
    const claims = decodeSegment(session.access_token.split('.')[1]) as { sub?: string; app_metadata?: Record<string, unknown> };

    // Session user ↔ token subject ↔ seeded company_members.user_id
    expect(session.user.id).toBe(IDS.user);
    expect(claims.sub).toBe(session.user.id);
    // Token company claim ↔ session app_metadata ↔ seeded company_members.company_id
    expect(claims.app_metadata?.company_id).toBe(IDS.company);
    expect(session.user.app_metadata.company_id).toBe(IDS.company);

    // The seeded membership row must actually authorize that pair, otherwise
    // the provider would (correctly) fail closed.
    const backendSource = read('support/fake-supabase-backend.ts');
    expect(backendSource).toContain('company_id: IDS.company');
    expect(backendSource).toContain('user_id: IDS.user');
    expect(backendSource).toContain('is_active: true');
  });

  it('refuses to mint a token for any identity other than the seeded one', () => {
    const later = Math.floor(Date.now() / 1000) + 3600;
    expect(() => buildAcceptanceAccessToken('99999999-9999-4999-8999-999999999999', IDS.company, later)).toThrow(/seeded user/);
    expect(() => buildAcceptanceAccessToken(IDS.user, 'ffffffff-ffff-4fff-8fff-ffffffffffff', later)).toThrow(/seeded company/);
  });

  it('is NOT a usable credential: the signature is an obvious fake and no secret is embedded', () => {
    expect(signature).toBe('not-a-real-signature-e2e-fixture-only');
    // A real HS256 signature is base64url of 32 bytes (~43 chars) and would
    // never contain these words.
    expect(signature).toMatch(/not-a-real-signature/);
    const sessionSource = read('support/document-acceptance-session.ts');
    for (const secretish of ['service_role', 'SUPABASE_SERVICE', 'sk_live', 'BEGIN PRIVATE KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M']) {
      expect(sessionSource).not.toContain(secretish);
    }
  });

  it('uses only synthetic, clearly non-production identities', () => {
    expect(ACCEPTANCE_EMAIL).toMatch(/@malek\.test$/);
    // Seeded UUIDs are patterned placeholders, not real records.
    expect(IDS.user).toMatch(/^9{8}-/);
    expect(IDS.company).toMatch(/^a{8}-/);
  });
});

describe('fake Supabase backend — fail-closed', () => {
  const backendSource = read('support/fake-supabase-backend.ts');

  it('answers an UNSEEDED RPC with an error, never a permissive success', () => {
    expect(backendSource).toContain('UNSEEDED RPC');
    expect(backendSource).toMatch(/fulfillJson\(route, 404, \{ code: 'PGRST202'/);
    // The previous permissive default must stay gone.
    expect(backendSource).not.toContain('Lenient default');
  });

  it('surfaces an UNSEEDED table read as a visible warning', () => {
    expect(backendSource).toContain('UNSEEDED TABLE');
  });

  it('seeds the permission-requests RPC as its own array contract', () => {
    // Seeded as an explicit endpoint with its real set-returning shape —
    // not by loosening the unknown-RPC default.
    expect(backendSource).toContain('list_permission_requests_for_review: () => []');
  });

  it('stays read-only: mutating HTTP verbs are refused', () => {
    expect(backendSource).toContain('Acceptance backend is read-only');
  });

  it('does not blanket-allow storage', () => {
    expect(backendSource).toContain('no storage in acceptance backend');
  });
});

describe('console-error tolerance is narrow', () => {
  const specSource = read('wp06-document-output.spec.ts');

  it('tolerates only the known unreachable realtime endpoint', () => {
    expect(specSource).toContain('realtime/v1/websocket');
    expect(specSource).toContain('WebSocket connection to');
  });

  it('never suppresses application errors, failed requests or React warnings wholesale', () => {
    // A catch-all would make the "no console errors" assertion meaningless.
    for (const forbidden of ['() => true', 'allowed.push', 'Error', 'Warning', 'Uncaught']) {
      expect(
        specSource.includes(`    '${forbidden}',`),
        `console allowlist must not contain a blanket '${forbidden}' entry`,
      ).toBe(false);
    }
  });

  it('still asserts on unexpected console errors in the document scenarios', () => {
    expect(specSource).toContain('expect(unexpectedConsoleErrors(consoleErrors)).toEqual([])');
  });
});
