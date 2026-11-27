import { expect, test, type Page, type Route } from '@playwright/test';

/** لقطات «قبل» لمسار تصميم الموبايل: اليوم، العقارات، إضافة عقار — 390px. */

const companyId = '00000000-0000-4000-8000-000000000101';
const userId = '00000000-0000-4000-8000-000000000201';
const nowIso = '2026-08-05T08:00:00.000Z';
const soonDate = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const companySettings = {
  id: '00000000-0000-4000-8000-000000000301', singleton_key: true, company_name: 'MALEK', legal_name: null,
  tax_number: null, registration_number: null, phone: null, email: null, address: null, city: null,
  country: 'OM', currency: 'OMR', locale: 'ar-OM', timezone: 'Asia/Muscat', date_format: 'dd/MM/yyyy',
  number_format: 'ar-OM', logo_url: null, invoice_prefix: 'INV', contract_prefix: 'CON', receipt_prefix: 'REC',
  default_vat_rate: 0, vat_enabled: false, vat_rate: 5, vat_registration_number: null,
  notification_email_enabled: true, notification_sms_enabled: false, created_at: nowIso, updated_at: nowIso,
};

const properties = [
  { id: 'property-1', owner_id: 'owner-1', name: 'برج الخليج', title: 'برج الخليج', address: 'مسقط', deleted_at: null },
  { id: 'property-2', owner_id: 'owner-2', name: 'واحة مسقط', title: 'واحة مسقط', address: 'مسقط', deleted_at: null },
  { id: 'property-3', owner_id: 'owner-2', name: 'عمارة السلام', title: 'عمارة السلام', address: 'مسقط', deleted_at: null },
];
const units = [
  { id: 'unit-5', property_id: 'property-1', unit_number: '5', floor: '1', status: 'occupied', rent_amount: 750, created_at: nowIso, deleted_at: null },
  { id: 'unit-12', property_id: 'property-2', unit_number: '12', floor: '2', status: 'available', rent_amount: 900, created_at: nowIso, deleted_at: null },
];

function buildSnapshot() {
  return {
    meta: { source: 'rpt_dashboard_snapshot' },
    portfolio: { properties: 3, units: 2 },
    occupancy: { occupied_units: 1, vacant_units: 1, occupancy_rate: 50 },
    contracts: { active: 2, expiring_30: 1, expiring_60: 1, expiring_90: 1 },
    billing: { invoiced_amount: 15_000, invoices_count: 3, invoices_total_count: 3 },
    collections: { collected_amount: 12_000, payments_count: 1, outstanding_amount: 3_000, collection_rate: 80 },
    expenses: { total_amount: 1_500, count: 1 },
    net_cash: 10_500,
    arrears: {
      total_overdue: 3_000, overdue_count: 2, average_days_overdue: 30, over_90_amount: 0, over_90_count: 0, total_outstanding: 3_000,
      buckets: {
        current: { total: 0, count: 0 }, days_1_30: { total: 1_500, count: 1 }, days_31_60: { total: 1_500, count: 1 },
        days_61_90: { total: 0, count: 0 }, days_90_plus: { total: 0, count: 0 },
      },
    },
    owner_funds: { net_payable: 50, settlements_draft: 1, settlements_approved: 1 },
    maintenance: { open: 1, in_progress: 0, urgent_open: 1 },
    exceptions: { unmatched_bank_lines: 2, pending_settlements: 1 },
    queues: {
      expiring_contracts: [
        { id: 'contract-1', reference: 'CON-1001', end_date: soonDate, days_remaining: 9, tenant_name: 'أحمد الفارسي', property_title: 'برج الخليج', unit_number: '5' },
      ],
      overdue_invoices: [
        { invoice_id: 'invoice-1', reference: 'INV-2001', due_date: '2026-07-10', days_overdue: 26, remaining_amount: 1_500, tenant_name: 'أحمد الفارسي', property_title: 'برج الخليج', unit_number: '5' },
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
  const accessToken = `${encodeJwtPart({ alg: 'HS256', typ: 'JWT' })}.${encodeJwtPart({ sub: userId, role: 'authenticated', email: 'design-admin@malek.test', app_metadata, exp: expiresAt })}.e2e-signature`;
  return {
    access_token: accessToken, refresh_token: 'e2e-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'design-admin@malek.test', app_metadata, user_metadata: {}, created_at: nowIso, updated_at: nowIso },
  };
}

const ALL_PERMISSIONS = [
  'contracts.view', 'contracts.create', 'contracts.edit', 'properties.view', 'properties.create', 'properties.edit',
  'maintenance.view', 'financial.workspace.view', 'financial.reports.view', 'owners.hub.view', 'owners.detail.view',
  'lands.view', 'leads.view', 'communication.view', 'commissions.view', 'service_providers.view', 'company.settings.manage',
].map((permission) => ({ permission }));

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-expose-headers': 'content-range',
      'content-range': Array.isArray(body) && body.length > 0 ? `0-${body.length - 1}/${body.length}` : '*/0',
    },
    body: JSON.stringify(body),
  });
}

async function installHarness(page: Page) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.hostname.includes('supabase')) { await route.continue(); return; }
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      return;
    }
    if (url.pathname.includes('/auth/v1/token')) { await fulfillJson(route, sessionPayload()); return; }
    if (url.pathname.includes('/auth/v1/user')) { await fulfillJson(route, sessionPayload().user); return; }
    if (url.pathname.includes('/rest/v1/rpc/list_my_effective_app_permissions')) { await fulfillJson(route, ALL_PERMISSIONS); return; }
    if (url.pathname.endsWith('/rest/v1/rpc/rpt_dashboard_snapshot')) { await fulfillJson(route, buildSnapshot()); return; }
    const tableMatch = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
    const table = tableMatch?.[1] ?? '';
    if (request.method() === 'HEAD') {
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-range': '*/0' }, body: '' });
      return;
    }
    if (table === 'company_members') { await fulfillJson(route, [{ company_id: companyId, role: 'ADMIN', companies: { id: companyId, name: 'MALEK Demo', slug: 'malek-demo', currency: 'OMR', locale: 'ar-OM' } }]); return; }
    if (table === 'company_settings') { await fulfillJson(route, companySettings); return; }
    if (table === 'properties') { await fulfillJson(route, properties); return; }
    if (table === 'units') { await fulfillJson(route, units); return; }
    await fulfillJson(route, []);
  });
}

async function openPage(page: Page, path: string, shot: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await installHarness(page);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((session) => {
    window.localStorage.setItem('malek-auth-session', JSON.stringify(session));
    window.localStorage.setItem('malek.first-run-guide.dismissed.v1', '1');
  }, sessionPayload());
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.locator('main').first()).toBeVisible({ timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `/home/sandbox/malek/malek-app/test-results/${shot}`, fullPage: true });
}

test('shot dashboard', async ({ page }) => { await openPage(page, '/dashboard', 'design-after-dashboard.png'); });
test('shot properties', async ({ page }) => { await openPage(page, '/properties', 'design-after-properties.png'); });
test('shot add-property', async ({ page }) => { await openPage(page, '/properties/new', 'design-after-propnew.png'); });
