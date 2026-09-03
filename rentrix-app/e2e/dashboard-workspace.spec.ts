import { expect, test, type Page, type Route } from '@playwright/test';

type DashboardHarnessMode = 'normal' | 'empty' | 'snapshot-error' | 'stale-refetch-error';

// Runtime proof across the supported phone/tablet/desktop widths.
const viewportMatrix = [
  { name: 'mobile-320', width: 320, height: 760 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-414', width: 414, height: 896 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 820 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
] as const;

const themes = ['light', 'dark'] as const;
const companyId = '00000000-0000-4000-8000-000000000101';
const userId = '00000000-0000-4000-8000-000000000201';
const nowIso = '2026-08-05T08:00:00.000Z';
const soonDate = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const laterDate = new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
  created_at: nowIso,
  updated_at: nowIso,
};

const properties = [
  { id: 'property-1', owner_id: 'owner-1', name: 'برج الخليج', title: 'برج الخليج', address: 'مسقط', deleted_at: null },
  { id: 'property-2', owner_id: 'owner-2', name: 'واحة مسقط', title: 'واحة مسقط', address: 'مسقط', deleted_at: null },
];

const units = [
  { id: 'unit-5', property_id: 'property-1', unit_number: '5', floor: '1', status: 'occupied', rent_amount: 750, created_at: nowIso, deleted_at: null },
  { id: 'unit-12', property_id: 'property-2', unit_number: '12', floor: '2', status: 'occupied', rent_amount: 900, created_at: nowIso, deleted_at: null },
];

const maintenanceRecords = [
  {
    id: 'maintenance-1',
    title: 'تسرب مياه',
    description: null,
    priority: 'urgent',
    status: 'open',
    property_id: 'property-1',
    unit_id: 'unit-5',
    tenant_id: null,
    request_date: nowIso.slice(0, 10),
    scheduled_date: null,
    completed_at: null,
    estimated_cost: null,
    actual_cost: null,
    vendor_name: null,
    vendor_phone: null,
    notes: null,
    created_at: nowIso,
    updated_at: nowIso,
    deleted_at: null,
  },
];

function buildSnapshot(empty: boolean) {
  if (empty) {
    return {
      meta: { source: 'rpt_dashboard_snapshot' },
      portfolio: { properties: 0, units: 0 },
      occupancy: { occupied_units: 0, vacant_units: 0, occupancy_rate: 0 },
      contracts: { active: 0, expiring_30: 0, expiring_60: 0, expiring_90: 0 },
      billing: { invoiced_amount: 0, invoices_count: 0, invoices_total_count: 0 },
      collections: { collected_amount: 0, payments_count: 0, outstanding_amount: 0, collection_rate: 0 },
      expenses: { total_amount: 0, count: 0 },
      net_cash: 0,
      arrears: {
        total_overdue: 0, overdue_count: 0, average_days_overdue: 0,
        over_90_amount: 0, over_90_count: 0, total_outstanding: 0,
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
  }

  return {
    meta: { source: 'rpt_dashboard_snapshot' },
    portfolio: { properties: 2, units: 2 },
    occupancy: { occupied_units: 2, vacant_units: 0, occupancy_rate: 100 },
    contracts: { active: 2, expiring_30: 2, expiring_60: 2, expiring_90: 2 },
    billing: { invoiced_amount: 15_000, invoices_count: 3, invoices_total_count: 3 },
    collections: { collected_amount: 12_000, payments_count: 1, outstanding_amount: 3_000, collection_rate: 80 },
    expenses: { total_amount: 1_500, count: 1 },
    net_cash: 10_500,
    arrears: {
      total_overdue: 3_000, overdue_count: 2, average_days_overdue: 30,
      over_90_amount: 0, over_90_count: 0, total_outstanding: 3_000,
      buckets: {
        current: { total: 0, count: 0 },
        days_1_30: { total: 1_500, count: 1 },
        days_31_60: { total: 1_500, count: 1 },
        days_61_90: { total: 0, count: 0 },
        days_90_plus: { total: 0, count: 0 },
      },
    },
    owner_funds: { net_payable: 0, settlements_draft: 0, settlements_approved: 0 },
    maintenance: { open: 1, in_progress: 0, urgent_open: 1 },
    exceptions: { unmatched_bank_lines: 0, pending_settlements: 0 },
    queues: {
      expiring_contracts: [
        { id: 'contract-1', reference: 'CON-1001', end_date: soonDate, days_remaining: 9, tenant_name: 'أحمد الفارسي', property_title: 'برج الخليج', unit_number: '5' },
        { id: 'contract-2', reference: 'CON-1002', end_date: laterDate, days_remaining: 18, tenant_name: 'سالم الكعبي', property_title: 'واحة مسقط', unit_number: '12' },
      ],
      overdue_invoices: [
        { invoice_id: 'invoice-1', reference: 'INV-2001', due_date: '2026-07-10', days_overdue: 26, remaining_amount: 1_500, tenant_name: 'أحمد الفارسي', property_title: 'برج الخليج', unit_number: '5' },
        { invoice_id: 'invoice-2', reference: 'INV-2002', due_date: '2026-07-14', days_overdue: 22, remaining_amount: 1_500, tenant_name: 'سالم الكعبي', property_title: 'واحة مسقط', unit_number: '12' },
      ],
      urgent_maintenance: [
        { id: 'maintenance-1', title: 'تسرب مياه', priority: 'urgent', property_title: 'برج الخليج', unit_number: '5' },
      ],
    },
  };
}

function encodeJwtPart(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sessionPayload() {
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
  };
}

function tableRows(table: string, mode: DashboardHarnessMode) {
  const empty = mode === 'empty';
  if (table === 'company_members') {
    return [{
      company_id: companyId,
      role: 'ADMIN',
      companies: { id: companyId, name: 'MALEK Demo', slug: 'malek-demo', currency: 'OMR', locale: 'ar-OM' },
    }];
  }
  if (table === 'company_settings') return companySettings;
  if (empty) return [];
  if (table === 'properties') return properties;
  if (table === 'units') return units;
  if (table === 'maintenance_records') return maintenanceRecords;
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
      'content-range': contentRangeFor(body),
    },
    body: JSON.stringify(body),
  });
}

async function installDashboardHarness(page: Page, mode: DashboardHarnessMode) {
  let snapshotRequests = 0;
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
      snapshotRequests += 1;
      if (mode === 'snapshot-error' || (mode === 'stale-refetch-error' && snapshotRequests > 1)) {
        await fulfillJson(route, { message: 'dashboard snapshot unavailable in harness' }, 500);
        return;
      }
      await fulfillJson(route, buildSnapshot(mode === 'empty'));
      return;
    }

    const tableMatch = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
    if (tableMatch) {
      await fulfillJson(route, tableRows(tableMatch[1] ?? '', mode));
      return;
    }

    await fulfillJson(route, []);
  });
}

async function openDashboardRoute(page: Page, theme: (typeof themes)[number], mode: DashboardHarnessMode = 'normal') {
  await installDashboardHarness(page, mode);
  await page.addInitScript((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((session) => {
    window.localStorage.setItem('rentrix-auth-session', JSON.stringify(session));
  }, sessionPayload());
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.evaluate((selectedTheme) => {
    document.documentElement.dataset.theme = selectedTheme;
    document.documentElement.dir = 'rtl';
  }, theme);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('[data-page-layout]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'اليوم', level: 1 })).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.documentClientWidth + 1);
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.documentClientWidth + 1);
}

async function assertBottomNavSafeArea(page: Page) {
  const lastDashboardChild = page.locator('[data-page-layout] [data-dashboard-section]').last();
  await lastDashboardChild.scrollIntoViewIfNeeded();
  const state = await page.evaluate(() => {
    const nav = document.querySelector('[data-mobile-bottom-nav]');
    const scopedChildren = Array.from(document.querySelectorAll('[data-page-layout] [data-dashboard-section]'));
    const last = scopedChildren.at(-1);
    if (!nav || !last) return { safe: true };
    const navRect = nav.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    return { safe: lastRect.bottom <= navRect.top + 1, lastBottom: lastRect.bottom, navTop: navRect.top };
  });
  expect(state.safe, `Dashboard content must not be hidden behind bottom nav: ${JSON.stringify(state)}`).toBe(true);
}

async function assertTouchTargets(page: Page) {
  const targetSizes = await page.evaluate(() => {
    const selectors = [
      'a[data-dashboard-kpi-link]',
      'a[data-dashboard-queue-link]',
      '[data-needs-attention-link]',
      'a[data-dashboard-owner-obligations-link]',
    ];
    return selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector)).map((el) => {
        const rect = el.getBoundingClientRect();
        return { selector, width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 };
      }),
    ).filter((target) => target.visible);
  });
  expect(targetSizes.length).toBeGreaterThan(0);
  for (const target of targetSizes) {
    expect(
      target.height >= 44 && target.width >= 44,
      `${target.selector} must stay >= 44x44 (got ${Math.round(target.width)}x${Math.round(target.height)})`,
    ).toBe(true);
  }
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'The explicit dashboard matrix runs once in Chromium.');
});

for (const viewport of viewportMatrix) {
  for (const theme of themes) {
    test(`real dashboard command center ${viewport.name} ${theme} RTL`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openDashboardRoute(page, theme);

      const dashboardSections = page.locator('[data-dashboard-section]');
      await expect(dashboardSections).toHaveCount(9);
      const sectionNames = await dashboardSections.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-dashboard-section')),
      );
      expect(sectionNames).toEqual([
        'needs-attention',
        'office-pulse',
        'collections',
        'occupancy',
        'maintenance',
        'upcoming-contracts',
        'property-health',
        'financial-performance',
        'owner-obligations',
      ]);

      await expect(page.locator('[data-dashboard-focus-strip]')).toHaveCount(0);
      await expect(page.locator('[data-dashboard-secondary-disclosure]')).toHaveCount(0);
      await expect(page.locator('[data-dashboard-section="finance-exceptions"]')).toHaveCount(0);
      await expect(page.locator('[data-dashboard-section="needs-attention"]')).toHaveAttribute('data-dashboard-priority', 'attention');
      await expect(page.locator('[data-dashboard-section="needs-attention"]')).toContainText('يحتاج انتباهك');
      await expect(page.locator('[data-dashboard-section="collections"]')).toContainText('التحصيل والمتأخرات');
      await expect(page.locator('[data-dashboard-section="upcoming-contracts"]')).toContainText('العقود القادمة');
      await expect(page.locator('[data-dashboard-owner-obligations-link]')).toHaveAttribute('href', '/owner-settlements');
      await expect(page.locator('[data-dashboard-office-pulse] [data-kpi-card]')).toHaveCount(4);

      const firstDecision = await page.locator('[data-dashboard-section="needs-attention"]').evaluate((node) => {
        const attention = node.getBoundingClientRect();
        const pulse = document.querySelector('[data-dashboard-section="office-pulse"]')?.getBoundingClientRect();
        return {
          attentionVisible: attention.top < window.innerHeight && attention.bottom > 0,
          attentionTop: attention.top,
          pulseTop: pulse?.top ?? Number.POSITIVE_INFINITY,
        };
      });
      expect(firstDecision.attentionVisible).toBe(true);
      expect(firstDecision.attentionTop).toBeLessThan(firstDecision.pulseTop);

      await assertTouchTargets(page);
      await assertNoHorizontalOverflow(page);
      if (viewport.width < 1024) await assertBottomNavSafeArea(page);
      await page.screenshot({ path: testInfo.outputPath(`dashboard-real-${viewport.name}-${theme}.png`), fullPage: true });
    });
  }
}

test('real dashboard command center keyboard focus stays visible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Keyboard proof runs once in Chromium.');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDashboardRoute(page, 'light');

  await page.keyboard.press('Tab');
  const focusState = page.locator(':focus-visible');
  await expect(focusState).toBeVisible();
  const outline = await focusState.evaluate((node) => {
    const styles = getComputedStyle(node);
    return { style: styles.outlineStyle, width: styles.outlineWidth };
  });
  expect(outline.style).not.toBe('none');
  expect(Number.parseFloat(outline.width)).toBeGreaterThan(0);
});

test('real dashboard command center reduced motion keeps animation negligible', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Reduced-motion proof runs once in Chromium.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await openDashboardRoute(page, 'light');

  await expect(page.locator('[data-kpi-card]').first()).toBeVisible();
  const durations = await page.evaluate(() => {
    const card = document.querySelector('[data-page-layout] [data-kpi-card]');
    if (!card) return null;
    const styles = getComputedStyle(card);
    return { transition: styles.transitionDuration, animation: styles.animationDuration };
  });
  expect(durations).not.toBeNull();
  for (const value of Object.values(durations ?? {})) {
    for (const part of value.split(',')) {
      expect(Number.parseFloat(part)).toBeLessThanOrEqual(0.011);
    }
  }
});

test('real dashboard route exposes empty, error and stale states honestly', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'State proof runs once in Chromium.');
  await page.setViewportSize({ width: 375, height: 812 });

  await page.context().clearCookies();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await openDashboardRoute(page, 'light', 'empty');
  await expect(page.getByText('لا توجد متأخرات — كل الفواتير ضمن الاستحقاق.')).toBeVisible();
  await expect(page.getByText('لا توجد صيانة عاجلة الآن')).toBeVisible();
  await expect(page.getByText('كل شيء تحت السيطرة')).toBeVisible();
  await expect(page.locator('[data-dashboard-office-pulse] [data-kpi-card]')).toHaveCount(4);

  await page.context().clearCookies();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await openDashboardRoute(page, 'light', 'snapshot-error');
  await expect(page.getByText('تعذر تحميل بيانات اليوم')).toBeVisible();
  await expect(page.locator('[data-dashboard-office-pulse]')).toHaveCount(0);
  await expect(page.locator('[data-dashboard-owner-obligations-link]')).toHaveCount(0);

  await page.context().clearCookies();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await openDashboardRoute(page, 'light', 'stale-refetch-error');
  await expect(page.locator('[data-dashboard-office-pulse]')).toBeVisible();
  await expect(page.locator('[data-dashboard-owner-obligations-link]')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('malek-dashboard-e2e-refetch')));
  await expect(page.getByText('تعذر تحديث بيانات اليوم')).toBeVisible();
  await expect(page.locator('[data-dashboard-office-pulse]')).toBeVisible();
  await expect(page.locator('[data-dashboard-owner-obligations-link]')).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath('dashboard-real-states.png'), fullPage: true });
});
