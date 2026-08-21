import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { installAcceptanceBrowser } from './support/document-acceptance-session';
import { IDS, installFakeSupabaseBackend } from './support/fake-supabase-backend';

const evidenceDir = resolve(import.meta.dirname, 'evidence/mobile-density');
const runtimeErrors = new WeakMap<Page, string[]>();
const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 1000 };

const screens = [
  { id: 'properties', url: '/properties', panel: '[data-portfolio-section="properties"]', table: 'جدول العقارات' },
  { id: 'units', url: '/properties?section=units', panel: '[data-portfolio-section="units"]', table: 'جدول الوحدات' },
  { id: 'owners', url: '/properties?section=owners', panel: '[data-portfolio-section="owners"]', table: 'جدول الملاك' },
  { id: 'tenants', url: '/contracts?workspace=tenants', panel: '[data-leasing-section="tenants"]', table: 'جدول المستأجرين' },
  { id: 'contracts', url: '/contracts', panel: '[data-leasing-section="contracts"]', table: 'جدول العقود' },
] as const;

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test.setTimeout(180_000);

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'The explicit visual matrix controls its own iPhone and desktop viewports.');
  await mkdir(evidenceDir, { recursive: true });
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.includes('/realtime/v1/websocket') && text.includes('ERR_NAME_NOT_RESOLVED')) return;
    errors.push(`console: ${text}`);
  });
  await installAcceptanceBrowser(page, { interceptPrint: false });
  const seed = await installFakeSupabaseBackend(page, 'complete');
  seed.tables.property_owners = [];
  seed.tables.payment_terms_templates = [];
  seed.rpcs.get_company_onboarding_state = () => ({
    has_property: true,
    has_unit: true,
    has_contract: true,
    has_invoice: true,
  });
  const baseDashboard = seed.rpcs.rpt_dashboard_snapshot({}) as Record<string, unknown>;
  seed.rpcs.rpt_dashboard_snapshot = () => ({
    ...baseDashboard,
    portfolio: { properties: 4, units: 15 },
    occupancy: { occupied_units: 12, vacant_units: 3, occupancy_rate: 80 },
    contracts: { active: 8, expiring_30: 2, expiring_60: 3, expiring_90: 4 },
    billing: { invoiced_amount: 15_000, invoices_count: 10, invoices_total_count: 60 },
    collections: { collected_amount: 12_000, payments_count: 8, outstanding_amount: 3_000, collection_rate: 80 },
    expenses: { total_amount: 1_500, count: 3 },
    net_cash: 10_500,
    arrears: {
      total_overdue: 3_000,
      overdue_count: 2,
      average_days_overdue: 28,
      over_90_amount: 0,
      over_90_count: 0,
      total_outstanding: 3_000,
      buckets: {
        current: { total: 0, count: 0 },
        days_1_30: { total: 1_500, count: 1 },
        days_31_60: { total: 1_500, count: 1 },
        days_61_90: { total: 0, count: 0 },
        days_90_plus: { total: 0, count: 0 },
      },
    },
    maintenance: { open: 2, in_progress: 1, urgent_open: 1 },
    exceptions: { unmatched_bank_lines: 2, pending_settlements: 1 },
    queues: {
      expiring_contracts: [{ id: IDS.contract, reference: 'CON-2026-001', end_date: '2026-09-10', days_remaining: 19, tenant_name: 'أحمد الحارثي', property_title: 'برج الواحة', unit_number: '301' }],
      overdue_invoices: [{ invoice_id: IDS.invoiceOverdue, reference: 'INV-2026-003', due_date: '2026-06-01', days_overdue: 81, remaining_amount: 220, tenant_name: 'أحمد الحارثي', property_title: 'برج الواحة', unit_number: '301' }],
      urgent_maintenance: [{ id: 'maintenance-1', title: 'تسرب مياه', priority: 'urgent', property_title: 'برج الواحة', unit_number: '301' }],
    },
  });

  // The real owner workspace expects the embedded ownership relation returned
  // by its PostgREST select. Add that relation to the deterministic seeded row.
  const property = seed.tables.properties[0] as Record<string, unknown> | undefined;
  const owner = seed.tables.owners[0] as Record<string, unknown> | undefined;
  const contract = seed.tables.contracts[0] as Record<string, unknown> | undefined;
  const unit = seed.tables.units[0] as Record<string, unknown> | undefined;
  if (contract) contract.rent_amount = 420;
  if (unit) unit.rent_amount = 420;
  if (property && owner) {
    property.property_owners = [{
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      property_id: IDS.property,
      owner_id: IDS.owner,
      ownership_percentage: 100,
      is_primary: true,
      starts_on: '2026-01-01',
      ends_on: null,
      created_at: '2026-01-01T08:00:00.000Z',
      updated_at: '2026-01-01T08:00:00.000Z',
      owner,
    }];
  }
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) ?? []).toEqual([]);
});

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const result = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(result.html, `${label}: html overflow`).toBeLessThanOrEqual(result.viewport + 1);
  expect(result.body, `${label}: body overflow`).toBeLessThanOrEqual(result.viewport + 1);
}

async function openEntityScreen(page: Page, screen: (typeof screens)[number], width: 'mobile' | 'desktop'): Promise<Locator> {
  await page.setViewportSize(width === 'mobile' ? mobile : desktop);
  await page.goto(screen.url);
  await expect(page.locator('[data-app-shell]')).toBeVisible({ timeout: 20_000 });
  const panel = page.locator(screen.panel);
  await expect(panel).toBeVisible({ timeout: 20_000 });

  const register = width === 'mobile'
    ? panel.locator('[data-entity-table-mobile]')
    : panel.locator('[data-entity-table-wrapper]');
  await expect(register).toBeVisible({ timeout: 20_000 });
  await expectNoHorizontalOverflow(page, `${screen.id}-${width}`);
  return panel;
}

async function capture(page: Page, name: string, fullPage = true) {
  await page.screenshot({ path: resolve(evidenceDir, name), fullPage });
}

test('iPhone entity pages are data-first, dense, labelled, and one-page clean', async ({ page }) => {
  for (const screen of screens) {
    const panel = await openEntityScreen(page, screen, 'mobile');

    await expect(panel.locator('[data-entity-summary-strip]')).toBeVisible();
    await expect(panel.locator('[data-entity-table-mobile-card]').first()).toBeVisible();
    await expect(panel.locator('[data-table-columns-menu]')).toBeHidden();
    await expect(panel.getByRole('navigation', { name: 'ترقيم الصفحات' })).toHaveCount(0);

    const chrome = await panel.evaluate((node) => {
      const toolbar = node.querySelector('[data-filter-bar]');
      const register = node.querySelector('[data-entity-table-mobile]');
      const action = node.querySelector('[data-workspace-actions], [data-primary-action]');
      const nestedCard = register?.closest('[data-component-card], [data-mobile-card], [data-kpi-card]');
      return {
        actionTop: action?.getBoundingClientRect().top ?? null,
        toolbarTop: toolbar?.getBoundingClientRect().top ?? null,
        registerTop: register?.getBoundingClientRect().top ?? null,
        nestedCard: Boolean(nestedCard),
      };
    });
    expect(chrome.nestedCard, `${screen.id}: register must not sit inside another card`).toBe(false);
    expect(chrome.toolbarTop).not.toBeNull();
    expect(chrome.registerTop).not.toBeNull();
    expect(chrome.toolbarTop ?? 0).toBeLessThan(chrome.registerTop ?? 0);

    const rowAudit = await panel.locator('[data-mobile-data-row]').first().evaluate((row) => {
      const identity = row.querySelector<HTMLElement>('[data-entity-table-mobile-primary]');
      const facts = row.querySelectorAll('[data-entity-table-mobile-datum]');
      const badges = Array.from(row.querySelectorAll<HTMLElement>('[data-status-badge]')).map((badge) => badge.getBoundingClientRect().height);
      return {
        identityText: identity?.innerText.trim() ?? '',
        identityClipped: Boolean(identity && identity.scrollWidth > identity.clientWidth + 1),
        factCount: facts.length,
        maxBadgeHeight: Math.max(0, ...badges),
      };
    });
    expect(rowAudit.identityText.length, `${screen.id}: record identity`).toBeGreaterThan(0);
    expect(rowAudit.identityClipped, `${screen.id}: record identity clipping`).toBe(false);
    expect(rowAudit.factCount, `${screen.id}: supporting data`).toBeGreaterThanOrEqual(1);
    expect(rowAudit.maxBadgeHeight, `${screen.id}: status badge height`).toBeLessThanOrEqual(32);

    const smallTargets = await panel.evaluate((node) =>
      Array.from(node.querySelectorAll<HTMLElement>(
        '[data-workspace-actions] button, [data-primary-action] button, [data-filter-bar] button, [data-entity-table-mobile-card] button',
      )).flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden') return [];
        return rect.width < 44 || rect.height < 44
          ? [{ label: element.getAttribute('aria-label') ?? element.innerText.trim(), width: rect.width, height: rect.height }]
          : [];
      }),
    );
    expect(smallTargets, `${screen.id}: sub-44 primary/data actions`).toEqual([]);

    await capture(page, `${screen.id}-iphone-390.png`);
    await capture(page, `${screen.id}-iphone-390-viewport.png`, false);
  }
});

test('phone filter sheets are named and replace parallel select rows', async ({ page }) => {
  const unitsScreen = screens.find((screen) => screen.id === 'units')!;
  const panel = await openEntityScreen(page, unitsScreen, 'mobile');
  const trigger = panel.getByRole('button', { name: /فتح الفلاتر/ });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const sheet = page.locator('[data-mobile-filter-sheet]');
  await expect(sheet).toBeVisible();
  await expect(page.getByRole('heading', { name: 'تصفية الوحدات' })).toBeVisible();
  await expect(sheet.getByText('العقار', { exact: true })).toBeVisible();
  await expect(sheet.getByText('الحالة', { exact: true })).toBeVisible();
  await expect(sheet.getByText('الإشغال', { exact: true })).toBeVisible();
  await expect(sheet.getByRole('group', { name: 'حالة الوحدة' })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'units-filter-sheet');
  await capture(page, 'units-filters-iphone-390.png');
});

test('Today remains decisions-first with no duplicate KPI or quick-action sections', async ({ page }) => {
  await page.setViewportSize(mobile);
  await page.goto('/dashboard');
  await expect(page.locator('[data-dashboard-hero]')).toBeVisible({ timeout: 20_000 });
  const sections = await page.locator('[data-dashboard-section]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-dashboard-section')));
  expect(sections).toEqual(['work-now', 'portfolio']);
  await expect(page.locator('[data-dashboard-action-grid]')).toHaveCount(0);
  await expect(page.locator('[data-dashboard-kpi-grid]')).toHaveCount(0);
  await expect(page.getByText('حالة التحصيل')).toHaveCount(0);
  await expect(page.getByText('حالة المحفظة', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'today-mobile');
  await capture(page, 'today-iphone-390.png');
  await capture(page, 'today-iphone-390-viewport.png', false);
});

test('mobile navigation is a compact hub, not desktop cards inside a full-height sheet', async ({ page }) => {
  await page.setViewportSize(mobile);
  await page.goto('/dashboard');
  await expect(page.locator('[data-app-shell]')).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-mobile-dock-menu]').click();

  const hub = page.locator('[data-mobile-navigation-hub]');
  await expect(hub).toBeVisible();
  await expect(hub.getByRole('heading', { name: 'القائمة الرئيسية' })).toBeVisible();
  const geometry = await hub.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const groupedCards = node.querySelectorAll('nav section[class*="border-white"], nav section[class*="rounded-xl"]');
    return { height: rect.height, viewportHeight: window.innerHeight, groupedCards: groupedCards.length };
  });
  expect(geometry.height).toBeLessThanOrEqual(geometry.viewportHeight * 0.8);
  expect(geometry.groupedCards).toBe(0);
  await expectNoHorizontalOverflow(page, 'mobile-navigation-hub');
  await capture(page, 'navigation-hub-iphone-390.png');
});

test('desktop keeps semantic tables and the same data-first hierarchy', async ({ page }) => {
  for (const screen of screens) {
    const panel = await openEntityScreen(page, screen, 'desktop');
    await expect(panel.getByRole('table', { name: screen.table })).toBeVisible();
    await expect(panel.locator('[data-entity-table-mobile]')).toBeHidden();
    await expect(panel.locator('[data-entity-summary-strip]')).toBeVisible();
    await capture(page, `${screen.id}-desktop-1440.png`);
  }

  await page.setViewportSize(desktop);
  await page.goto('/dashboard');
  await expect(page.locator('[data-dashboard-hero]')).toBeVisible({ timeout: 20_000 });
  await expectNoHorizontalOverflow(page, 'today-desktop');
  await capture(page, 'today-desktop-1440.png');
});
