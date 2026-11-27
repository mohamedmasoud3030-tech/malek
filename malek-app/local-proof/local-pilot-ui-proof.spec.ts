import { test, expect } from '@playwright/test';

// Real local backend only. No request interception or simulated auth.
const api = process.env.VITE_SUPABASE_URL ?? '';
if (new URL(api).hostname !== '127.0.0.1') throw new Error('Local proof requires loopback backend');
const key = process.env.VITE_SUPABASE_ANON_KEY!;
const evidenceDirectory = process.env.LOCAL_PROOF_EVIDENCE_DIR ?? 'test-results/local-proof-evidence';
const localFixturePassword = 'local-fixture-not-for-production-2026';
test.setTimeout(90000);
for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
  test(`real local UI and persistence ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'البريد الإلكتروني', exact: true }).fill('local-maker@malek.test');
    await page.getByPlaceholder('••••••••').fill(localFixturePassword);
    await page.getByRole('button', { name: /تسجيل الدخول/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
    for (const [name, route, heading] of [
      ['dashboard', '/dashboard', 'اليوم'],
      ['properties', '/properties', 'العقارات'],
      ['money', '/financials?section=collections&view=invoices', 'المال'],
    ]) {
      await page.goto(route);
      await expect(page.locator('[data-app-shell]')).toBeVisible({ timeout: 25000 });
      await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (name === 'money') {
        await expect(page.getByRole('region', { name: 'قائمة الفواتير', exact: true })).toBeVisible();
        if (viewport.width < 640) {
          const card = page.locator('[data-entity-card]').first();
          const cardBox = await card.boundingBox();
          expect(cardBox!.width).toBeGreaterThan(viewport.width * 0.8);
          const date = card.locator('[data-invoice-due-date]');
          await expect(date).toHaveAttribute('dir', 'ltr');
          await expect(date).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/);
          const titleFits = await card.locator('[data-entity-table-mobile-primary]').evaluate(el => el.scrollWidth <= el.clientWidth || el.getBoundingClientRect().width > 200);
          expect(titleFits).toBe(true);
          const lastAction = page.locator('[data-entity-card]').last().getByRole('button', { name: /^معاينة / });
          await lastAction.scrollIntoViewIfNeeded();
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          const actionBox = await lastAction.boundingBox();
          const dockBox = await page.locator('[data-mobile-floating-control]').boundingBox();
          expect(actionBox!.y + actionBox!.height).toBeLessThan(dockBox!.y);
          await lastAction.click({ trial: true });
          await page.screenshot({ path: `${evidenceDirectory}/dock-clearance-${viewport.width}.png` });
          await page.evaluate(() => window.scrollTo(0, 0));
        }
      }
      if (name === 'properties') await expect(page.locator('[data-entity-table-register]').getByText(/بناية|مجمع|Local persistence/).first()).toBeVisible();
      await page.screenshot({ path: `${evidenceDirectory}/real-${name}-${viewport.width}.png`, fullPage: true });
    }
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem('malek-auth-session')!));
    const headers = { apikey: key, Authorization: `Bearer ${session.access_token}`, Prefer: 'return=representation' };
    const title = `Local persistence proof ${viewport.width} ${Date.now()}`;
    const created = await page.request.post(`${api}/rest/v1/properties`, { headers, data: { title, type: 'residential', address: 'Local synthetic test address', status: 'active', company_id: session.user.app_metadata.company_id } });
    expect(created.status(), await created.text()).toBe(201);
    const row = (await created.json())[0];
    await page.goto('/properties');
    await page.reload();
    await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 25000 });
    const persisted = await page.request.get(`${api}/rest/v1/properties?id=eq.${row.id}&select=id,title`, { headers });
    expect((await persisted.json())[0].title).toBe(title);
    const denied = await page.request.post(`${api}/rest/v1/properties`, { headers, data: { title: 'Forbidden cross-company', type: 'residential', address: 'Local synthetic test address', status: 'active', company_id: '00000000-0000-4000-8000-000000000999' } });
    expect(denied.status()).toBeGreaterThanOrEqual(400);
    const anonymous = await page.request.get(`${api}/rest/v1/properties?select=id`, { headers: { apikey: key } });
    expect(anonymous.status()).toBeGreaterThanOrEqual(400);
    // Remove only this test's synthetic property, never a shared fixture.
    const cleanup = await page.request.patch(`${api}/rest/v1/properties?id=eq.${row.id}`, { headers, data: { deleted_at: new Date().toISOString() } });
    expect(cleanup.status()).toBeLessThan(300);
  });
}
