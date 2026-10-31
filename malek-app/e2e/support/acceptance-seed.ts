/**
 * Seeded acceptance identity — the leaf module of the e2e support graph.
 *
 * `fake-supabase-backend.ts` (the stubbed data plane) and
 * `document-acceptance-session.ts` (the browser session) both need the same
 * UUIDs and the same token shape. Holding them here, in a module that imports
 * neither, keeps those two from importing each other.
 */

export const IDS = {
  company: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  companySettings: '00000000-0000-4000-8000-000000000001',
  tenant: '11111111-1111-4111-8111-111111111111',
  property: '22222222-2222-4222-8222-222222222222',
  unit: '33333333-3333-4333-8333-333333333333',
  contract: '44444444-4444-4444-8444-444444444444',
  invoiceUnpaid: '55555555-5555-4555-8555-555555555501',
  invoicePaid: '55555555-5555-4555-8555-555555555502',
  invoiceOverdue: '55555555-5555-4555-8555-555555555503',
  payment: '66666666-6666-4666-8666-666666666601',
  receipt: '77777777-7777-4777-8777-777777777701',
  owner: '88888888-8888-4888-8888-888888888801',
  user: '99999999-9999-4999-8999-999999999901',
} as const;

/** URL-safe base64 without padding, as used by JWT segments. */
function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Deliberately invalid signature segment.
 *
 * A real Supabase JWT is HMAC-signed with the project's secret. This fixture
 * MUST NOT carry anything that could pass server-side verification, so the
 * signature is a fixed, obviously-fake literal. Consequences, by design:
 *
 *  - the token authenticates nothing: any real GoTrue/PostgREST/Postgres
 *    endpoint rejects it, so it cannot be replayed outside the fake boundary;
 *  - it is not a credential and contains no secret — it is a structural
 *    fixture whose only purpose is to carry the `app_metadata.company_id`
 *    claim the BROWSER reads;
 *  - it is bound to the seeded UUIDs, so it is meaningless anywhere else.
 */
const UNVERIFIABLE_SIGNATURE = 'not-a-real-signature-e2e-fixture-only';

/**
 * Builds a structurally real, INTENTIONALLY UNVERIFIABLE access token for the
 * acceptance session.
 */
export function buildAcceptanceAccessToken(userId: string, companyId: string, expiresAt: number): string {
  if (userId !== IDS.user) throw new Error(`acceptance token: subject must be the seeded user (${IDS.user})`);
  if (companyId !== IDS.company) throw new Error(`acceptance token: company claim must be the seeded company (${IDS.company})`);

  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      sub: userId,
      aud: 'authenticated',
      role: 'authenticated',
      exp: expiresAt,
      email: ACCEPTANCE_EMAIL,
      app_metadata: { provider: 'email', providers: ['email'], user_role: 'ADMIN', role: 'ADMIN', company_id: companyId },
      user_metadata: { full_name: ACCEPTANCE_FULL_NAME },
    }),
  );
  return `${header}.${payload}.${UNVERIFIABLE_SIGNATURE}`;
}

/** Seeded identity constants shared by the session and the fake backend. */
export const ACCEPTANCE_EMAIL = 'acceptance@malek.test';
const ACCEPTANCE_FULL_NAME = 'اختبار القبول';
