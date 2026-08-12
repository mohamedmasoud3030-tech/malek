import type { Page } from '@playwright/test';
import { IDS } from './fake-supabase-backend';

/**
 * Authenticated browser session for the PR 3 acceptance suite.
 *
 * The app's route guards and permission model read the Supabase session from
 * `localStorage` (`rentrix-auth-session`) exactly as in production. Seeding a
 * well-formed, long-lived session drives the REAL authorization path (roles,
 * permissions, guards) without a live GoTrue server.
 */

export const AUTH_STORAGE_KEY = 'rentrix-auth-session';

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
export const ACCEPTANCE_FULL_NAME = 'اختبار القبول';

export function buildAcceptanceSession(nowMs: number = Date.now()): Record<string, unknown> {
  const expiresInSeconds = 12 * 60 * 60;
  const expiresAt = Math.floor(nowMs / 1000) + expiresInSeconds;
  return {
    access_token: buildAcceptanceAccessToken(IDS.user, IDS.company, expiresAt),
    refresh_token: 'acceptance-refresh-token',
    expires_at: expiresAt,
    expires_in: expiresInSeconds,
    token_type: 'bearer',
    provider_token: null,
    provider_refresh_token: null,
    user: {
      id: IDS.user,
      aud: 'authenticated',
      role: 'authenticated',
      email: ACCEPTANCE_EMAIL,
      email_confirmed_at: new Date(nowMs).toISOString(),
      phone: '',
      confirmed_at: new Date(nowMs).toISOString(),
      last_sign_in_at: new Date(nowMs).toISOString(),
      app_metadata: {
        provider: 'email',
        providers: ['email'],
        user_role: 'ADMIN',
        role: 'ADMIN',
        company_id: IDS.company,
      },
      user_metadata: { full_name: 'اختبار القبول' },
      identities: [],
      created_at: new Date(nowMs).toISOString(),
      updated_at: new Date(nowMs).toISOString(),
      is_anonymous: false,
    },
  };
}

export type AcceptanceBrowserOptions = Readonly<{
  /** Replace `window.print` with a counter so the scoped print popup can be asserted deterministically. */
  interceptPrint?: boolean;
  /** Force `window.open` to return null to exercise the popup-blocked error path. */
  blockPopups?: boolean;
  /** Force the Font Loading API to reject so the renderer's Arabic font failure message surfaces. */
  failFontLoading?: boolean;
}>;

/**
 * Prepares the browser context exactly the way the readiness smoke does
 * (neutral font CDN), then seeds the authenticated session and the requested
 * failure switches. Context-level installation guarantees popup windows
 * opened by the document renderer inherit the same behavior.
 */
export async function installAcceptanceBrowser(page: Page, options: AcceptanceBrowserOptions = {}): Promise<void> {
  const { interceptPrint = true, blockPopups = false, failFontLoading = false } = options;
  const context = page.context();

  // The acceptance suite validates MALEK document behavior, not Google Fonts
  // availability. CI/sandbox networks may block the font CDN; the document
  // platform's approved Arabic fallback stack is the thing under test.
  await context.route('https://fonts.googleapis.com/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' });
  });
  await context.route('https://fonts.gstatic.com/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });

  const session = JSON.stringify(buildAcceptanceSession());
  await context.addInitScript(
    ({ sessionPayload, storageKey, interceptPrintFlag, blockPopupsFlag, failFontLoadingFlag }) => {
      try {
        window.localStorage.setItem(storageKey, sessionPayload);
      } catch {
        // Storage unavailable — the suite will fail visibly on the guard.
      }

      // This acceptance harness intentionally runs without live Supabase env
      // variables and replaces the HTTP boundary with a strict fake backend.
      // Suppress exactly the known bootstrap diagnostic so document tests can
      // still fail on every other console error. This does not alter production
      // code or broaden the document suite's error allowlist.
      const expectedHermeticBootstrapDiagnostic = 'Supabase environment is incomplete. Runtime diagnostics will be shown in UI.';
      const originalConsoleError = console.error.bind(console);
      console.error = (...args: unknown[]) => {
        if (args.length === 1 && String(args[0]) === expectedHermeticBootstrapDiagnostic) return;
        originalConsoleError(...args);
      };

      if (interceptPrintFlag) {
        (window as unknown as { __printCalls: number }).__printCalls = 0;
        window.print = () => {
          (window as unknown as { __printCalls: number }).__printCalls += 1;
        };
      }

      if (blockPopupsFlag) {
        window.open = () => null;
      }

      if (failFontLoadingFlag && typeof document !== 'undefined' && document.fonts) {
        const failingFontsReady = Promise.reject(new Error('acceptance font failure'));
        failingFontsReady.catch(() => undefined);
        Object.defineProperty(document.fonts, 'ready', {
          configurable: true,
          get: () => failingFontsReady,
        });
      }

      (window as unknown as { __downloadNames: string[] }).__downloadNames = [];
      const downloadDescriptor = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, 'download');
      if (downloadDescriptor && downloadDescriptor.set && downloadDescriptor.get) {
        Object.defineProperty(HTMLAnchorElement.prototype, 'download', {
          configurable: true,
          enumerable: downloadDescriptor.enumerable,
          get(this: HTMLAnchorElement) {
            return downloadDescriptor.get!.call(this);
          },
          set(this: HTMLAnchorElement, value: string) {
            (window as unknown as { __downloadNames: string[] }).__downloadNames.push(String(value ?? ''));
            downloadDescriptor.set!.call(this, value);
          },
        });
      }
    },
    {
      sessionPayload: session,
      storageKey: AUTH_STORAGE_KEY,
      interceptPrintFlag: interceptPrint,
      blockPopupsFlag: blockPopups,
      failFontLoadingFlag: failFontLoading,
    },
  );
}
