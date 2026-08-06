import { expect, test, type Page, type Route } from '@playwright/test';

type DashboardHarnessMode = 'normal' | 'empty' | 'partial-bank-error' | 'snapshot-error' | 'stale-refetch-error';

// Contract width matrix (MALEK Visual Contract V2 / ADR 0012 phase 2-3):
// 320 / 375 / 414 mobile, 768 tablet, 1024 small desktop, 1440 desktop.
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
  { id: 'unit-5', property_id: 'property-1', unit_number: '5', floor: '1', status: 'occupied', rent_amount: 750, deleted_at: null },
  { id: 'unit-12', property_id: 'property-2', unit_number: '12', floor: '2', status: 'occupied', rent_amount: 900, deleted_at: null },
];

const people = [
  { id: 'tenant-1', type: 'tenant', full_name: 'أحمد الفارسي', phone: null, email: null, national_id: null, deleted_at: null },
  { id: 'tenant-2', type: 'tenant', full_name: 'سالم الكعبي', phone: null, email: null, national_id: null, deleted_at: null },
];

const owners = [
  { id: 'owner-1', name: 'مالك برج الخليج', full_name: 'مالك برج الخليج', display_name: 'مالك برج الخليج', deleted_at: null, is_active: true },
  { id: 'owner-2', name: 'مالك واحة مسقط', full_name: 'مالك واحة مسقط', display_name: 'مالك واحة مسقط', deleted_at: null, is_active: true },
];

const contracts = [
  {
    id: 'contract-1',
    property_id: 'property-1',
    unit_id: 'unit-5',
    tenant_id: 'tenant-1',
    start_date: '2025-08-01',
    end_date: soonDate,
    rent_amount: 750,
    payment_cycle: 'monthly',
    status: 'active',
    created_at: nowIso,
    updated_at: nowIso,
    deleted_at: null,
    notes: null,
    agreement_id: null,
    payment_terms_id: null,
    cancellation_reason: null,
    attachment_url: null,
    renewed_from_id: null,
    properties: { id: 'property-1', title: 'برج الخليج', address: 'مسقط' },
    units: { id: 'unit-5', unit_number: '5', floor: '1', status: 'occupied', rent_amount: 750 },
    people: { id: 'tenant-1', full_name: 'أحمد الفارسي', phone: null, email: null, national_id: null },
  },
  {
    id: 'contract-2',
    property_id: 'property-2',
    unit_id: 'unit-12',
    tenant_id: 'tenant-2',
    start_date: '2025-08-01',
    end_date: laterDate,
    rent_amount: 900,
    payment_cycle: 'monthly',
    status: 'active',
    created_at: nowIso,
    updated_at: nowIso,
    deleted_at: null,
    notes: null,
    agreement_id: null,
    payment_terms_id: null,
    cancellation_reason: null,
    attachment_url: null,
    renewed_from_id: null,
    properties: { id: 'property-2', title: 'واحة مسقط', address: 'مسقط' },
    units: { id: 'unit-12', unit_number: '12', floor: '2', status: 'occupied', rent_amount: 900 },
    people: { id: 'tenant-2', full_name: 'سالم الكعبي', phone: null, email: null, national_id: null },
  },
];

const invoices = [
  { id: 'invoice-1', contract_id: 'contract-1', issue_date: '2026-08-01', due_date: '2026-07-10', amount: 1_500, paid_amount: 0, tax_amount: 0, status: 'overdue', deleted_at: null, contracts: { id: 'contract-1', property_id: 'property-1', tenant_id: 'tenant-1', unit_id: 'unit-5' } },
  { id: 'invoice-2', contract_id: 'contract-2', issue_date: '2026-08-01', due_date: '2026-07-14', amount: 1_500, paid_amount: 0, tax_amount: 0, status: 'overdue', deleted_at: null, contracts: { id: 'contract-2', property_id: 'property-2', tenant_id: 'tenant-2', unit_id: 'unit-12' } },
  { id: 'invoice-3', contract_id: 'contract-1', issue_date: '2026-08-02', due_date: '2026-08-02', amount: 12_000, paid_amount: 12_000, tax_amount: 0, status: 'paid', deleted_at: null, contracts: { id: 'contract-1', property_id: 'property-1', tenant_id: 'tenant-1', unit_id: 'unit-5' } },
];

const payments = [
  { id: 'payment-1', invoice_id: 'invoice-3', amount: 12_000, payment_date: '2026-08-03', payment_method: 'bank_transfer', status: 'posted', deleted_at: null },
];

const expenses = [
  { id: 'expense-1', property_id: 'property-1', category: 'صيانة', amount: 1_500, expense_date: '2026-08-04', cost_center_id: null, deleted_at: null },
];

const maintenanceRecords = [
  { id: 'maintenance-1', title: 'تسرب مياه', priority: 'urgent', status: 'open', property_id: 'property-1', unit_id: 'unit-5', property_title: 'برج الخليج', unit_number: '5', deleted_at: null, created_at: nowIso },
];

const baseOverview = {
  financial: { total_collected: 12_000, total_overdue_invoices: 3_000, total_expenses: 1_500, net_revenue: 10_500 },
  operational: { properties: 2, units: 2, activeContracts: 2, expiringContracts30Days: 2, vacantUnits: 0, overdueInvoices: 2 },
};

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
      role: 'OWNER',
      companies: { id: companyId, name: 'MALEK Demo', slug: 'malek-demo', currency: 'OMR', locale: 'ar-OM' },
    }];
  }
  if (table === 'company_settings') return companySettings;
  if (empty) {
    if (table === 'properties') return [];
    if (table === 'units') return [];
    if (table === 'people') return [];
    if (table === 'contracts') return [];
    if (table === 'invoices') return [];
    if (table === 'payments') return [];
    if (table === 'expenses') return [];
    if (table === 'maintenance_records') return [];
    if (table === 'bank_statement_lines') return [];
    if (table === 'owner_settlements') return [];
    if (table === 'owners') return [];
    if (table === 'property_owners') return [];
    if (table === 'owner_agreements') return [];
  }
  if (table === 'properties') return properties;
  if (table === 'units') return units;
  if (table === 'people') return people;
  if (table === 'contracts') return contracts;
  if (table === 'invoices') return invoices;
  if (table === 'payments') return payments;
  if (table === 'expenses') return expenses;
  if (table === 'maintenance_records') return maintenanceRecords;
  if (table === 'bank_statement_lines') return [];
  if (table === 'owner_settlements') return [];
  if (table === 'owners') return owners;
  if (table === 'property_owners') return [
    { property_id: 'property-1', owner_id: 'owner-1', is_primary: true, starts_on: '2025-01-01', ends_on: null },
    { property_id: 'property-2', owner_id: 'owner-2', is_primary: true, starts_on: '2025-01-01', ends_on: null },
  ];
  if (table === 'owner_agreements') return [
    { property_id: 'property-1', owner_id: 'owner-1', starts_on: '2025-01-01', ends_on: null },
    { property_id: 'property-2', owner_id: 'owner-2', starts_on: '2025-01-01', ends_on: null },
  ];
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
  let overviewRequests = 0;
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

    if (url.pathname.endsWith('/rest/v1/rpc/rpt_dashboard_overview')) {
      overviewRequests += 1;
      if (mode === 'snapshot-error' || (mode === 'stale-refetch-error' && overviewRequests > 1)) {
        await fulfillJson(route, { message: 'dashboard overview unavailable in harness' }, 500);
        return;
      }
      await fulfillJson(route, mode === 'empty'
        ? { financial: { total_collected: 0, total_overdue_invoices: 0, total_expenses: 0, net_revenue: 0 }, operational: { properties: 0, units: 0, activeContracts: 0, expiringContracts30Days: 0, vacantUnits: 0, overdueInvoices: 0 } }
        : baseOverview);
      return;
    }

    const tableMatch = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
    if (tableMatch) {
      const table = tableMatch[1] ?? '';
      if (mode === 'partial-bank-error' && table === 'bank_statement_lines') {
        await fulfillJson(route, { message: 'bank statement count unavailable in harness' }, 500);
        return;
      }
      await fulfillJson(route, tableRows(table, mode));
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
  await expect(page.locator('[data-visual-contract="v2"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'لوحة التحكم', level: 1 })).toBeVisible();
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
  const lastDashboardChild = page.locator('[data-visual-contract="v2"] > *').last();
  await lastDashboardChild.scrollIntoViewIfNeeded();
  const state = await page.evaluate(() => {
    const nav = document.querySelector('[data-mobile-bottom-nav]');
    const scopedChildren = Array.from(document.querySelectorAll('[data-visual-contract="v2"] > *'));
    const last = scopedChildren.at(-1);
    if (!nav || !last) return { hasNav: false, safe: true };
    const navRect = nav.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    return { hasNav: true, safe: lastRect.bottom <= navRect.top + 1, lastBottom: lastRect.bottom, navTop: navRect.top };
  });
  expect(state.safe, `Dashboard content must not be hidden behind bottom nav: ${JSON.stringify(state)}`).toBe(true);
}

async function assertTouchTargets(page: Page) {
  const targetSizes = await page.evaluate(() => {
    const selectors = [
      '[data-dashboard-action-grid] > a',
      'a[data-dashboard-kpi-link]',
      'a[data-dashboard-priority-link]',
      'a[data-dashboard-queue-link]',
      'a[data-dashboard-analytics-link]',
    ];
    return selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector)).map((el) => {
        const rect = el.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        return { selector, width: rect.width, height: rect.height, visible };
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
    test(`real dashboard visual contract v2 ${viewport.name} ${theme} RTL`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openDashboardRoute(page, theme);

      const sectionNames = await page.locator('[data-dashboard-section]').evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-dashboard-section')),
      );
      expect(sectionNames.slice(0, 5)).toEqual(['priorities', 'kpis', 'actions', 'work-queues', 'trends']);
      if (sectionNames.length > 5) expect(sectionNames[5]).toBe('analytics');

      await expect(page.locator('[data-dashboard-action-grid] > a')).toHaveCount(4);
      const kpiLinks = page.locator('[data-dashboard-kpi-grid] a[data-dashboard-kpi-link]');
      await expect(kpiLinks).toHaveCount(4);
      const kpiHrefs = await kpiLinks.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
      expect(kpiHrefs).toEqual(['/financials', '/arrears', '/reports', '/expenses']);

      const actionColumns = await page.locator('[data-dashboard-action-grid]').evaluate((node) =>
        getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length,
      );
      const kpiColumns = await page.locator('[data-dashboard-kpi-grid] > div').evaluate((node) =>
        getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length,
      );
      expect(actionColumns).toBe(viewport.width >= 1024 ? 4 : 2);
      expect(kpiColumns).toBe(viewport.width >= 1024 ? 4 : 2);

      if (viewport.width === 375) {
        const kpisInFirstScreen = await kpiLinks.evaluateAll((nodes) => nodes.filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.top < window.innerHeight && rect.bottom > 0;
        }).length);
        expect(kpisInFirstScreen).toBeGreaterThanOrEqual(3);
      }

      await assertTouchTargets(page);
      await assertNoHorizontalOverflow(page);
      if (viewport.width < 1024) await assertBottomNavSafeArea(page);
      await page.screenshot({ path: testInfo.outputPath(`dashboard-real-${viewport.name}-${theme}.png`), fullPage: true });
    });
  }
}

test('real dashboard visual contract v2 keyboard focus stays visible', async ({ page }, testInfo) => {
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

test('real dashboard visual contract v2 reduced motion collapses animation inside the scope', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Reduced-motion proof runs once in Chromium.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await openDashboardRoute(page, 'light');

  await expect(page.locator('[data-kpi-card]').first()).toBeVisible();
  const durations = await page.evaluate(() => {
    const scoped = document.querySelector('[data-visual-contract="v2"]');
    if (!scoped) return null;
    const card = scoped.querySelector('[data-kpi-card]');
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

test('real dashboard route exposes loading, empty, error, partial and stale states honestly', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'State proof runs once in Chromium.');

  await page.setViewportSize({ width: 375, height: 812 });

  await openDashboardRoute(page, 'light', 'partial-bank-error');
  await expect(page.locator('[data-status-badge]', { hasText: 'غير متاح' }).first()).toBeVisible();
  await expect(page.getByText('تعذر تحميل العدد الآن')).toBeVisible();
  await expect(page.getByText('لا توجد أعمال عاجلة')).toHaveCount(0);

  await page.context().clearCookies();
  await page.evaluate(() => window.localStorage.clear());
  await openDashboardRoute(page, 'light', 'empty');
  await expect(page.getByText('لا توجد أعمال عاجلة')).toBeVisible();
  await expect(page.getByText('لا توجد فواتير متأخرة')).toBeVisible();

  await page.context().clearCookies();
  await page.evaluate(() => window.localStorage.clear());
  await openDashboardRoute(page, 'light', 'snapshot-error');
  await expect(page.getByText('تعذر تحميل لوحة التحكم')).toBeVisible();
  await expect(page.locator('[data-dashboard-kpi-grid]')).toHaveCount(0);

  await page.context().clearCookies();
  await page.evaluate(() => window.localStorage.clear());
  await openDashboardRoute(page, 'light', 'stale-refetch-error');
  await expect(page.locator('[data-dashboard-kpi-grid]')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('malek-dashboard-e2e-refetch')));
  await expect(page.getByText('تعذر تحديث لوحة التحكم')).toBeVisible();
  await expect(page.locator('[data-dashboard-kpi-grid]')).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath('dashboard-real-states.png'), fullPage: true });
});
