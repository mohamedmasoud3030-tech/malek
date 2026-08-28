import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * MALEK Mobile Launch Polish — real-browser acceptance at 320 / 375 / 390,
 * in BOTH Arabic RTL and English LTR rendering.
 *
 * Covers the launch-polish contract that unit tests can only approximate:
 *  - Top header: [M mark] [MALEK] lockup on one end, compact User/Theme
 *    controls on the other end, NO day+date in the header.
 *  - Page/date context strip: current page name + localized weekday + date.
 *  - Quick Add: clear VERTICAL action stack (one action per row).
 *  - Bottom dock: Menu / Search / Quick Add / Notifications / AI, never covering content.
 *  - Primary navigation: shared bottom sheet, fully inside the viewport.
 *  - Entity cards (properties/units/contracts): scan-level summary fields
 *    and flat secondary actions (no «إجراءات» disclosure layer).
 *
 * RTL is the app's canonical direction. The LTR leg changes the document's
 * single direction authority to prove the composition is direction-safe without
 * introducing a competing shell-local `dir` source.
 *
 * The Supabase HTTP boundary is stubbed per browser context (hermetic CI).
 */

const COMPANY_ID = '00000000-0000-4000-8000-000000000101';
const USER_ID = '00000000-0000-4000-8000-000000000201';
const NOW_ISO = '2026-08-05T08:00:00.000Z';

function encodeJwtPart(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sessionPayload() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const app_metadata = { user_role: 'ADMIN', role: 'ADMIN', company_id: COMPANY_ID };
  const accessToken = `${encodeJwtPart({ alg: 'HS256', typ: 'JWT' })}.${encodeJwtPart({ sub: USER_ID, role: 'authenticated', email: 'launch-polish@malek.test', app_metadata, exp: expiresAt })}.e2e-signature`;
  return {
    access_token: accessToken,
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'launch-polish@malek.test',
      app_metadata,
      user_metadata: {},
      created_at: NOW_ISO,
      updated_at: NOW_ISO,
    },
  };
}

const companySettings = {
  id: '00000000-0000-4000-8000-000000000001',
  company_id: COMPANY_ID,
  company_name: 'MALEK Demo',
  currency: 'OMR',
  currency_decimals: 3,
  locale: 'ar-OM',
  timezone: 'Asia/Muscat',
  number_format: 'ar-OM',
  logo_url: null,
  invoice_prefix: 'INV',
  contract_prefix: 'CON',
  receipt_prefix: 'REC',
  default_vat_rate: 0,
  vat_enabled: false,
  created_at: NOW_ISO,
  updated_at: NOW_ISO,
};

const owners = [
  { id: 'owner-1', name: 'مالك برج الخليج', full_name: 'مالك برج الخليج', display_name: 'مالك برج الخليج', deleted_at: null, is_active: true },
];

const properties = [
  {
    id: 'property-1',
    owner_id: 'owner-1',
    name: 'برج الخليج',
    title: 'برج الخليج',
    type: 'سكني',
    address: 'مسقط',
    status: 'active',
    purchase_value: null,
    current_value: null,
    notes: null,
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
    deleted_at: null,
    units: [
      { id: 'unit-1', status: 'occupied' },
      { id: 'unit-2', status: 'occupied' },
      { id: 'unit-3', status: 'available' },
    ],
    property_owners: [
      { id: 'po-1', owner_id: 'owner-1', is_primary: true, starts_on: '2025-01-01', ends_on: null, owner: owners[0] },
    ],
    owner_agreements: [{ id: 'oa-1', starts_on: '2025-01-01', ends_on: null }],
  },
];

const units = [
  { id: 'unit-1', property_id: 'property-1', unit_number: '101', floor: '1', status: 'occupied', rent_amount: 420, notes: null, deleted_at: null },
  { id: 'unit-2', property_id: 'property-1', unit_number: '102', floor: '1', status: 'occupied', rent_amount: 450, notes: null, deleted_at: null },
  { id: 'unit-3', property_id: 'property-1', unit_number: '103', floor: '2', status: 'available', rent_amount: 500, notes: 'جاهزة للتسليم', deleted_at: null },
];

const people = [
  { id: 'tenant-1', type: 'tenant', full_name: 'أحمد الفارسي', phone: null, email: null, national_id: null, deleted_at: null },
];

const contracts = [
  {
    id: 'contract-1',
    property_id: 'property-1',
    unit_id: 'unit-1',
    tenant_id: 'tenant-1',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    rent_amount: 420,
    payment_cycle: 'monthly',
    status: 'active',
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
    deleted_at: null,
    notes: null,
    agreement_id: null,
    payment_terms_id: null,
    cancellation_reason: null,
    attachment_url: null,
    renewed_from_id: null,
    reference: 'CON-1001',
    properties: { id: 'property-1', title: 'برج الخليج', address: 'مسقط' },
    units: { id: 'unit-1', unit_number: '101', floor: '1', status: 'occupied', rent_amount: 420 },
    people: { id: 'tenant-1', full_name: 'أحمد الفارسي', phone: null, email: null, national_id: null },
  },
];

const minimalSnapshot = {
  meta: { source: 'rpt_dashboard_snapshot' },
  portfolio: { properties: 1, units: 3 },
  occupancy: { occupied_units: 2, vacant_units: 1, occupancy_rate: 67 },
  contracts: { active: 1, expiring_30: 0, expiring_60: 0, expiring_90: 0 },
  billing: { invoiced_amount: 5040, invoices_count: 3, invoices_total_count: 3 },
  collections: { collected_amount: 4200, payments_count: 1, outstanding_amount: 840, collection_rate: 83 },
  expenses: { total_amount: 0, count: 0 },
  net_cash: 4200,
  arrears: {
    total_overdue: 0, overdue_count: 0, average_days_overdue: 0,
    over_90_amount: 0, over_90_count: 0, total_outstanding: 840,
    buckets: {
      current: { total: 0, count: 0 },
      days_1_30: { total: 0, count: 0 },
      days_31_60: { total: 0, count: 0 },
      days_61_90: { total: 0, count: 0 },
      days_90_plus: { total: 0, count: 0 },
    },
  },
  owner_funds: { net_payable: 0, settlements_draft: 0, settlements_approved: 0 },
  maintenance: { open: 0, in_progress: 0, urgent_open: 0 },
  exceptions: { unmatched_bank_lines: 0, pending_settlements: 0 },
  queues: { expiring_contracts: [], overdue_invoices: [], urgent_maintenance: [] },
};

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
      'content-range': contentRangeFor(body),
    },
    body: JSON.stringify(body),
  });
}

function tableRows(table: string) {
  switch (table) {
    case 'company_members':
      return [{ company_id: COMPANY_ID, role: 'ADMIN', companies: { id: COMPANY_ID, name: 'MALEK Demo', slug: 'malek-demo', currency: 'OMR', locale: 'ar-OM' } }];
    case 'company_settings':
      return [companySettings];
    case 'properties':
      return properties;
    case 'units':
      return units;
    case 'people':
      return people;
    case 'contracts':
      return contracts;
    case 'owners':
      return owners;
    case 'property_owners':
      return [{ property_id: 'property-1', owner_id: 'owner-1', is_primary: true, starts_on: '2025-01-01', ends_on: null }];
    case 'owner_agreements':
      return [{ id: 'oa-1', property_id: 'property-1', starts_on: '2025-01-01', ends_on: null }];
    default:
      return [];
  }
}

async function installHarness(page: Page) {
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
    if (url.pathname.includes('/auth/v1/token')) {
      await fulfillJson(route, sessionPayload());
      return;
    }
    if (url.pathname.includes('/auth/v1/user')) {
      await fulfillJson(route, sessionPayload().user);
      return;
    }
    if (url.pathname.endsWith('/rest/v1/rpc/rpt_dashboard_snapshot')) {
      await fulfillJson(route, minimalSnapshot);
      return;
    }
    const tableMatch = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
    if (tableMatch) {
      await fulfillJson(route, tableRows(tableMatch[1] ?? ''));
      return;
    }
    await fulfillJson(route, []);
  });
}

async function openAuthenticatedDashboard(page: Page) {
  await installHarness(page);
  await page.addInitScript(() => {
    document.documentElement.dataset.theme = 'light';
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

/** Change the single document direction authority for the LTR/RTL acceptance leg. */
async function forceShellDirection(page: Page, direction: 'rtl' | 'ltr') {
  await page.evaluate((dir) => {
    document.documentElement.setAttribute('dir', dir);
  }, direction);
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(
    Math.max(metrics.documentScrollWidth, metrics.bodyScrollWidth),
    `${label}: horizontal overflow`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

const MOBILE_VIEWPORTS = [
  { name: '320', width: 320, height: 740 },
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
] as const;

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Launch-polish matrix runs once in the desktop shard');
});

for (const viewport of MOBILE_VIEWPORTS) {
  for (const direction of ['rtl', 'ltr'] as const) {
    test(`mobile launch polish ${viewport.name}px ${direction.toUpperCase()} — header, page/date context, quick add, dock, bottom sheet`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openAuthenticatedDashboard(page);
      await forceShellDirection(page, direction);
      const label = `dashboard@${viewport.name}@${direction}`;

      const header = page.locator('[data-app-shell-header]');
      await expect(header).toBeVisible();
      const lockup = page.locator('[data-header-brand-lockup]');
      await expect(lockup).toBeVisible();
      await expect(lockup.locator('[data-malek-canonical-mark]')).toBeVisible();
      await expect(lockup.locator('[data-header-wordmark]')).toHaveText('MALEK');

      const controls = page.locator('[data-header-right-controls]');
      await expect(controls).toBeVisible();
      const lockupBox = await lockup.boundingBox();
      const controlsBox = await controls.boundingBox();
      expect(lockupBox, `${label}: brand lockup box`).not.toBeNull();
      expect(controlsBox, `${label}: controls box`).not.toBeNull();

      expect(lockupBox!.x + lockupBox!.width / 2, `${label}: brand must sit on the physical left`).toBeLessThan(viewport.width * 0.35);
      expect(controlsBox!.x + controlsBox!.width / 2, `${label}: controls must sit on the physical right`).toBeGreaterThan(viewport.width * 0.65);
      expect(
        lockupBox!.x + lockupBox!.width <= controlsBox!.x + 1,
        `${label}: header groups must not overlap`,
      ).toBeTruthy();

      await expect(page.locator('[data-header-date-center]')).toHaveCount(0);

      const hitAreas = page.locator('[data-header-control-hit]');
      await expect(hitAreas).toHaveCount(2);
      const firstButton = hitAreas.first().locator('button');
      const buttonBox = await firstButton.boundingBox();
      expect(buttonBox, `${label}: visible control box`).not.toBeNull();
      expect(buttonBox!.height, `${label}: visible control must be compact (<=36px)`).toBeLessThanOrEqual(36);
      expect(buttonBox!.width, `${label}: visible control must be compact (<=36px)`).toBeLessThanOrEqual(36);

      const headerBox = await header.boundingBox();
      expect(headerBox, `${label}: header box`).not.toBeNull();
      expect(headerBox!.height, `${label}: header must not grow (<=60px)`).toBeLessThanOrEqual(60);

      const today = page.locator('[data-global-today-context]');
      await expect(today).toBeVisible();
      await expect(today).toContainText('لوحة التحكم');
      const weekday = today.locator('[data-global-today-weekday]');
      const dayDate = today.locator('[data-global-today-day-date]');
      expect((await weekday.textContent())?.trim(), `${label}: weekday must be populated`).not.toBe('');
      expect((await dayDate.textContent())?.trim(), `${label}: date must be populated`).not.toBe('');

      await expect(page.locator('[data-mobile-dock-menu]')).toBeVisible();
      await expect(page.locator('[data-mobile-dock-search]')).toBeVisible();
      await expect(page.locator('[data-mobile-dock-quick-add]')).toBeVisible();
      await expect(page.locator('[data-mobile-dock-notifications]')).toBeVisible();
      await expect(page.locator('[data-mobile-dock-ai]')).toBeVisible();

      const dockBox = await page.locator('[data-mobile-floating-control]').boundingBox();
      expect(dockBox, `${label}: dock box`).not.toBeNull();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(200);
      const clearance = await page.evaluate(() => {
        const content = document.querySelector('[data-page-layout] > *');
        return Number.parseFloat(getComputedStyle(content as Element).paddingBlockEnd);
      });
      expect(
        clearance,
        `${label}: page content must reserve the dock clearance`,
      ).toBeGreaterThanOrEqual(dockBox!.height - 1);

      await page.locator('[data-mobile-dock-quick-add]').click();
      const quickList = page.locator('[data-mobile-quick-add-list]');
      await expect(quickList).toBeVisible();
      const flexDirection = await quickList.evaluate((el) => getComputedStyle(el).flexDirection);
      expect(flexDirection, `${label}: quick add must be a vertical stack`).toBe('column');
      const quickItems = page.locator('[data-mobile-quick-add-item]');
      await expect(quickItems).toHaveCount(4);
      const expectedLabels = ['عقد جديد', 'تحصيل مبلغ', 'طلب صيانة', 'فاتورة مرافق'];
      for (let index = 0; index < expectedLabels.length; index += 1) {
        await expect(quickItems.nth(index), `${label}: quick add row ${index + 1}`).toHaveText(expectedLabels[index]);
        const itemBox = await quickItems.nth(index).boundingBox();
        expect(itemBox, `${label}: quick add row box ${index + 1}`).not.toBeNull();
        expect(itemBox!.height, `${label}: quick add rows need a comfortable tap target`).toBeGreaterThanOrEqual(44);
        const listBox = await quickList.boundingBox();
        expect(itemBox!.width, `${label}: quick add rows span the list width`).toBeGreaterThanOrEqual((listBox!.width - 16) * 0.9);
      }
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-mobile-quick-add-menu]')).toHaveCount(0);

      // Primary navigation is the shared bottom sheet, opened by the dock Menu.
      await page.locator('[data-mobile-dock-menu]').click();
      const sheet = page.locator('[data-bottom-sheet]');
      await expect(sheet).toBeVisible();
      await expect(page.locator('[data-mobile-nav-bottom-sheet]')).toBeVisible();
      await expect(sheet).toHaveAttribute('role', 'dialog');
      await expect(sheet).toHaveAttribute('aria-modal', 'true');

      const sheetBox = await sheet.boundingBox();
      expect(sheetBox, `${label}: navigation sheet box`).not.toBeNull();
      expect(sheetBox!.x, `${label}: sheet starts inside viewport`).toBeGreaterThanOrEqual(-1);
      expect(sheetBox!.x + sheetBox!.width, `${label}: sheet stays inside viewport`).toBeLessThanOrEqual(viewport.width + 1);
      expect(sheetBox!.width, `${label}: sheet uses the phone width`).toBeGreaterThanOrEqual(viewport.width - 2);
      expect(sheetBox!.y + sheetBox!.height, `${label}: sheet is bottom anchored`).toBeGreaterThanOrEqual(viewport.height - 2);

      await expect(page.locator('[data-mobile-floating-control]')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      await expect(page.locator('[data-mobile-floating-control]')).toBeVisible();

      await expectNoHorizontalOverflow(page, label);
    });
  }
}

for (const viewport of MOBILE_VIEWPORTS) {
  for (const direction of ['rtl', 'ltr'] as const) {
    test(`entity card density ${viewport.name}px ${direction.toUpperCase()} — properties, units, contracts`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openAuthenticatedDashboard(page);
      const label = `cards@${viewport.name}@${direction}`;

      await page.goto('/properties', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/properties$/);
      await forceShellDirection(page, direction);
      const propertyCards = page.locator('[data-entity-table-mobile-card]');
      await expect(propertyCards.first(), 'properties mobile card').toBeVisible({ timeout: 20_000 });
      const propertyCard = propertyCards.first();
      await expect(propertyCard).toContainText('برج الخليج');
      await expect(propertyCard).toContainText('نشط');
      const propertySummary = propertyCard.locator('[data-entity-table-mobile-summary]');
      await expect(propertySummary).toBeVisible();
      await expect(propertySummary).toContainText('سكني');
      await expect(propertySummary).toContainText('مسقط');
      await expect(propertySummary).toContainText('مالك برج الخليج');
      await expect(propertySummary).toContainText('2/3 وحدة');
      await expect(page.locator('[data-entity-table-mobile-actions]')).toHaveCount(0);
      await expect(propertyCard).toContainText('فتح التفاصيل');
      await expect(propertyCard).toContainText('تعديل');
      await expect(propertyCard).toContainText('أرشفة');
      const propertyCardBox = await propertyCard.boundingBox();
      expect(propertyCardBox, `${label}: property card box`).not.toBeNull();
      expect(
        propertyCardBox!.x + propertyCardBox!.width,
        `${label}: property card must not clip the viewport`,
      ).toBeLessThanOrEqual(viewport.width + 1);
      await expectNoHorizontalOverflow(page, `${label}-properties`);

      await page.goto('/properties?section=units', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-portfolio-section="units"]')).toBeVisible();
      const unitCards = page.locator('[data-portfolio-section="units"] [data-entity-table-mobile-card]');
      await expect(unitCards.first(), 'units mobile card').toBeVisible({ timeout: 20_000 });
      await expect(unitCards).toHaveCount(3);
      const unitCard = unitCards.first();
      await expect(unitCard).toContainText('101');
      await expect(unitCard).toContainText('مشغولة');
      await expect(unitCard.locator('[data-entity-table-mobile-summary]')).toContainText('الإيجار');
      await expect(page.locator('[data-portfolio-section="units"] [data-entity-table-mobile-actions]')).toHaveCount(0);
      await expect(unitCard).toContainText('فتح التفاصيل');
      await expectNoHorizontalOverflow(page, `${label}-units`);

      await page.goto('/contracts', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/contracts$/);
      const contractCards = page.locator('[data-entity-table-mobile-card]');
      await expect(contractCards.first(), 'contracts mobile card').toBeVisible({ timeout: 20_000 });
      const contractCard = contractCards.first();
      await expect(contractCard).toContainText('نشط');
      const contractSummary = contractCard.locator('[data-entity-table-mobile-summary]');
      await expect(contractSummary).toContainText('أحمد الفارسي');
      await expect(contractSummary).toContainText('101');
      await expect(contractSummary).toContainText('الفترة');
      await expect(contractSummary).toContainText('قيمة الإيجار');
      await expect(page.locator('[data-entity-table-mobile-actions]')).toHaveCount(0);
      await expect(contractCard).toContainText('فتح التفاصيل');
      await expect(contractCard).toContainText('تعديل');
      await expect(contractCard).toContainText('أرشفة');
      const contractCardBox = await contractCard.boundingBox();
      expect(contractCardBox, `${label}: contract card box`).not.toBeNull();
      expect(
        contractCardBox!.x + contractCardBox!.width,
        `${label}: contract card must not clip the viewport`,
      ).toBeLessThanOrEqual(viewport.width + 1);
      await expectNoHorizontalOverflow(page, `${label}-contracts`);
    });
  }
}
