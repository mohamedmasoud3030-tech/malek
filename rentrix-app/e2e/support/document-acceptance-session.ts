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

export function buildAcceptanceSession(nowMs: number = Date.now()): Record<string, unknown> {
  const expiresInSeconds = 12 * 60 * 60;
  const expiresAt = Math.floor(nowMs / 1000) + expiresInSeconds;
  return {
    access_token: 'acceptance-access-token',
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
      email: 'acceptance@malek.test',
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

      if (interceptPrintFlag) {
        // The browser's native print dialog cannot be automated; intercept the
        // invocation itself and count it. Everything before this call (popup,
        // A4 RTL content, asset readiness) remains the real production path.
        (window as unknown as { __printCalls: number }).__printCalls = 0;
        window.print = () => {
          (window as unknown as { __printCalls: number }).__printCalls += 1;
        };
      }

      if (blockPopupsFlag) {
        window.open = () => null;
      }

      if (failFontLoadingFlag && typeof document !== 'undefined' && document.fonts) {
        // One shared rejected promise, pre-handled so mere presence checks
        // (`fonts.ready?.then`) never raise an unhandled rejection — real
        // consumers still observe the rejection through their own awaits.
        const failingFontsReady = Promise.reject(new Error('acceptance font failure'));
        failingFontsReady.catch(() => undefined);
        Object.defineProperty(document.fonts, 'ready', {
          configurable: true,
          get: () => failingFontsReady,
        });
      }

      // Record the exact `download` name jsPDF assigns to its save anchor.
      // jsPDF clicks a DETACHED anchor (never in the DOM), so observe the
      // `download` property assignment itself. Headless-shell flattens
      // non-ASCII suggested names to `download`; the production file name
      // stays observable through this hook.
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
