import { expect, test } from '@playwright/test';

// Requires `pnpm build` + the production preview; never mistake dev-mode SW
// absence for a regression. No account, API write or live credential is used.
test('production shell installs its worker and fails safely to the Arabic offline page', async ({ page, context }) => {
  test.skip(process.env.E2E_PRODUCTION !== 'true', 'Production service worker verification only');
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /تسجيل الدخول/ })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const cachedUrls = await page.evaluate(async () => {
    const stores = await caches.keys();
    return (await Promise.all(stores.map(async (key) => (await (await caches.open(key)).keys()).map((r) => r.url)))).flat();
  });
  expect(cachedUrls.some((url) => url.includes('/offline.html'))).toBe(true);
  expect(cachedUrls.filter((url) => /\/rest\/v1\/|\/auth\/v1\/|\/storage\/v1\//.test(url))).toEqual([]);
  await context.setOffline(true);
  await page.goto('/offline-verification-route');
  await expect(page).toHaveTitle('غير متصل — MALEK');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('form')).toHaveCount(0);
  await context.setOffline(false);
});
