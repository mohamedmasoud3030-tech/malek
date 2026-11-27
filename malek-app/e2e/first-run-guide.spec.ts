import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Stream A — دليل البداية وسطر شرح الصفحة على نسخة شغالة فعلا (dev server
 * حقيقي + حدود Supabase مثبتة مثل باقي أطقم الـ e2e في المشروع).
 */

const companyId = '00000000-0000-4000-8000-000000000101';
const userId = '00000000-0000-4000-8000-000000000201';
const nowIso = '2026-08-05T08:00:00.000Z';

type GuideCounts = Record<'properties' | 'units' | 'people' | 'contracts', number>;

function encodeJwtPart(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sessionPayload() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const app_metadata = { user_role: 'ADMIN', role: 'ADMIN', company_id: companyId };
  const accessToken = `${encodeJwtPart({ alg: 'HS256', typ: 'JWT' })}.${encodeJwtPart({ sub: userId, role: 'authenticated', email: 'first-run-admin@malek.test', app_metadata, exp: expiresAt })}.e2e-signature`;
  return {
    access_token: accessToken,
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: {
      id: userId, aud: 'authenticated', role: 'authenticated', email: 'first-run-admin@malek.test', app_metadata,
      user_metadata: {}, created_at: nowIso, updated_at: nowIso,
    },
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-expose-headers': 'content-range',
      'content-range': Array.isArray(body) && body.length > 0 ? `0-${body.length - 1}/${body.length}` : '*/0',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function installGuideHarness(page: Page, counts: GuideCounts) {
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
    if (url.pathname.includes('/rest/v1/rpc/list_my_effective_app_permissions')) {
      // صلاحيات الحارس المكاني: نرجع المجموعة الكاملة كما يفعل دور ADMIN الحقيقي.
      await fulfillJson(route, [
        { permission: 'contracts.view' },
        { permission: 'contracts.create' },
        { permission: 'contracts.edit' },
        { permission: 'properties.view' },
        { permission: 'properties.create' },
        { permission: 'properties.edit' },
        { permission: 'maintenance.view' },
        { permission: 'financial.workspace.view' },
        { permission: 'financial.reports.view' },
        { permission: 'owners.hub.view' },
        { permission: 'owners.detail.view' },
        { permission: 'lands.view' },
        { permission: 'leads.view' },
        { permission: 'communication.view' },
        { permission: 'commissions.view' },
        { permission: 'service_providers.view' },
        { permission: 'company.settings.manage' },
      ]);
      return;
    }
    const tableMatch = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
    const table = tableMatch?.[1] ?? '';
    if (request.method() === 'HEAD' && table in counts) {
      // عدّ دليل البداية: PostgREST يرجع العدد في ترويسة content-range فقط.
      await route.fulfill({
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'content-range',
          'content-range': `*/${counts[table as keyof GuideCounts]}`,
        },
        body: '',
      });
      return;
    }
    if (table === 'company_members') {
      await fulfillJson(route, [{ company_id: companyId, role: 'ADMIN', companies: { id: companyId, name: 'MALEK Demo', slug: 'malek-demo', currency: 'OMR', locale: 'ar-OM' } }]);
      return;
    }
    // باقي مصادر الصفحة ترجع فاضي: الدليل مستقل عن حالة بقية لوحة اليوم.
    await fulfillJson(route, []);
  });
}

async function openAsAdmin(page: Page, path: string, counts: GuideCounts) {
  await installGuideHarness(page, counts);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((session) => {
    window.localStorage.setItem('malek-auth-session', JSON.stringify(session));
  }, sessionPayload());
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

const emptyCounts: GuideCounts = { properties: 0, units: 0, people: 0, contracts: 0 };

test('دليل البداية يظهر لحساب جديد بأربع خطوات وروابطها', async ({ page }) => {
  await openAsAdmin(page, '/dashboard', emptyCounts);

  const guide = page.locator('[data-first-run-guide]');
  await expect(guide).toBeVisible();
  await expect(guide.getByText('أهلا بيك في مالك — ابدأ من هنا')).toBeVisible();
  await expect(guide.getByText(/خلصت 0 من 4/)).toBeVisible();
  await expect(guide.locator('[data-first-run-step]')).toHaveCount(4);
  await expect(guide.locator('[data-first-run-step-link="properties"]')).toHaveAttribute('href', '/properties/new');
  await expect(guide.locator('[data-first-run-step-link="contracts"]')).toHaveAttribute('href', '/contracts/new');
});

test('الخطوات المكتملة تتعلم من عدد السجلات الفعلي', async ({ page }) => {
  await openAsAdmin(page, '/dashboard', { properties: 2, units: 5, people: 0, contracts: 0 });

  const guide = page.locator('[data-first-run-guide]');
  await expect(guide.getByText(/خلصت 2 من 4/)).toBeVisible();
  await expect(guide.locator('[data-first-run-step="properties"]')).toHaveAttribute('data-step-done', 'true');
  await expect(guide.locator('[data-first-run-step="units"]')).toHaveAttribute('data-step-done', 'true');
  await expect(guide.locator('[data-first-run-step="contracts"]')).toHaveAttribute('data-step-done', 'false');
});

test('الدليل يختفي لما الأساسيات تكتمل', async ({ page }) => {
  await openAsAdmin(page, '/dashboard', { properties: 1, units: 3, people: 2, contracts: 1 });
  await expect(page.locator('[data-first-run-guide]')).toHaveCount(0);
});

test('إخفاء الدليل يثبت عبر إعادة التحميل', async ({ page }) => {
  await openAsAdmin(page, '/dashboard', emptyCounts);
  const guide = page.locator('[data-first-run-guide]');
  await expect(guide).toBeVisible();
  await guide.locator('[data-first-run-guide-dismiss]').click();
  await expect(guide).toHaveCount(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  // تأكد أولا أن التطبيق نفسه اتعرض فعلا بعد إعادة التحميل، حتى لا يمر
  // الاختبار صوريا لو الصفحة كلها فشلت.
  await expect(page.getByRole('heading', { name: 'اليوم', level: 1 })).toBeVisible();
  await expect(page.locator('[data-first-run-guide]')).toHaveCount(0);
});

test('سطر شرح الصفحة يظهر أعلى المحتوى ويتبع المسار', async ({ page }) => {
  await openAsAdmin(page, '/dashboard', emptyCounts);
  await expect(page.locator('[data-page-intro]')).toContainText('ملخص شغل النهارده');

  // صفحة أخرى بدون حارس صلاحيات: بوابة الصلاحيات في بيئة الاختبار المثبتة
  // لا تكتمل على المسارات المحروسة (قيود حارس المشروع نفسه، خارج نطاق الميزة).
  await page.goto('/help', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-page-intro]')).toContainText('شرح مزايا النظام');
});
