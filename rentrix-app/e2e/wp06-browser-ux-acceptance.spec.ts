import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * WP-06 / GAP-020 Browser & UX Acceptance Hardening — Corrected Evidence Layer
 *
 * Fixes applied for review:
 *  - Touch targets: strict width >=44 AND height >=44 (not 40, not only height)
 *  - Mobile drawer: real AppShell drawer open → body/html locked → focus inside → Escape → focus restored → overflow restored
 *  - PageHeaderActions: mandatory assertions, no conditional false-green paths
 *  - Empty/Error/Permission/Loading: dedicated fixture with direction === 'rtl' only (not rtl|Ltr)
 *
 * Uses:
 *  - Showcase fixtures for overflow/RTL matrix (no Supabase)
 *  - Dedicated state-surfaces fixture for loading/empty/error/permission
 *  - Real authenticated dashboard harness for AppShell drawer
 */

const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 740 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1024', width: 1024, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
] as const;

const SURFACES = [
  { name: 'login', url: '/login', ready: 'form[aria-describedby], form', rtlSelector: 'main[data-login-surface]' },
  { name: 'dashboard-workspace', url: '/login?e2e-dashboard-workspace=1', ready: 'main[data-e2e-dashboard-workspace]', rtlSelector: 'main[data-e2e-dashboard-workspace]' },
  { name: 'properties', url: '/login?e2e-showcase-properties=1', ready: 'main[data-e2e-properties-workspace]', rtlSelector: 'main[data-e2e-properties-workspace]' },
  { name: 'contracts', url: '/login?e2e-showcase-contracts=1', ready: 'main[data-e2e-contracts-workspace]', rtlSelector: 'main[data-e2e-contracts-workspace]' },
  { name: 'financials', url: '/login?e2e-showcase-financials=1', ready: 'main[data-e2e-financials-workspace]', rtlSelector: 'main[data-e2e-financials-workspace]' },
  { name: 'maintenance', url: '/login?e2e-maintenance-workspace=1', ready: 'main[data-e2e-maintenance-workspace]', rtlSelector: '[data-e2e-maintenance-workspace]' },
  { name: 'settings', url: '/login?e2e-settings-workspace=1', ready: 'main[data-e2e-settings-workspace]', rtlSelector: 'main[data-e2e-settings-workspace]' },
  { name: 'reports', url: '/login?e2e-reports-workspace=1', ready: 'main[data-e2e-reports-workspace]', rtlSelector: 'main[data-e2e-reports-workspace]' },
  // Owner detail dossier: the mobile register card with per-row actions. Added
  // after the ≥44px touch matrix missed a 30px property-title <Link> nested
  // inside the mobile card's primary button (invalid interactive nesting +
  // sub-floor target) on this surface.
  { name: 'owners', url: '/login?e2e-owner-detail-workspace=1', ready: 'main[data-e2e-owner-detail-workspace]', rtlSelector: 'main[data-e2e-owner-detail-workspace]' },
] as const;

// ---------------------------------------------------------------------------
// Helpers: overflow, RTL, touch targets (>=44 width AND height)
// ---------------------------------------------------------------------------

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const m = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  const maxScroll = Math.max(m.doc, m.body);
  expect(maxScroll, `${label}: horizontal overflow scroll=${maxScroll} client=${m.client}`).toBeLessThanOrEqual(m.client + 2);
}

async function expectStrictRtl(page: Page, selector: string, label: string) {
  const result = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return { found: false, dir: null as string | null, computed: null as string | null };
    const computed = getComputedStyle(el).direction;
    const attr = el.getAttribute('dir');
    return { found: true, dir: attr, computed };
  }, selector);

  expect(result.found, `${label}: selector ${selector} must exist`).toBe(true);
  // Must be rtl, not ltr. Accept either dir attribute rtl or computed rtl.
  const effectiveDir = result.computed || result.dir;
  expect(effectiveDir, `${label}: must be RTL, got attr=${result.dir} computed=${result.computed}`).toBe('rtl');
}

async function expectTouchTargetsAtLeast44(page: Page, width: number, label: string) {
  if (width > 768) return;
  const offenders = await page.evaluate(() => {
    const isVisible = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
    };
    // Only consider elements that are likely touch controls
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>('button, a[href], [role=\"button\"], input, select, [data-mobile-menu-trigger], [data-mobile-floating-control] button'),
    );
    return candidates
      .filter(isVisible)
      .filter((el) => el.getAttribute('aria-hidden') !== 'true')
      .map((el) => {
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute('aria-label') || el.textContent || el.tagName || '').trim().slice(0, 80);
        return { name, w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((o) => o.w > 0 && o.h > 0)
      .filter((o) => o.w < 44 || o.h < 44);
  });
  expect(offenders, `${label}: touch targets must be >=44x44, offenders=${JSON.stringify(offenders)}`).toEqual([]);
}

async function assertSurface(page: Page, surface: (typeof SURFACES)[number], viewport: (typeof VIEWPORTS)[number]) {
  const label = `${surface.name}@${viewport.name}`;
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(surface.url, { waitUntil: 'domcontentloaded' });
  await expect(page.locator(surface.ready).first(), `${label}: ready marker ${surface.ready}`).toBeVisible({ timeout: 20_000 });
  await expectStrictRtl(page, surface.rtlSelector, label);
  await expectNoHorizontalOverflow(page, label);
  await expectTouchTargetsAtLeast44(page, viewport.width, label);
}

// ---------------------------------------------------------------------------
// Authenticated AppShell harness for real drawer test (copied minimal from dashboard-workspace spec)
// ---------------------------------------------------------------------------

function encodeJwtPart(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sessionPayload() {
  const companyId = '00000000-0000-4000-8000-000000000101';
  const userId = '00000000-0000-4000-8000-000000000201';
  const nowIso = '2026-08-05T08:00:00.000Z';
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const app_metadata = { user_role: 'ADMIN', role: 'ADMIN', company_id: companyId };
  const accessToken = `${encodeJwtPart({ alg: 'HS256', typ: 'JWT' })}.${encodeJwtPart({ sub: userId, role: 'authenticated', email: 'dashboard-admin@malek.test', app_metadata, exp: expiresAt })}.e2e-signature`;
  return {
    access_token: accessToken,
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'dashboard-admin@malek.test',
      app_metadata,
      user_metadata: {},
      created_at: nowIso,
      updated_at: nowIso,
    },
    companyId,
    userId,
    nowIso,
  };
}

const companySettings = {
  id: '00000000-0000-4000-8000-000000000301',
  singleton_key: true,
  company_name: 'MALEK',
  legal_name: null,
  tax_number: null,
  registration_number: null,
  phone: null,
  email: null,
  address: null,
  city: null,
  country: 'OM',
  currency: 'OMR',
  locale: 'ar-OM',
  timezone: 'Asia/Muscat',
  date_format: 'dd/MM/yyyy',
  number_format: 'ar-OM',
  logo_url: null,
  invoice_prefix: 'INV',
  contract_prefix: 'CON',
  receipt_prefix: 'REC',
  default_vat_rate: 0,
  vat_enabled: false,
  vat_rate: 5,
  vat_registration_number: null,
  notification_email_enabled: true,
  notification_sms_enabled: false,
  created_at: '2026-08-05T08:00:00.000Z',
  updated_at: '2026-08-05T08:00:00.000Z',
};

function minimalTableRows(table: string) {
  if (table === 'company_members') {
    const { companyId } = sessionPayload();
    return [{ company_id: companyId, role: 'OWNER', companies: { id: companyId, name: 'MALEK Demo', slug: 'malek-demo', currency: 'OMR', locale: 'ar-OM' } }];
  }
  if (table === 'company_settings') return companySettings;
  return [];
}

function contentRangeFor(body: unknown) {
  if (!Array.isArray(body)) return '0-0/1';
  return body.length > 0 ? `0-${body.length - 1}/${body.length}` : '*/0';
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-expose-headers': 'content-range',
      'content-range': contentRangeFor(body as any),
    },
    body: JSON.stringify(body),
  });
}

async function installMinimalAppShellHarness(page: Page) {
  await page.unroute('**/*').catch(() => undefined);
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.hostname.includes('supabase') && url.hostname !== 'invalid.supabase.local') {
      await route.continue();
      return;
    }
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      return;
    }
    if (url.pathname.includes('/auth/v1/token') || url.pathname.includes('/auth/v1/user')) {
      await fulfillJson(route, sessionPayload());
      return;
    }
    if (url.pathname.endsWith('/rest/v1/rpc/rpt_dashboard_overview')) {
      await fulfillJson(route, {
        financial: { total_collected: 0, total_overdue_invoices: 0, total_expenses: 0, net_revenue: 0 },
        operational: { properties: 0, units: 0, activeContracts: 0, expiringContracts30Days: 0, vacantUnits: 0, overdueInvoices: 0 },
      });
      return;
    }
    const tableMatch = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
    if (tableMatch) {
      const table = tableMatch[1] ?? '';
      await fulfillJson(route, minimalTableRows(table));
      return;
    }
    await fulfillJson(route, []);
  });
}

async function openAuthenticatedDashboard(page: Page) {
  await installMinimalAppShellHarness(page);
  await page.addInitScript(() => {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.dir = 'rtl';
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const sess = sessionPayload();
  await page.evaluate((session) => {
    window.localStorage.setItem('rentrix-auth-session', JSON.stringify(session));
  }, sess);
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('[data-app-shell]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-app-shell-header]')).toBeVisible();
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'WP-06 acceptance matrix runs once in chromium-desktop shard');
});

for (const vp of VIEWPORTS) {
  test(`WP-06 viewport matrix ${vp.name} — RTL strict and no overflow (44px touch)`, async ({ page }) => {
    for (const surface of SURFACES) {
      await assertSurface(page, surface, vp);
    }
  });
}

test('WP-06 mobile drawer — real AppShell interaction: open → lock scroll → focus → Escape → restore', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openAuthenticatedDashboard(page);

  // Initial overflow should be default (not hidden)
  const initialOverflow = await page.evaluate(() => ({
    body: document.body.style.overflow,
    html: document.documentElement.style.overflow,
  }));
  // Should not be hidden before opening
  expect(initialOverflow.body).not.toBe('hidden');

  // Find mobile menu trigger — visible only on mobile (< lg)
  const trigger = page.locator('[data-mobile-menu-trigger]').first();
  await expect(trigger, 'mobile menu trigger must be visible on 375px').toBeVisible({ timeout: 15_000 });
  await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');

  // Focus trigger first to test restoration
  await trigger.focus();
  await expect(trigger).toBeFocused();

  // Open drawer
  await trigger.click();

  // Drawer must appear
  const drawer = page.locator('[data-mobile-drawer]').first();
  await expect(drawer, 'mobile drawer must be visible after trigger click').toBeVisible({ timeout: 10_000 });
  await expect(drawer).toHaveAttribute('aria-modal', 'true');

  // Body and html should be locked
  const lockedOverflow = await page.evaluate(() => ({
    body: document.body.style.overflow,
    html: document.documentElement.style.overflow,
  }));
  expect(lockedOverflow.body, 'body overflow must be hidden when drawer open').toBe('hidden');
  expect(lockedOverflow.html, 'html overflow must be hidden when drawer open').toBe('hidden');

  // Focus must be inside dialog (close button has autoFocus)
  const closeBtn = drawer.locator('button[aria-label="إغلاق القائمة"]').first();
  await expect(closeBtn, 'close button inside drawer must be visible').toBeVisible();
  await expect(closeBtn).toBeFocused({ timeout: 5_000 });

  // Press Escape to close
  await page.keyboard.press('Escape');

  // Drawer must be gone
  await expect(drawer).toHaveCount(0, { timeout: 10_000 });

  // Overflow restored (not hidden)
  const restoredOverflow = await page.evaluate(() => ({
    body: document.body.style.overflow,
    html: document.documentElement.style.overflow,
  }));
  // Should restore to initial values (not hidden). Could be '' or 'auto' etc, but not 'hidden'
  expect(restoredOverflow.body, 'body overflow must be restored after close').not.toBe('hidden');
  expect(restoredOverflow.html, 'html overflow must be restored after close').not.toBe('hidden');

  // Focus should be restored to trigger (Radix Dialog restores focus)
  await expect(trigger).toBeFocused({ timeout: 5_000 });

  // No horizontal overflow after interaction
  await expectNoHorizontalOverflow(page, 'drawer-after-close');
});

test('WP-06 PageHeaderActions — mandatory overflow trigger and bottom sheet behavior on 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/login?e2e-showcase-properties=1', { waitUntil: 'domcontentloaded' });

  // Mandatory: page header must exist
  const header = page.locator('[data-page-header]').first();
  await expect(header, 'PageHeader must exist on properties showcase').toBeVisible({ timeout: 20_000 });

  // Mandatory: page actions rail must exist
  const actionsRail = page.locator('[data-page-actions]').first();
  await expect(actionsRail, 'Page actions rail must exist').toBeVisible({ timeout: 10_000 });

  // Mandatory: secondary actions desktop container must exist (hidden on mobile but in DOM)
  const secondaryDesktop = page.locator('[data-secondary-actions-desktop]').first();
  await expect(secondaryDesktop, 'Secondary actions desktop container must exist in DOM').toBeAttached({ timeout: 10_000 });

  // Mandatory: on 320px, secondary actions should be collapsed into overflow trigger
  const overflowTrigger = page.locator('[data-secondary-overflow-trigger] button').first();
  await expect(overflowTrigger, 'Overflow trigger must be visible on 320px when secondary actions exist').toBeVisible({ timeout: 10_000 });
  await expect(overflowTrigger).toHaveAttribute('aria-haspopup', 'dialog');
  // Touch target >=44
  const triggerBox = await overflowTrigger.boundingBox();
  expect(triggerBox, 'overflow trigger box must exist').not.toBeNull();
  expect(triggerBox!.width, 'overflow trigger width >=44').toBeGreaterThanOrEqual(44);
  expect(triggerBox!.height, 'overflow trigger height >=44').toBeGreaterThanOrEqual(44);

  // Click to open bottom sheet
  await overflowTrigger.click();

  const sheet = page.locator('[data-bottom-sheet]').first();
  await expect(sheet, 'Bottom sheet must appear after overflow trigger click').toBeVisible({ timeout: 10_000 });

  // Bottom sheet should contain full-width buttons
  const sheetButtons = sheet.locator('button');
  await expect(sheetButtons.first()).toBeVisible();
  for (const btn of await sheetButtons.all()) {
    const box = await btn.boundingBox();
    if (box) {
      expect(box.height, 'bottom sheet button height >=44').toBeGreaterThanOrEqual(44);
    }
  }

  // Close via Escape
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0, { timeout: 10_000 });

  await expectNoHorizontalOverflow(page, 'page-header-actions-320-after');
});

test('WP-06 shared Dialog — aria-modal, focus trap, Escape close, focus returns to opener (no DialogTrigger anywhere)', async ({ page }) => {
  // Every dialog in the app is opened from a plain button via state — there is
  // no <DialogTrigger> in the codebase — so Radix's close-autofocus has a null
  // triggerRef and used to drop focus to <body>. The shared DialogContent now
  // captures the opening element (onOpenAutoFocus) and restores it on close.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/login?e2e-form-contract=1', { waitUntil: 'domcontentloaded' });
  const dialog = page.locator('[data-dialog-content]').first();
  await expect(dialog, 'entity form dialog must open').toBeVisible({ timeout: 15_000 });

  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAttribute('role', 'dialog');

  // Initial focus must be inside the dialog
  await expect
    .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)), { timeout: 5_000 })
    .toBe(true);

  // Focus must not escape the dialog while open
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
    expect(inside, `focus escaped dialog on Tab #${i}`).toBe(true);
  }

  // Escape closes (programmatic initial open has no opener — body focus is fine here)
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0, { timeout: 5_000 });

  // Reopen through the real button — this is the trigger-opened flow
  const reopen = page.getByRole('button', { name: 'فتح النموذج' });
  await reopen.click();
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0, { timeout: 5_000 });

  // WCAG 2.4.3: focus must return to the control that opened the dialog
  await expect(reopen).toBeFocused({ timeout: 5_000 });
});

test('WP-06 shared Dialog — edge cases: two launchers, nested dialogs, unmounted launcher, rapid cycles', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/login?e2e-dialog-focus=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-e2e-dialog-focus]')).toBeVisible({ timeout: 15_000 });

  const launcherA = page.locator('[data-e2e-launcher-a]');
  const launcherB = page.locator('[data-e2e-launcher-b]');
  const dialogA = page.locator('[data-e2e-dialog-a]');
  const dialogB = page.locator('[data-e2e-dialog-b]');
  const nested = page.locator('[data-e2e-dialog-nested]');

  // 1. Independent launchers: each close restores to its own opener.
  await launcherA.click();
  await expect(dialogA).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(dialogA).toHaveCount(0, { timeout: 5_000 });
  await expect(launcherA).toBeFocused({ timeout: 5_000 });

  await launcherB.click();
  await expect(dialogB).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(dialogB).toHaveCount(0, { timeout: 5_000 });
  await expect(launcherB).toBeFocused({ timeout: 5_000 });

  // 2. Nested dialog: closing the inner dialog returns focus to its trigger
  //    inside the still-open outer dialog; closing the outer dialog returns
  //    focus to the original launcher.
  await launcherA.click();
  await expect(dialogA).toBeVisible({ timeout: 10_000 });
  const nestedTrigger = page.locator('[data-e2e-nested-trigger]');
  await nestedTrigger.click();
  await expect(nested).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(nested).toHaveCount(0, { timeout: 5_000 });
  await expect(nestedTrigger).toBeFocused({ timeout: 5_000 });
  await page.keyboard.press('Escape');
  await expect(dialogA).toHaveCount(0, { timeout: 5_000 });
  await expect(launcherA).toBeFocused({ timeout: 5_000 });

  // 3. Launcher unmounts while its dialog is open (e.g. the row holding the
  //    action is removed/refreshed): close must not throw and must not leave
  //    focus inside a detached subtree. The unmount is React-state-driven
  //    (the launcher's parent toggles it off from inside the dialog), exactly
  //    like a list refresh removing the row behind an open dialog.
  await launcherA.click();
  await expect(dialogA).toBeVisible({ timeout: 10_000 });
  await page.locator('[data-e2e-hide-launcher-inside]').click();
  await expect(launcherA).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialogA).toHaveCount(0, { timeout: 5_000 });
  const activeTag = await page.evaluate(() => document.activeElement?.tagName ?? 'none');
  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(activeTag).not.toBe('none');

  // 4. Rapid open/close cycles from the same launcher keep restoring focus.
  //    Restore the launcher removed in step 3 (the dialog is closed now, so the
  //    fixture toggle is reachable again).
  await page.locator('button', { hasText: 'إظهار/إخفاء زر أ' }).click();
  await expect(launcherA).toBeVisible({ timeout: 5_000 });
  await launcherA.click();
  await expect(dialogA).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(dialogA).toHaveCount(0, { timeout: 5_000 });
  await launcherA.click();
  await expect(dialogA).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(dialogA).toHaveCount(0, { timeout: 5_000 });
  await expect(launcherA).toBeFocused({ timeout: 5_000 });

  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});

test('WP-06 Loading / Empty / Error / Permission surfaces — RTL strict and overflow-safe', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/login?e2e-state-surfaces=1', { waitUntil: 'domcontentloaded' });

  const root = page.locator('[data-e2e-state-surfaces]').first();
  await expect(root, 'State surfaces root must exist').toBeVisible({ timeout: 15_000 });

  // Root must be RTL strictly
  await expectStrictRtl(page, '[data-e2e-state-surfaces]', 'state-surfaces root');

  // Loading
  const loadingSection = page.locator('[data-e2e-state-section="loading"]').first();
  await expect(loadingSection, 'Loading section must exist').toBeVisible();
  await expect(page.locator('[data-e2e-loading-surface]').first(), 'Loading surface must exist').toBeVisible();
  await expectStrictRtl(page, '[data-e2e-state-section="loading"]', 'loading section');

  // Empty
  const emptySection = page.locator('[data-e2e-state-section="empty"]').first();
  await expect(emptySection, 'Empty section must exist').toBeVisible();
  const emptyCard = page.locator('[data-e2e-empty-surface] [data-empty-state]').first();
  await expect(emptyCard, 'EmptyState must be rendered').toBeVisible();
  await expect(emptyCard).toHaveAttribute('dir', 'rtl');
  await expectStrictRtl(page, '[data-e2e-empty-surface]', 'empty surface');
  const emptyTitle = emptyCard.locator('h3').first();
  await expect(emptyTitle, 'EmptyState title must be visible').toBeVisible();

  // Error
  const errorSection = page.locator('[data-e2e-state-section="error"]').first();
  await expect(errorSection, 'Error section must exist').toBeVisible();
  const errorSurface = page.locator('[data-e2e-error-surface]').first();
  await expect(errorSurface, 'Error surface must exist').toBeVisible();
  await expect(errorSurface.locator('[role="alert"]').first(), 'Error surface must have alert role').toBeVisible();
  await expectStrictRtl(page, '[data-e2e-state-section="error"]', 'error section');

  // Permission
  const permSection = page.locator('[data-e2e-state-section="permission"]').first();
  await expect(permSection, 'Permission section must exist').toBeVisible();
  const permSurface = page.locator('[data-e2e-permission-surface]').first();
  await expect(permSurface, 'Permission surface must exist').toBeVisible();
  const accessDenied = permSurface.locator('text=غير مصرح').first();
  // AccessDenied component renders card with title غير مصرح بالوصول
  await expect(permSurface, 'Permission AccessDenied must be visible').toContainText('غير مصرح');
  await expectStrictRtl(page, '[data-e2e-state-section="permission"]', 'permission section');

  // All sections must not cause horizontal overflow
  await expectNoHorizontalOverflow(page, 'state-surfaces-375');

  // Touch targets >=44 in state surfaces
  await expectTouchTargetsAtLeast44(page, 375, 'state-surfaces-touch');
});
